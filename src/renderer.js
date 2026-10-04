const el = id => document.getElementById(id);
const money = formatPrice;
window.poe.onBusy(busy => { for (const id of ['scan', 'mouse', 'item']) el(id).disabled = busy;const dot=el('activity');dot.classList.toggle('loading',busy);if(busy)dot.classList.remove('error');dot.title=busy?'갱신 중':dot.classList.contains('error')?'조회 실패':'대기 중';dot.setAttribute('aria-label',dot.title); });
window.poe.onHealth(state=>{const dot=el('activity');dot.classList.toggle('loading',state==='loading');dot.classList.toggle('error',state==='error');dot.title=state==='error'?'조회 실패':state==='loading'?'갱신 중':'대기 중';dot.setAttribute('aria-label',dot.title);});
window.poe.onStatus(text => { el('status').textContent = text; });
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
      button.textContent='매물 비교';
      record={article,name,price,note,button,row,signature:null};
      button.onclick=()=>window.poe.open(record.row.url).catch(error=>{el('status').textContent=error.message;});
      article.append(name,price,note,button);records.set(row.key,record);
    }
    const signature=JSON.stringify(row);
    if(record.signature!==signature){
      record.row=row;record.signature=signature;
      record.name.textContent=`${row.name}${row.count>1?' ×'+row.count:''}`;
      record.price.className='price'+(row.totalEx===null?' unknown':'');
      record.price.replaceChildren();
      if(row.totalEx===null)record.price.textContent='확인 필요';
      else {
        const exalted=document.createElement('span'),divine=document.createElement('span');
        exalted.textContent=money(row.totalEx)+' 엑잘';divine.textContent=money(row.totalDivine)+' 신성';divine.className='divine-price';
        if(Number.isFinite(row.totalDivine))divine.title=row.totalDivine.toLocaleString('ko-KR',{maximumFractionDigits:20})+' 신성';
        else divine.title='신성 환산 기준 없음';
        exalted.title=row.totalEx.toLocaleString('ko-KR',{maximumFractionDigits:20})+' 엑잘';
        record.price.append(exalted,divine);
      }
      const label=row.priceKind==='candidate-minimum'?'고유 후보 최저 · ':['unique-minimum','gem-minimum','waystone-minimum'].includes(row.priceKind)?'조회 최저 · ':'';
      record.note.textContent=label+row.status+(row.kind==='candidate'?' · '+[...new Set(row.candidates)].slice(0,8).join(', '):row.unitEx!==null?' · 개당 '+money(row.unitEx)+' 엑잘':'');
      record.button.hidden=!row.url;
    }
    if(el('rows').children[i]!==record.article)el('rows').insertBefore(record.article,el('rows').children[i]||null);
  }
  const desiredNodes=new Set(rows.map(row=>records.get(row.key).article));
  for(const child of [...el('rows').children])if(!desiredNodes.has(child))child.remove();
  if(!rows.length){empty.textContent=currentData.rows.length?'검색·필터에 맞는 아이템이 없습니다.':'인식된 아이템이 없습니다. 라벨 표시와 인식 영역을 확인하세요.';el('rows').append(empty);}
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
el('item').onclick = async () => {
  el('item').disabled = true; el('detail').textContent = '거래 검색 중…';
  try {
    const data = await window.poe.item();
    el('detail').textContent = `${data.item.name || data.item.type}\n확인된 옵션 ${data.item.filters.length}개 · 비교 매물 ${data.total}개\n${data.prices.length ? '엑잘 환산 매물: ' + data.prices.map(money).join(', ') : '환산 가능한 매물이 없습니다.'}\n${data.item.unmatched.length ? '검색에 포함되지 않은 수치 줄: ' + data.item.unmatched.join(' / ') : ''}\n${data.skippedCurrencies?.length ? '환율이 없어 제외한 화폐: ' + data.skippedCurrencies.join(', ') : ''}`;
    const button = document.createElement('button'); button.textContent = '공식 거래 사이트에서 비교'; button.onclick = () => window.poe.open(data.url).catch(error => { el('status').textContent = error.message; }); el('detail').append(document.createElement('br'), button);
  } catch (error) { el('detail').textContent = error.message; }
  finally { el('item').disabled = false; }
};
