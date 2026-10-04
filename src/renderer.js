const el = id => document.getElementById(id);
const money = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
el('auto').onchange=async()=>{try {await window.poe.auto(el('auto').checked);}catch(error){el('auto').checked=false;el('status').textContent=error.message;}};
window.poe.onAuto(enabled=>{el('auto').checked=enabled;});
window.poe.onBusy(busy => { for (const id of ['scan', 'item', 'league']) el(id).disabled = busy; });
window.poe.onStatus(text => { el('status').textContent = text; });
window.poe.onRows(data => {
  el('rows').replaceChildren();
  el('meta').textContent = `${data.league} · ${data.rows.length}개 · ${data.priceSource || ''} · ${data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR') + ' 기준' : '시세 조회 실패'}${data.warnings.length ? '\n일부 시세 조회 실패: ' + data.warnings.join(' / ') : ''}`;
  if (!data.rows.length) { const p = document.createElement('p'); p.textContent = '사전과 정확히 일치하는 아이템이 없습니다. 라벨 겹침이나 OCR 오독을 확인하세요.'; el('rows').append(p); }
  for (const row of data.rows) {
    const article = document.createElement('article'); article.className = 'row';
    const name = document.createElement('strong'); name.textContent = `${row.name}${row.count > 1 ? ' ×' + row.count : ''}`;
    const price = document.createElement('span'); price.className = 'price'; price.textContent = row.totalEx === null ? '확인 필요' : `${row.priceKind === 'candidate-minimum' ? '후보 최저 ' : ['unique-minimum','gem-minimum'].includes(row.priceKind) ? '조회 최저 ' : ''}${money(row.totalEx)} 엑잘`;
    const note = document.createElement('small'); note.textContent = `${row.status} · ${row.totalEx === null || row.kind === 'candidate' ? [...new Set(row.candidates)].slice(0, 8).join(', ') : '개당 ' + money(row.unitEx) + ' 엑잘'} · 캡처 좌표 ${Math.round(row.x)}, ${Math.round(row.y)}`;
    article.append(name, price, note); el('rows').append(article);
    if (row.url) { const button = document.createElement('button'); button.textContent = '매물 비교'; button.onclick = () => window.poe.open(row.url).catch(error => { el('status').textContent = error.message; }); article.append(button); }
  }
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
