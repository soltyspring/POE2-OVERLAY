const { parseNinja } = require('./core.cjs');
const { serverUrl, parseExchange } = require('./exchange.cjs');
const BASE = 'https://poe.kakaogames.com';
class Market {
  constructor(options = {}) { this.cache = new Map(); this.nextRequest = 0; this.tail = Promise.resolve(); this.exchangeUrl = serverUrl(options.exchangeUrl ?? process.env.POE_EXCHANGE_URL); this.fetch = options.fetch || fetch; }
  async loadExchange(league) {
    const key = `exchange-server:${league}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.time < 60000) return parseExchange(hit.value, league);
    const response = await this.fetch(`${this.exchangeUrl}/api/markets?league=${encodeURIComponent(league)}`, {signal:AbortSignal.timeout(4000),headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error(`서버 HTTP ${response.status}`);
    const payload = await response.json();
    const result = parseExchange(payload, league);
    this.cache.set(key,{time:Date.now(),value:payload});
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
    const value = await this.request(url);
    this.cache.set(key, { time: Date.now(), value });
    return value;
  }
  async load(league) {
    if (typeof league !== 'string' || !league.trim() || league.length > 100) throw new Error('리그 이름을 입력하세요.');
    let serverData = null, serverError = null;
    if (this.exchangeUrl) {
      try { serverData = await this.loadExchange(league); }
      catch(error) { serverError = `POE2-Exchange 연결/시세 실패: ${error.message} · 기존 시세로 전환`; }
    }
    const staticData = await this.cached('static', `${BASE}/api/trade2/data/static`, 86400000);
    const items = await this.cached('items', `${BASE}/api/trade2/data/items`, 86400000);
    const catalog = staticData.result.flatMap(group => group.entries.map(e => ({ id: e.id, name: e.text, kind: 'commodity', category: group.id })));
    catalog.push({id:'reward:verisium-pile',name:'베리시움 더미',kind:'unpriced'});
    for (const group of items.result) if (group.id === 'gem') for (const e of group.entries) {
      if (e.type) catalog.push({id:`gem:${e.type}`,name:e.type,type:e.type,kind:'gem'});
    }
    for (const group of items.result) for (const e of group.entries) if (e.name) {
      catalog.push({ id: `${e.name}:${e.type}`, name: e.name, uniqueName: e.name, type: e.type, kind: 'unique' });
      catalog.push({ id: `${e.name}:${e.type}:base`, name: e.type, uniqueName: e.name, type: e.type, kind: 'candidate' });
    }
    if (serverData) {
      // Prefer the official localized catalog; append server-only exact names.
      for (const item of serverData.catalog) if (!catalog.some(existing => existing.name === item.name)) catalog.push(item);
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
  async stats() { return (await this.cached('stats', `${BASE}/api/trade2/data/stats`, 86400000)).result.flatMap(g => g.entries); }
  async search(league, query, exchangeRates = new Map([['exalted', 1]])) {
    const cacheKey = JSON.stringify([league, query]);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.time < 60000) return cached.value;
    const data = await this.request(`${BASE}/api/trade2/search/${encodeURIComponent(league)}`, query);
    if (!data.id || !Array.isArray(data.result)) throw new Error('거래 검색 응답을 확인할 수 없습니다.');
    const url = `${BASE}/trade2/search/${encodeURIComponent(league)}/${encodeURIComponent(data.id)}`;
    if (!data.result.length) return { url, prices: [], total: data.total };
    const fetched = await this.request(`${BASE}/api/trade2/fetch/${data.result.slice(0, 10).map(encodeURIComponent).join(',')}?query=${encodeURIComponent(data.id)}`);
    const listings = fetched.result.map(r => r?.listing?.price).filter(p => Number.isFinite(p?.amount) && p.amount > 0);
    const prices = listings.filter(p => exchangeRates.has(p.currency)).map(p => p.amount * exchangeRates.get(p.currency)).sort((a,b) => a-b);
    const result = { url, prices, total: data.total, skippedCurrencies: [...new Set(listings.filter(p => !exchangeRates.has(p.currency)).map(p => p.currency))] };
    this.cache.set(cacheKey, { time: Date.now(), value: result });
    return result;
  }
}
module.exports = { Market };
