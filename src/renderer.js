const el = id => document.getElementById(id);
const money = formatPrice;
window.poe.onBusy(busy => { for (const id of ['scan', 'mouse', 'item']) el(id).disabled = busy;const dot=el('activity');dot.classList.toggle('loading',busy);if(busy)dot.classList.remove('error');dot.title=busy?'갱신 중':dot.classList.contains('error')?'조회 실패':'대기 중';dot.setAttribute('aria-label',dot.title); });
window.poe.onHealth(state=>{const dot=el('activity');dot.classList.toggle('loading',state==='loading');dot.classList.toggle('error',state==='error');dot.title=state==='error'?'조회 실패':state==='loading'?'갱신 중':'대기 중';dot.setAttribute('aria-label',dot.title);});
window.poe.onStatus(text => { el('status').textContent = text;el('status').title=text; });
window.poe.onMetrics(data=>{el('metrics').textContent=`첫 결과 ${data.firstResultMs}ms · 전체 ${data.totalMs}ms\n캡처 ${data.captureMs}ms · 인식·시세 ${data.recognizeAndPriceMs}ms\n${data.engine} · ${data.reused?'같은 화면 · OCR 생략':'OCR '+data.ocrMs+'ms'} · OCR 워커 ${data.rssMB}MB\n앱 전체 또는 게임의 자원 사용량은 포함하지 않습니다.`;});
let currentData=null;
const records=new Map();
const empty=document.createElement('p');empty.className='empty';
function renderRows() {
  if(!currentData)return;
  const filter=el('filter').value;
  const rows=currentData.rows.filter(row=>(filter==='all' || (filter==='priced' ? row.totalEx!==null : row.totalEx===null)));
  const allKeys=new Set(currentData.rows.map(row=>row.key));
  for(const [key,record] of records) if(!allKeys.has(key)){record.article.remove();records.delete(key);}
  const visible=new Set(rows.map(row=>row.key));
  for(const record of records.values()) if(!visible.has(record.row.key))record.article.remove();
  for (let i=0;i<rows.length;i++) {
    const row=rows[i];let record=records.get(row.key);
    if(!record){
      const article=document.createElement('article');article.className='row';
      const name=document.createElement('strong'),price=document.createElement('span'),note=document.createElement('small'),button=document.createElement('button');
      button.className='item-link';button.append(name);
      record={article,name,price,note,button,row,signature:null};
      button.onclick=()=>window.poe.open(record.row.siteUrl).catch(error=>{el('status').textContent=error.message;});
      article.append(button,price,note);records.set(row.key,record);
    }
    const signature=JSON.stringify(row);
    if(record.signature!==signature){
      record.row=row;record.signature=signature;
      record.name.replaceChildren();
      const parts=row.name.split(' · ');
      record.name.append(document.createTextNode(parts[0]));
      if(row.count>1){const count=document.createElement('span');count.className='item-count';count.textContent='×'+row.count;record.name.append(count);}
      if(parts.length>1){const base=document.createElement('span');base.className='item-base';base.textContent=parts.slice(1).join(' · ');record.name.append(base);}
      record.price.className='price'+(row.totalEx===null?' unknown':'');
      record.price.replaceChildren();
      if(row.totalEx===null)record.price.textContent=/조회.*중|조회 대기/.test(row.status)?'조회 중…':'확인 필요';
      else {
        const exalted=document.createElement('span'),divine=document.createElement('span');
        const range=Number.isFinite(row.totalExMax)&&row.totalExMax>row.totalEx;
        exalted.textContent=money(row.totalEx)+(range?' ~ '+money(row.totalExMax):'')+' 엑잘';divine.textContent=money(row.totalDivine)+(range&&Number.isFinite(row.totalDivineMax)?' ~ '+money(row.totalDivineMax):'')+' 신성';divine.className='divine-price';
        if(Number.isFinite(row.totalDivine))divine.title=row.totalDivine.toLocaleString('ko-KR',{maximumFractionDigits:20})+' 신성';
        else divine.title='신성 환산 기준 없음';
        exalted.title=row.totalEx.toLocaleString('ko-KR',{maximumFractionDigits:20})+' 엑잘';
        record.price.append(exalted,divine);
      }
      const labels={'base-minimum':'베이스 최저 · 옵션 미반영','candidate-minimum':'고유 후보 최저 · 종류 확인 필요','unique-minimum':'고유 최저 · 옵션 미반영','gem-minimum':'동일 레벨 최저 · 품질 미반영','waystone-minimum':'동일 등급 최저 · 옵션 미반영'};
      record.note.textContent=(labels[row.priceKind]||row.status)+(row.count>1&&row.unitEx!==null?' · 개당 '+money(row.unitEx)+' 엑잘':'');
      record.note.dataset.priceKind=row.priceKind||'unknown';
      record.note.title=row.status+(row.kind==='candidate'?' · '+[...new Set(row.candidates)].join(', '):'');
      record.button.disabled=!row.siteUrl;
      record.button.title=row.siteUrl?'POE2-Exchange에서 아이템 시세 보기':'POE2-Exchange에 대응하는 아이템이 없습니다.';
      record.button.setAttribute('aria-label',row.name+(row.siteUrl?' Exchange 아이템 시세 보기':' Exchange 아이템 없음'));
    }
    if(el('rows').children[i]!==record.article)el('rows').insertBefore(record.article,el('rows').children[i]||null);
  }
  const desiredNodes=new Set(rows.map(row=>records.get(row.key).article));
  for(const child of [...el('rows').children])if(!desiredNodes.has(child))child.remove();
  if(!rows.length){empty.textContent=currentData.rows.length?'필터에 맞는 아이템이 없습니다.\n다른 필터를 선택하면 전체 결과를 볼 수 있습니다.':'인식된 아이템이 없습니다.\n라벨이 표시되어 있는지 확인하고 다시 스캔하세요.';el('rows').append(empty);}
}
el('filter').onchange=renderRows;
window.poe.onRows(data => {
  currentData=data;
  const priced=data.rows.filter(row=>row.totalEx!==null);
  el('found').textContent=data.rows.length;el('priced').textContent=priced.length;
  el('highest').textContent=priced.length?money(Math.max(...priced.map(row=>row.totalEx)))+' 엑잘':'—';
  renderRows();
});
for (const [id,mode] of [['scan','full'],['mouse','mouse']]) el(id).onclick = async () => {try {await window.poe.scan(mode);} catch(error) {el('status').textContent=error.message;}};
function renderSaleResult(data){
  const container=el('detail');container.replaceChildren();
  const title=document.createElement('strong');title.className='sale-title';title.textContent=data.item.displayName?`${data.item.displayName} · ${data.item.type}`:data.item.name||data.item.type;
  const summary=document.createElement('p');summary.className='sale-summary';summary.textContent=data.comparison?.policy==='priority-and'?`핵심 옵션 ${data.comparison.required}개 모두 일치 · 수치 약 80% 이상 · 비교 매물 ${data.total.toLocaleString('ko-KR')}개`:`옵션 ${data.item.filters.length}개 중 ${data.comparison?.required??data.item.filters.length}개 이상 일치 · 복사한 수치 이상 · 비교 매물 ${data.total.toLocaleString('ko-KR')}개`;
  const range=document.createElement('div');range.className='sale-range';
  const label=document.createElement('span');label.textContent='조회 매물 가격';
  const price=document.createElement('strong');price.textContent=data.prices.length?`${money(data.prices[0])}${data.prices.length>1?' ~ '+money(data.prices.at(-1)):''} 엑잘`:'조건에 맞는 환산 매물이 없습니다.';
  range.append(label,price);container.append(title,summary,range);
  if(data.nameLookup&&data.nameLookup.state!=='matched'){const note=document.createElement('p');note.className='selection-warning';note.textContent=data.nameLookup.state==='not-in-dictionary'?`‘${data.nameLookup.name}’는 거래 이름 DB에 없어 ${data.item.type} 베이스·옵션으로 비교했습니다.`:`‘${data.nameLookup.name}’ 이름 매물이 없어 ${data.item.type} 베이스·옵션으로 비교했습니다.`;container.append(note);}
  if(data.comparison?.relaxed){const warning=document.createElement('p');warning.className='selection-warning';warning.textContent='전체 핵심 옵션에 맞는 매물이 없어 우선순위가 높은 옵션만 남겼습니다. 남긴 옵션은 모두 일치하며 참고 매물 가격입니다.';container.append(warning);}
  const addList=(heading,items)=>{const details=document.createElement('details'),headingNode=document.createElement('summary'),list=document.createElement('ul');details.className='option-list';headingNode.textContent=heading;for(const text of items){const li=document.createElement('li');li.textContent=text;list.append(li);}details.append(headingNode,list);container.append(details);};
  if(data.item.filters.length)addList('검색에 포함한 옵션',data.comparison?.selected?data.comparison.selected.map(f=>`${f.text} · 검색 최소 ${f.min}`):data.item.filters.map(f=>f.text));
  if(data.comparison?.excluded?.length)addList('가격 비교에서 제외한 보조 옵션',data.comparison.excluded);
  if(data.item.unmatched.length){const warning=document.createElement('p');warning.className='selection-warning';warning.textContent=`옵션 ${data.item.unmatched.length}개는 검색에서 제외되었습니다.`;container.append(warning);addList('제외된 옵션 확인',data.item.unmatched);}
  if(data.skippedCurrencies?.length){const warning=document.createElement('p');warning.className='selection-warning';warning.textContent='환율이 없는 매물은 가격 비교에서 제외했습니다.';container.append(warning);}
  const button=document.createElement('button');button.textContent='공식 거래 사이트에서 비교 ↗';button.onclick=()=>window.poe.open(data.url).catch(error=>{el('status').textContent=error.message;});
  const reference=document.createElement('p');reference.className='sale-reference';reference.textContent='조회된 매물 기준의 참고 가격입니다.';container.append(button,reference);
}
el('item').onclick = async () => {
  el('item').closest('details').open=true;
  el('item').disabled = true; el('detail').textContent = '거래 검색 중…';
  try {
    const data = await window.poe.item();
    renderSaleResult(data);
  } catch (error) { el('detail').textContent = error.message.replace(/^Error invoking remote method 'item':\s*(?:Error:\s*)?/,''); }
  finally { el('item').disabled = false; }
};
document.addEventListener('paste',event=>{
  const target=event.target;
  if(target instanceof Element && target.closest('input,textarea,[contenteditable="true"]'))return;
  event.preventDefault();
  if(!el('item').disabled)void el('item').onclick();
});
