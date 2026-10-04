const { parseNinja } = require('./core.cjs');
const { serverUrl, parseExchange } = require('./exchange.cjs');
const {BoundedCache} = require('./bounded-cache.cjs');
const {readDictionary,writeDictionary}=require('./dictionary-cache.cjs');
const BASE = 'https://poe.kakaogames.com';
function compactDictionary(key,value) {
  if(!['static','items','stats'].includes(key))return value;
  return {result:value.result.map(group=>({id:group.id,entries:group.entries.map(entry=>key==='items'?{name:entry.name,type:entry.type}:{id:entry.id,text:entry.text})}))};
}
class Market {
  async loadQuick(league) {
    this.snapshots ??= new Map(); this.loads ??= new Map();
    const hit=this.snapshots.get(league);
    const fresh=hit && Date.now()-hit.time<60000;
    const usable=hit && Number.isFinite(Date.parse(hit.value.updatedAt)) && Date.now()-Date.parse(hit.value.updatedAt)<1800000;
    if(fresh)return hit.value;
    let pending=this.loads.get(league);
    if(!pending){
      pending=this.load(league).then(value=>{this.snapshots.set(league,{time:Date.now(),value});return value;}).finally(()=>this.loads.delete(league));
      this.loads.set(league,pending);
    }
    if(usable){pending.catch(error=>console.error('Background price refresh:',error.message));return hit.value;}
    return pending;
  }
  constructor(options = {}) { this.cache = new BoundedCache(); this.nextRequest = 0; this.tail = Promise.resolve(); this.exchangeUrl = serverUrl(options.exchangeUrl ?? process.env.POE_EXCHANGE_URL); this.fetch = options.fetch || fetch; }
  async loadExchange(league) {
    const key = `exchange-server:${league}`;
    const hit = this.cache.get(key);
    if (hit && Date.now()-Date.parse(hit.value.updatedAt)<1800000) return hit.value;
    const response = await this.fetch(`${this.exchangeUrl}/api/markets?league=${encodeURIComponent(league)}`, {signal:AbortSignal.timeout(4000),headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error(`서버 HTTP ${response.status}`);
    const payload = await response.json();
    const result = parseExchange(payload, league);
    this.cache.set(key,{time:Date.now(),value:result});
    return result;
  }
  request(url, body) {
    const job = this.tail.then(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, this.nextRequest - Date.now())));
      this.nextRequest = Date.now() + 1600;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', 'User-Agent': 'POE2-OVERLAY/0.1 (+https://github.com/soltyspring/POE2-OVERLAY)' }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
      const retry = Number(res.headers.get('retry-after'));
      if (res.status === 429) { this.nextRequest = Date.now() + Math.max(60000, (retry || 0) * 1000); throw new Error('요청 제한: 잠시 후 다시 시도하세요.'); }
      // Respect server-advertised windows; conservatively pause when exhausted.
      for (const policy of (res.headers.get('x-rate-limit-rules') || '').split(',')) {
        const name = policy.trim().toLowerCase();
        const limits = (res.headers.get(`x-rate-limit-${name}`) || '').split(',');
        const states = (res.headers.get(`x-rate-limit-${name}-state`) || '').split(',');
        limits.forEach((limit, i) => { const [max, window] = limit.split(':').map(Number); const [used, , penalty] = (states[i] || '').split(':').map(Number);
          if (used >= max) this.nextRequest = Math.max(this.nextRequest, Date.now() + Math.max(window, penalty || 0) * 1000); });
      }
      if (!res.ok) throw new Error(`가격 서버 HTTP ${res.status}. 로그인 또는 서버 상태를 확인하세요.`);
      return res.json();
    });
    this.tail = job.catch(() => {});
    return job;
  }
  async cached(key, url, ttl) {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.time < ttl) return hit.value;
    this.pendingRequests ??= new Map();
    if(this.pendingRequests.has(key))return this.pendingRequests.get(key);
    const pending=(async()=>{
      const disk=await readDictionary(this.cacheDirectory,key,ttl);
      if(disk){this.cache.set(key,disk);return disk.value;}
      const raw=await this.request(url),value=compactDictionary(key,raw),entry={time:Date.now(),value};
      this.cache.set(key,entry);
      // Complete the first result without waiting for a disk write.
      void writeDictionary(this.cacheDirectory,key,entry);
      return value;
    })().finally(()=>this.pendingRequests.delete(key));
    this.pendingRequests.set(key,pending);
    return pending;
  }
  async load(league) {
    if (typeof league !== 'string' || !league.trim() || league.length > 100) throw new Error('리그 이름을 입력하세요.');
    const catalogPromise=this.loadCatalog();
    catalogPromise.catch(()=>{});
    let serverData = null, serverError = null;
    if (this.exchangeUrl) {
      try { serverData = await this.loadExchange(league); }
      catch(error) { serverError = `POE2-Exchange 연결/시세 실패: ${error.message} · 기존 시세로 전환`; }
    }
    const catalog = await catalogPromise;
    if (serverData) {
      // Prefer the official localized catalog; append server-only exact names.
      const names = new Set(catalog.map(item=>item.name));
      const extras = serverData.catalog.filter(item=>!names.has(item.name));
      if (extras.length) {
        const signature=JSON.stringify(extras);
        if (this.serverCatalogBase!==catalog || this.serverCatalogSignature!==signature) {
          this.serverCatalogBase=catalog;this.serverCatalogSignature=signature;this.serverCatalog=[...catalog,...extras];
        }
        return {...serverData,catalog:this.serverCatalog};
      }
      return {...serverData,catalog};
    }
    const categories = ['Currency', 'Fragments', 'Runes', 'Essences', 'Ritual', 'Breach', 'Expedition', 'SoulCores', 'UncutGems'];
    const prices = new Map(), warnings = [];
    if (serverError) warnings.push(serverError);
    let updatedAt = Infinity;
    for (const category of categories) {
      const key = `${league}:${category}`;
      try {
        const data = await this.cached(key, `https://poe.ninja/poe2/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=${category}`, 900000);
        for (const [id, price] of parseNinja(data)) prices.set(id, price);
        updatedAt = Math.min(updatedAt, this.cache.get(key).time);
      } catch (error) { warnings.push(`${category}: ${error.message}`); }
    }
    return { catalog, prices, warnings, priceSource:'poe.ninja 직접 조회', updatedAt: Number.isFinite(updatedAt) ? new Date(updatedAt).toISOString() : null };
  }
  async loadCatalog() {
    const staticData = await this.cached('static', `${BASE}/api/trade2/data/static`, 86400000);
    const items = await this.cached('items', `${BASE}/api/trade2/data/items`, 86400000);
    let catalog = this.catalog;
    if (!catalog || this.catalogStatic !== staticData || this.catalogItems !== items) {
    catalog = staticData.result.flatMap(group => group.entries.map(e => ({ id: e.id, name: e.text, kind: 'commodity', category: group.id })));
    catalog.push({id:'reward:verisium-pile',name:'베리시움 더미',kind:'unpriced'});
    for(const group of items.result)if(group.id==='map')for(const entry of group.entries){
      const match=entry.type?.match(/^경로석\s*\((\d+)등급\)$/);
      if(match)catalog.push({id:`waystone:${match[1]}`,name:entry.type,type:entry.type,kind:'waystone',tier:Number(match[1])});
    }
    for (const group of items.result) if (group.id === 'gem') for (const e of group.entries) {
      if (e.type) catalog.push({id:`gem:${e.type}`,name:e.type,type:e.type,kind:'gem'});
    }
    for (const group of items.result) for (const e of group.entries) if (e.name) {
      catalog.push({ id: `${e.name}:${e.type}`, name: e.name, uniqueName: e.name, type: e.type, kind: 'unique' });
      catalog.push({ id: `${e.name}:${e.type}:base`, name: e.type, uniqueName: e.name, type: e.type, kind: 'candidate' });
    }
    const knownBases=new Set(catalog.filter(e=>e.kind==='candidate').map(e=>e.type));
    for(const group of items.result)if(['accessory','armour','weapon','flask'].includes(group.id))for(const e of group.entries){
      if(e.type&&!e.name&&!knownBases.has(e.type)){catalog.push({id:`base:${e.type}`,name:e.type,type:e.type,kind:'base'});knownBases.add(e.type);}
    }
    this.catalog = catalog; this.catalogStatic=staticData;this.catalogItems=items;
    }
    return catalog;
  }
  async stats() { return (await this.cached('stats', `${BASE}/api/trade2/data/stats`, 86400000)).result.flatMap(g => g.entries); }
  async search(league, query, exchangeRates = new Map([['exalted', 1]])) {
    const cacheKey = JSON.stringify([league, query]);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.time < 60000) return cached.value;
    const data = await this.request(`${BASE}/api/trade2/search/${encodeURIComponent(league)}`, query);
    if (!data.id || !Array.isArray(data.result)) throw new Error('거래 검색 응답을 확인할 수 없습니다.');
    const url = `https://www.pathofexile.com/trade2/search/${encodeURIComponent(league)}/${encodeURIComponent(data.id)}`;
    if (!data.result.length) {
      const result={url,prices:[],total:data.total};
      this.cache.set(cacheKey,{time:Date.now(),value:result});
      return result;
    }
    const fetched = await this.request(`${BASE}/api/trade2/fetch/${data.result.slice(0, 10).map(encodeURIComponent).join(',')}?query=${encodeURIComponent(data.id)}`);
    const listings = fetched.result.map(r => r?.listing?.price).filter(p => Number.isFinite(p?.amount) && p.amount > 0);
    const prices = listings.filter(p => exchangeRates.has(p.currency)).map(p => p.amount * exchangeRates.get(p.currency)).sort((a,b) => a-b);
    const result = { url, prices, total: data.total, skippedCurrencies: [...new Set(listings.filter(p => !exchangeRates.has(p.currency)).map(p => p.currency))] };
    this.cache.set(cacheKey, { time: Date.now(), value: result });
    return result;
  }
}
module.exports = { Market };
