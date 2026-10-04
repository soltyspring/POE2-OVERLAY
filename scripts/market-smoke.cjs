const { Market } = require('../src/market.cjs');
const { scanLines } = require('../src/core.cjs');
(async () => {
  const data = await new Market().load('Standard');
  const rows = scanLines([{ text: '카오스 오브', x: 20, y: 50 }, { text: '신성한 오브', x: 20, y: 100 }], data.catalog, data.prices);
  if (rows.length !== 2 || rows.some(row => !(row.totalEx > 0))) throw new Error('Live price/catalog mapping failed');
  console.log(JSON.stringify({ catalogEntries: data.catalog.length, prices: data.prices.size, rows, warnings: data.warnings }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
