const { execFile } = require('node:child_process');
const path = require('node:path');
const { Market } = require('../src/market.cjs');
const { scanLines } = require('../src/core.cjs');
(async () => {
  const image = process.argv[2];
  if (!image) throw new Error('Usage: node scripts/runeshape-smoke.cjs <image.png>');
  const lines = await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'ocr.ps1'),'-ImagePath',path.resolve(image)], {windowsHide:true,timeout:45000,encoding:'utf8'}, (error,stdout,stderr) => {
    if (error) return reject(new Error(stderr || error.message));
    try { resolve(JSON.parse(stdout.replace(/^\uFEFF/,''))); } catch(error) { reject(error); }
  }));
  const data = await new Market().load(process.argv[3] || 'Standard');
  const rows = scanLines(lines, data.catalog, data.prices);
  if (rows.length !== 6 || rows.some(row => !(row.totalEx > 0))) throw new Error('Expected six priced reward rows');
  console.log(JSON.stringify({rows:rows.map(({name,count,unitEx,totalEx}) => ({name,count,unitEx,totalEx})),warnings:data.warnings},null,2));
})().catch(error => { console.error(error.message); process.exitCode=1; });
