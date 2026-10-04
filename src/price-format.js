// Display rules follow POE2-Exchange/frontend/src/marketDisplay.tsx.
const priceScales=[{divisor:1,suffix:''},{divisor:1e3,suffix:'K'},{divisor:1e6,suffix:'M'},{divisor:1e9,suffix:'B'}];
const priceFormatters=Array.from({length:13},(_,digits)=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:digits}));
function formatPrice(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  const scales=priceScales;
  const digits=n=>n===0?0:Math.min(12,Math.max(0,3-Math.floor(Math.log10(Math.abs(n)))-1));
  let i=value>=1e9?3:value>=1e6?2:value>=1e3?1:0;
  while(i<3){const n=value/scales[i].divisor,factor=10**digits(n);if(Math.round((n+Number.EPSILON)*factor)/factor<1000)break;i++;}
  const n=value/scales[i].divisor;
  return priceFormatters[digits(n)].format(n)+scales[i].suffix;
}
if(typeof module!=='undefined')module.exports={formatPrice};
