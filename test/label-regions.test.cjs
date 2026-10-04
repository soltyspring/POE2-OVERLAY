const test=require('node:test'),assert=require('node:assert/strict');
const {labelRegions,packLabels,restoreLines}=require('../src/label-regions.cjs');
test('Dark-background text regions pack and retain original screen coordinates',()=>{
  const size={width:300,height:200},pixels=Buffer.alloc(300*200*4);
  for(let y=50;y<67;y++)for(let x=60;x<145;x++){if(x%10>3)continue;const i=(y*300+x)*4;pixels[i]=220;pixels[i+1]=100;pixels[i+2]=80;pixels[i+3]=255;}
  const regions=labelRegions(pixels,size);assert.equal(regions.length,1);
  const packed=packLabels(pixels,size,regions);assert.ok(packed);assert.ok(packed.width*packed.height<300*200);
  const placement=packed.placements[0];
  const mapped=restoreLines([{text:'아이템',x:placement.packedX+3,y:placement.packedY+4,width:80,height:20}],packed.placements);
  assert.equal(mapped[0].x,placement.x+3);assert.equal(mapped[0].y,placement.y+4);assert.equal(mapped[0].width,80);
  assert.equal(restoreLines([{text:'잡음',x:0,y:0}],packed.placements).length,0);
});
test('Empty or excessive candidates use full-frame fallback without packing',()=>{
  const size={width:100,height:100},pixels=Buffer.alloc(40000);
  assert.deepEqual(labelRegions(pixels,size),[]);assert.equal(packLabels(pixels,size,[]),null);
  assert.equal(packLabels(pixels,size,Array(49).fill({x:0,y:0,width:60,height:30})),null);
});
