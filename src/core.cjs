const normalize = value => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const catalogIndexes = new WeakMap();
function catalogIndex(catalog) {
  if (catalogIndexes.has(catalog)) return catalogIndexes.get(catalog);
  const index = new Map();
  for (const item of catalog) {
    const name=normalize(item.name);
    if (!index.has(name)) index.set(name,[]);
    index.get(name).push(item);
  }
  catalogIndexes.set(catalog,index);
  return index;
}

function quantity(text) {
  // Windows OCR reads this reward menu's 1x as lx or 1)(.
  // Only repair a leading quantity marker; item names remain exact matches.
  const repaired = text.match(/^\s*(\d+|[lI])\s*(?:[x×]|\)\s*\()\s*(.+)$/i);
  if (repaired) return { name: repaired[2].trim(), count: /^\d+$/.test(repaired[1]) ? Number(repaired[1]) : 1, explicit: true };
  const m = text.match(/^\s*(\d+)\s*[x×]\s*(.+)$/i) || text.match(/^\s*(.+?)\s*[x×]\s*(\d+)\s*$/i);
  if (!m) return { name: text.trim(), count: 1, explicit: false };
  const leading = /^\d+$/.test(m[1]);
  const count = Number(leading ? m[1] : m[2]);
  return { name: leading ? m[2] : m[1], count, explicit: true };
}

