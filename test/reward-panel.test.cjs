const test=require('node:test'),assert=require('node:assert/strict');
const {rewardPanel}=require('../src/reward-panel.cjs');
const {scanLines}=require('../src/core.cjs');
test('밝은 양피지 영역만 찾고 어두운 게임 화면은 제외한다',()=>{
 const size={width:1024,height:768},pixels=Buffer.alloc(size.width*size.height*4);
 assert.equal(rewardPanel(pixels,size),null);
 for(let y=40;y<600;y++)for(let x=20;x<650;x++){const i=(y*size.width+x)*4;pixels[i]=140;pixels[i+1]=165;pixels[i+2]=180;pixels[i+3]=255;}
 const panel=rewardPanel(pixels,size);assert.ok(panel);assert.ok(panel.width>=600);assert.ok(panel.height>=550);
});
test('실제 룬 조합 OCR에서 생략된 룬 접미어와 보상 수량을 복구한다',()=>{
 const catalog=['맹렬한 유동체','하위 왕성 룬','하위 사막 룬','대장장이의 숫돌'].map((name,id)=>({name,id:String(id),kind:'commodity',category:name.includes('룬')?'Runes':'Currency'}));
 const lines=['lx 맹렬한 유동체','1)( 하위 왕성','1)( 하위 사막','2x 대장장이의 숫돌'].map((text,y)=>({text,x:10,y:y*60}));
 const rows=scanLines(lines,catalog,new Map());assert.equal(rows.length,4);assert.equal(rows[3].count,2);assert.equal(rows[1].name,'하위 왕성 룬');
});
