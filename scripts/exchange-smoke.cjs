const {Market} = require('../src/market.cjs');
(async()=>{
  const exchangeUrl=process.argv[2] || process.env.POE_EXCHANGE_URL;
  if (!exchangeUrl) throw new Error('Usage: node scripts/exchange-smoke.cjs <서버 주소> [리그]');
  const league=process.argv[3] || 'Standard';
  const market=new Market({exchangeUrl});
  const start=Date.now();
  const result=await market.loadExchange(league);
  console.log(JSON.stringify({league,requestMs:Date.now()-start,prices:result.prices.size,source:result.priceSource,updatedAt:result.updatedAt,warnings:result.warnings},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