function scanLines(lines, catalog, prices) {
  const rows = [];
  const seen = new Set();
  const index = catalogIndex(catalog);
  // Some labels append an English translation. Strip it only when the Korean
  // label resolves exactly, leaving tiers, levels and unknown suffixes intact.
  lines=lines.map(line=>{
    const text=line.text.replace(/\s*[（(][A-Za-z][A-Za-z '\u2019-]*[）)]\s*$/,'').trim();
    if(index.has(normalize(quantity(text).name)))return text!==line.text?{...line,text}:line;
    const corrected=text.replace(/대엘름/g,'대헬름').replace(/육적봉/g,'육척봉').replace(/[一-龥•·]+\s*$/,'').trim();
    if(index.has(normalize(quantity(corrected).name)))return {...line,text:corrected};
    const noLeadingNoise=corrected.replace(/^[\d\s•/.,]+/,'').trim();
    if(noLeadingNoise && !quantity(corrected).explicit && index.has(normalize(noLeadingNoise)))return {...line,text:noLeadingNoise};
    const withoutTier=corrected.replace(/\s*\(\d+등급\)\s*$/,'').trim();
    const tierEntries=index.get(normalize(withoutTier));
    if(withoutTier!==corrected && tierEntries?.every(e=>['base','candidate'].includes(e.kind)))return {...line,text:withoutTier};
    // Background effects can be included in the same OCR line. Accept only a
    // long exact dictionary label, obvious OCR punctuation and few stray letters.
    if(!/[;?*`弋“]/.test(corrected))return line;
    const cleaned=normalize(corrected),candidates=[];
    for(const [key,entries] of index){
      if(key.length<5 || !/^[가-힣]+$/.test(key) || !entries.every(e=>['commodity','base','candidate'].includes(e.kind)))continue;
      const at=cleaned.indexOf(key);if(at<0)continue;
      const remainder=cleaned.slice(0,at)+cleaned.slice(at+key.length);
      if((remainder.match(/[가-힣]/g)||[]).length<=4)candidates.push({key,name:entries[0].name});
    }
    candidates.sort((a,b)=>b.key.length-a.key.length);
    if(candidates.length && (candidates.length===1||candidates[0].key.length>candidates[1].key.length))return {...line,text:candidates[0].name};
    return line;
  });
  const byText=new Map(),paired=new Map(),consumed=new Set();
  for(const line of lines){const text=normalize(quantity(line.text).name);if(!byText.has(text))byText.set(text,[]);byText.get(text).push(line);}
  for(const line of [...lines].sort((a,b)=>a.y-b.y)){
    const names=(index.get(normalize(quantity(line.text).name))||[]).filter(item=>item.kind==='unique'&&item.type);
    const options=[];
    for(const type of new Set(names.map(item=>item.type)))for(const base of byText.get(normalize(type))||[]){
      const dy=base.y-line.y,dx=Math.abs(base.x-line.x);
      if(!consumed.has(base)&&dy>=8&&dy<=80&&dx<=180)options.push({base,type,distance:dy+dx*.1});
    }
    options.sort((a,b)=>a.distance-b.distance);
    if(options.length&&(options.length===1||options[1].distance-options[0].distance>2)){
      paired.set(line,options[0].type);consumed.add(options[0].base);
    }
  }
  const namedBases=new Map();
  for(const base of lines){
    if(consumed.has(base))continue;
    const entries=index.get(normalize(quantity(base.text).name))||[];
    if(!entries.length||!entries.every(e=>['candidate','base'].includes(e.kind)))continue;
    const types=new Set(entries.map(e=>e.type));if(types.size!==1)continue;
    const above=lines.filter(line=>!paired.has(line)&&!namedBases.has(line)&&!consumed.has(line)&&base.y-line.y>=8&&base.y-line.y<=60&&Math.abs(base.x-line.x)<=80&&!index.has(normalize(line.text))&&/^[가-힣]+(?:\s+[가-힣]+){1,4}$/.test(line.text.trim())).sort((a,b)=>(base.y-a.y+Math.abs(base.x-a.x)*.1)-(base.y-b.y+Math.abs(base.x-b.x)*.1));
    if(above.length){namedBases.set(above[0],entries[0].type);consumed.add(base);}
  }
  for (const line of lines) {
    if(consumed.has(line))continue;
    const q = quantity(line.text);
    // "반지" is also a real unique base in the trade dictionary, but by itself
    // commonly comes from tooltip class text or a truncated OCR label.
    // A known unique name can still consume and use this base above.
    if(normalize(q.name)==='반지')continue;
    if(namedBases.has(line)){
      const type=namedBases.get(line);
      rows.push({key:`named:${normalize(q.name)}:${Math.round(line.x)}:${Math.round(line.y)}`,name:`${q.name} · ${type}`,count:1,x:line.x,y:line.y,kind:'named-gear',type,candidates:[],unitEx:null,totalEx:null,status:'이름·베이스 인식 · 옵션 복사 후 조회'});
      continue;
    }
    const gem = q.name.match(/^(스킬|보조)(?:\s*레벨\s*(\d+))?\s*:\s*(.+)$/);
    const lookupName = gem ? gem[3].trim() : q.name;
    if (!Number.isSafeInteger(q.count) || q.count < 1) continue;
    const pairedType=paired.get(line);
    const matches = (index.get(normalize(lookupName)) || []).filter(item => pairedType ? item.kind==='unique'&&item.type===pairedType : gem ? item.kind === 'gem' : item.kind !== 'gem');
    if (!matches.length) continue;
    const key = `${normalize(q.name)}:${Math.round(line.x)}:${Math.round(line.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = matches.length === 1 ? matches[0] : null;
    const candidateType = matches.every(m => m.kind === 'candidate' && m.type && m.type === matches[0].type) ? matches[0].type : undefined;
    const unit = item?.kind === 'commodity' ? prices.get(item.id) : undefined;
    rows.push({ key, name: pairedType?`${q.name} · ${pairedType}`:q.name, count: q.count, x: line.x, y: line.y,
      kind: item?.kind || 'candidate', type: item?.type || candidateType, tier:item?.tier, level: gem?.[2] ? Number(gem[2]) : null, uniqueName: item?.uniqueName, candidates: matches.map(m => m.uniqueName || m.name),
      unitEx: Number.isFinite(unit) && unit > 0 ? unit : null,
      totalEx: Number.isFinite(unit) && unit > 0 ? unit * q.count : null,
      status: item?.kind === 'commodity' ? (unit > 0 ? '참고 시세' : '시세 없음') : item?.kind==='waystone'?'동일 등급 경로석 조회 대기':item?.kind === 'gem' ? (gem?.[2] ? '동일 레벨 젬 조회 대기' : '젬 레벨 확인 필요') : item?.kind === 'unpriced' ? '보상 수량·거래 종류 확인 필요' : '고유 종류·옵션 확인 필요' });
  }
  return rows.sort((a, b) => (b.totalEx ?? -1) - (a.totalEx ?? -1));
}

function applyGearPrices(row, result) {
  row.url = result.url;
  const prices = result.prices.filter(price => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  if (!prices.length) { row.status = '환산 가능한 비교 매물 없음'; return row; }
  const candidate = row.kind === 'candidate';
  row.unitEx = prices[0];
  row.totalEx = row.unitEx * row.count;
  const base=['named-gear','base'].includes(row.kind);
  row.priceKind = base?'base-minimum':candidate ? 'candidate-minimum' : row.kind === 'waystone'?'waystone-minimum':row.kind === 'gem' ? 'gem-minimum' : 'unique-minimum';
  row.status = base?`같은 베이스 조회 ${prices.length}매물 최저 · 희귀도·옵션 미반영`:candidate
    ? `같은 베이스의 고유 후보 · 조회 ${prices.length}매물 최저 · 종류·옵션 미확정`
    :row.kind==='waystone'?`${row.tier}등급 경로석 · 조회 ${prices.length}매물 최저 · 희귀도·옵션 미반영`: row.kind === 'gem' ? `레벨 ${row.level} 동일 젬 · 조회 ${prices.length}매물 최저 · 품질 미반영` : `이름 기준 조회 ${prices.length}매물 최저 · 옵션 미반영`;
  if (result.skippedCurrencies?.length) row.status += ' · 환율 없는 매물 제외';
  return row;
}

function parseNinja(data) {
  if (!Array.isArray(data.items) || !Array.isArray(data.lines) || !data.core?.primary) throw new Error('poe.ninja 응답 구조가 변경되었습니다.');
  const multiplier = data.core.primary === 'exalted' ? 1 : data.core.rates?.exalted;
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error('엑잘 환율을 확인할 수 없습니다.');
  const prices = new Map();
  for (const line of data.lines) {
    if (Number.isFinite(line.primaryValue) && line.primaryValue > 0) prices.set(line.id, line.primaryValue * multiplier);
  }
  prices.set('exalted', 1);
  prices.set(data.core.primary, multiplier);
  for (const [id, rate] of Object.entries(data.core.rates || {})) {
    if (Number.isFinite(rate) && rate > 0) prices.set(id, multiplier / rate);
  }
  return prices;
}

function parseItem(text, statEntries) {
  if(typeof text!=='string'||!text.trim())throw new Error('복사된 아이템 정보가 없습니다. 인벤토리·보관함의 아이템 위에 마우스를 올리고 Ctrl+C로 복사하세요. 안 되면 Ctrl+Alt+C도 시도하세요.');
  const sections = text.replace(/\r/g, '').split('\n').map(line=>line.trim()).join('\n').trim().split(/\n-{4,}\n/);
  const header = sections[0].split('\n');
  const index = header.findIndex(line => /^아이템 희귀도:/.test(line));
  if (index < 0 || !header[index + 1]) throw new Error('게임에서 Ctrl+C로 복사한 한국어 아이템 정보가 필요합니다.');
  const rarity = header[index].split(':')[1].trim();
  const names = header.slice(index + 1).filter(Boolean);
  const unidentified = sections.some(section => section.split('\n').includes('미확인'));
  const filters = [], unmatched = [];
  if (!unidentified) for (const section of sections.slice(1)) {
    let context='explicit';
    for (const raw of section.split('\n')) {
    if(/^\{.*\}$/.test(raw)){
      context=/고정 속성/.test(raw)?'implicit':/접두어|접미어/.test(raw)?'explicit':/제작/.test(raw)?'crafted':/인챈트/.test(raw)?'enchant':/룬/.test(raw)?'rune':null;
      continue;
    }
    const marker = raw.match(/\s*\((implicit|enchant|fractured|crafted|rune|desecrated|명시|암시|인챈트)\)\s*$/);
    const group = ({ '명시': 'explicit', '암시': 'implicit', '인챈트': 'enchant' })[marker?.[1]] || marker?.[1] || context;
    const line = (marker ? raw.slice(0, marker.index).trim() : raw.trim()).replace(/\s*—\s*변경이 불가능한 값\s*$/,'').replace(/(?<=\d)\(\s*[+-]?\d+(?:\.\d+)?\s*[-–~]\s*[+-]?\d+(?:\.\d+)?\s*\)/g,'');
    if (!line || line.includes(':') || !/[\d]/.test(line)) continue;
    const template = line.replace(/[+-]?\d+(?:\.\d+)?/g, '#');
    const matches = group?statEntries.filter(stat => stat.id.startsWith(group + '.') && normalize(stat.text.replace(/\+#/g, '#')) === normalize(template)):[];
    const values = (line.match(/[+-]?\d+(?:\.\d+)?/g) || []).map(Number);
    // Trade evaluates added damage ranges by their average, not either endpoint.
    // Other modifiers with multiple numbers still require explicit support.
    const damageRange=values.length===2 && /피해 #~# 추가$/.test(template) && values[0]<=values[1];
    if (matches.length === 1 && (values.length === 1 || damageRange)) {
      const value=damageRange?(values[0]+values[1])/2:values[0];
      filters.push({ id: matches[0].id, value: { min: value, max: value }, disabled: false, text: damageRange?`${raw} · 검색 평균 ${value}`:raw });
    } else unmatched.push(raw);
    }
  }
  return { rarity, name: rarity === '고유' ? names[0] : null, type: names.at(-1), unidentified, filters, unmatched };
}

function tradeQuery(item) {
  if(['named-gear','base'].includes(item.kind)){
    if(!item.type)throw new Error('장비 베이스 확인이 필요합니다.');
    return {query:{status:{option:'online'},type:item.type,stats:[{type:'and',filters:[]}]},sort:{price:'asc'}};
  }
  if(item.kind==='waystone'){
    if(!Number.isInteger(item.tier)||item.tier<1||item.tier>16)throw new Error('경로석 등급 확인이 필요합니다.');
    return {query:{status:{option:'online'},type:item.type,stats:[{type:'and',filters:[]}],filters:{map_filters:{filters:{map_tier:{min:item.tier,max:item.tier}}}}},sort:{price:'asc'}};
  }
  if (item.kind === 'gem') {
    if (!Number.isInteger(item.level) || item.level < 1 || item.level > 40) throw new Error('젬 레벨 확인이 필요합니다.');
    return { query: { status: { option: 'online' }, type: item.type, stats: [{type:'and',filters:[]}], filters: {
      type_filters: {filters:{category:{option:'gem'}}},
      misc_filters: {filters:{gem_level:{min:item.level,max:item.level}}}
    } }, sort:{price:'asc'} };
  }
  if (item.unidentified && item.rarity !== '고유') throw new Error('미확인 장비는 옵션 검색할 수 없습니다.');
  if (item.rarity !== '고유' && !item.filters.length) throw new Error('확인된 옵션이 없습니다. 베이스만으로 희귀 장비 가격을 평가하지 않습니다.');
  return { query: { status: { option: 'online' }, ...(item.name ? { name: item.name } : {}), type: item.type,
    stats: [{ type: 'and', filters: item.filters.map(({ text, value, ...filter }) => ({...filter,value:{min:value.min}})) }],
    filters: { type_filters: { filters: { rarity: { option: ({ '고유': 'unique', '희귀': 'rare', '마법': 'magic', '일반': 'normal' })[item.rarity] || 'any' } } } } }, sort: { price: 'asc' } };
}
module.exports = { normalize, quantity, scanLines, parseNinja, parseItem, tradeQuery, applyGearPrices };
