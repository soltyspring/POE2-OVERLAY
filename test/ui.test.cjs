const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
function setup(){
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost'});
  const events={},opened=[];
  dom.window.poe={onHealth:cb=>events.health=cb,onRows:cb=>events.rows=cb,onAuto:cb=>events.auto=cb,onBusy:cb=>events.busy=cb,onStatus:cb=>events.status=cb,onMetrics:cb=>events.metrics=cb,
    auto:async()=>{},options:async()=>{},league:async()=>{},scan:async()=>{},item:async()=>{},open:async url=>opened.push(url)};
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../src/price-format.js'),'utf8'));
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'));
  return {dom,events,opened,document:dom.window.document};
}
const priced={key:'a',name:'카오스 오브',count:3,totalEx:12,totalDivine:0.01234,unitEx:4,status:'참고 시세',kind:'commodity',candidates:[],url:'https://www.pathofexile.com/trade2/search/Standard/test'};
const unknown={key:'b',name:'무거운 허리띠',count:1,totalEx:null,unitEx:null,status:'확인 필요',kind:'candidate',candidates:['A']};
function payload(rows){return {rows,league:'Standard',priceSource:'테스트',updatedAt:null,warnings:[]};}
test('같은 결과 갱신 시 행·버튼을 재사용하며 클릭 포커스가 유지된다',()=>{
  const {dom,events,document,opened}=setup();
  events.rows(payload([priced,unknown]));
  const first=document.querySelector('.row'),button=first.querySelector('button');button.focus();
  events.rows(payload([{...priced}, {...unknown}]));
  assert.equal(document.querySelector('.row'),first);assert.equal(document.activeElement,button);
  button.click();assert.equal(opened[0],priced.url);
  assert.equal(document.getElementById('found').textContent,'2');assert.equal(document.getElementById('priced').textContent,'1');
  dom.window.close();
});
test('검색·확인 필요 필터·변경된 가격·삭제된 아이템을 처리한다',()=>{
  const {dom,events,document}=setup();events.rows(payload([priced,unknown]));
  const filter=document.getElementById('filter');filter.value='unknown';filter.onchange();
  assert.equal(document.querySelectorAll('.row').length,1);assert.match(document.querySelector('.row strong').textContent,/허리띠/);
  filter.value='all';filter.onchange();
  events.rows(payload([{...priced,totalEx:24,unitEx:8}]));
  assert.equal(document.querySelectorAll('.row').length,1);assert.equal(document.querySelector('.price>span').textContent,'24 엑잘');assert.equal(document.querySelector('.divine-price').textContent,'0.0123 신성');
  const search=document.getElementById('search');search.value='다른 이름';search.oninput();
  assert.equal(document.querySelectorAll('.row').length,0);assert.match(document.querySelector('.empty').textContent,/맞는 아이템/);
  dom.window.close();
});
test('두 캡처 버튼만 제공하고 조회 중 잠근다',async()=>{
  const {dom,events,document}=setup();
  assert.equal(document.getElementById('league'),null);assert.equal(document.getElementById('auto'),null);
  events.busy(true);assert.equal(document.getElementById('activity').classList.contains('loading'),true);assert.equal(document.getElementById('activity').getAttribute('aria-label'),'갱신 중');assert.equal(document.getElementById('meta'),null);assert.equal(document.getElementById('scan').disabled,true);assert.equal(document.getElementById('mouse').disabled,true);
  events.health('error');assert.equal(document.getElementById('activity').classList.contains('error'),true);events.health('ready');assert.equal(document.getElementById('activity').classList.contains('error'),false);events.busy(false);assert.equal(document.getElementById('activity').classList.contains('loading'),false);assert.equal(document.getElementById('activity').getAttribute('aria-label'),'대기 중');const modes=[];dom.window.poe.scan=async mode=>modes.push(mode);
  await document.getElementById('scan').onclick();await document.getElementById('mouse').onclick();assert.deepEqual(modes,['full','mouse']);dom.window.close();
});
