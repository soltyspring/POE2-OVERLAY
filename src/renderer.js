const el = id => document.getElementById(id);
const money = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
function updateMode() {el('mode').textContent=el('auto').checked?'자동 · '+Number(el('interval').value)/1000+'초':'수동 스캔';el('mode').classList.toggle('active',el('auto').checked);}
async function configure() {await window.poe.options({interval:Number(el('interval').value),area:el('area').value});updateMode();}
el('auto').onchange=async()=>{try {if(el('auto').checked)await configure();await window.poe.auto(el('auto').checked);updateMode();}catch(error){el('auto').checked=false;updateMode();el('status').textContent=error.message;}};
for(const id of ['interval','area']) el(id).onchange=()=>configure().catch(error=>{el('status').textContent=error.message;});
window.poe.onAuto(enabled=>{el('auto').checked=enabled;updateMode();});
window.poe.onBusy(busy => { for (const id of ['scan', 'item', 'league','interval','area']) el(id).disabled = busy;document.querySelector('.status-bar').classList.toggle('working',busy); });
window.poe.onStatus(text => { el('status').textContent = text; });
window.poe.onMetrics(data=>{el('metrics').textContent=`전체 처리 ${data.totalMs}ms · ${data.engine}\n${data.reused?'같은 화면 · OCR 생략':'OCR '+data.ocrMs+'ms'} · OCR 워커 ${data.rssMB}MB\n앱 전체 또는 게임의 자원 사용량은 포함하지 않습니다.`;});
let currentData=null;
const records=new Map();
const empty=document.createElement('p');empty.className='empty';
function renderRows() {
  if(!currentData)return;
  const query=el('search').value.replace(/\s+/g,'').toLowerCase();
  const filter=el('filter').value;
  const rows=currentData.rows.filter(row=>row.name.replace(/\s+/g,'').toLowerCase().includes(query) && (filter==='all' || (filter==='priced' ? row.totalEx!==null : row.totalEx===null)));
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
      record.price.textContent=row.totalEx===null?'확인 필요':money(row.totalEx)+' 엑잘';
      const label=row.priceKind==='candidate-minimum'?'고유 후보 최저 · ':['unique-minimum','gem-minimum'].includes(row.priceKind)?'조회 최저 · ':'';
      record.note.textContent=label+row.status+(row.kind==='candidate'?' · '+[...new Set(row.candidates)].slice(0,8).join(', '):row.unitEx!==null?' · 개당 '+money(row.unitEx)+' 엑잘':'');
      record.button.hidden=!row.url;
    }
    if(el('rows').children[i]!==record.article)el('rows').insertBefore(record.article,el('rows').children[i]||null);
  }
  const desiredNodes=new Set(rows.map(row=>records.get(row.key).article));
  for(const child of [...el('rows').children])if(!desiredNodes.has(child))child.remove();
  if(!rows.length){empty.textContent=currentData.rows.length?'검색·필터에 맞는 아이템이 없습니다.':'인식된 아이템이 없습니다. 라벨 표시와 인식 영역을 확인하세요.';el('rows').append(empty);}
}
el('search').oninput=renderRows;el('filter').onchange=renderRows;
window.poe.onRows(data => {
  currentData=data;
  const priced=data.rows.filter(row=>row.totalEx!==null);
  el('found').textContent=data.rows.length;el('priced').textContent=priced.length;
  el('highest').textContent=priced.length?money(Math.max(...priced.map(row=>row.totalEx)))+' 엑잘':'—';
  el('meta').textContent=`${data.priceSource||'시세'} · ${data.league}\n${data.updatedAt?new Date(data.updatedAt).toLocaleString('ko-KR')+' 기준':'시세 조회 실패'}${data.warnings.length?'\n'+data.warnings.join(' / '):''}`;
  renderRows();
});
el('scan').onclick = async () => { el('scan').disabled = true; try { await window.poe.league(el('league').value); await window.poe.scan(); } catch (error) { el('status').textContent = error.message; } finally { el('scan').disabled = false; } };
el('league').onchange = () => window.poe.league(el('league').value).catch(error => { el('status').textContent = error.message; });
el('item').onclick = async () => {
  el('item').disabled = true; el('detail').textContent = '거래 검색 중…';
  try {
    await window.poe.league(el('league').value);
    const data = await window.poe.item();
    el('detail').textContent = `${data.item.name || data.item.type}\n확인된 옵션 ${data.item.filters.length}개 · 비교 매물 ${data.total}개\n${data.prices.length ? '엑잘 환산 매물: ' + data.prices.map(money).join(', ') : '환산 가능한 매물이 없습니다.'}\n${data.item.unmatched.length ? '검색에 포함되지 않은 수치 줄: ' + data.item.unmatched.join(' / ') : ''}\n${data.skippedCurrencies?.length ? '환율이 없어 제외한 화폐: ' + data.skippedCurrencies.join(', ') : ''}`;
    const button = document.createElement('button'); button.textContent = '공식 거래 사이트에서 비교'; button.onclick = () => window.poe.open(data.url).catch(error => { el('status').textContent = error.message; }); el('detail').append(document.createElement('br'), button);
  } catch (error) { el('detail').textContent = error.message; }
  finally { el('item').disabled = false; }
};
