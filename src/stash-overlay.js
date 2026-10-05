const container=document.getElementById('slots');
const money=value=>Number(value).toLocaleString('ko-KR',{maximumFractionDigits:3});
window.stashOverlay.onItems(items=>{
  container.replaceChildren();
  for(const item of items){
    const tag=document.createElement('span');tag.className='price-tag';
    tag.style.left=`${item.x}px`;tag.style.top=`${item.y}px`;
    tag.textContent=`${money(item.totalEx)} ex`;
    tag.title=`${item.name} × ${item.stackSize} · 개당 ${money(item.unitEx)} ex · ${item.league} · ${item.source} · ${item.updatedAt||'시각 정보 없음'}`;
    container.append(tag);
  }
});
