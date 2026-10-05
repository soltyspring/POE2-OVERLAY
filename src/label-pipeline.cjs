const {labelRegions}=require('./label-regions.cjs');
const {isolateLabels}=require('./ocr-bitmap.cjs');
const {scanLines}=require('./core.cjs');
const {backgroundRegions}=require('./label-backgrounds.cjs');
function prepareLabel(pixels,size,box,colors=[]){
  const buffer=Buffer.alloc(box.width*box.height*4),samples=[];
  for(let y=0;y<box.height;y++){
    const start=((box.y+y)*size.width+box.x)*4;
    pixels.copy(buffer,y*box.width*4,start,start+box.width*4);
    for(let x=0;x<box.width;x+=4)if(y<4||y>=box.height-4){const i=(y*box.width+x)*4;samples.push((buffer[i]+buffer[i+1]+buffer[i+2])/3);}
  }
  samples.sort((a,b)=>a-b);
  const background=samples[Math.floor(samples.length/2)]||0;
  // Bright labels retain dark glyphs. Dark labels use the known contrast path.
  return {buffer:background>100?buffer:isolateLabels(buffer,{width:box.width,height:box.height},colors),mode:background>100?'original':'contrast',...box};
}
function sheet(labels){
  const padding=16,width=Math.max(...labels.map(l=>l.width))+padding*2;
  const height=labels.reduce((sum,l)=>sum+l.height+padding*2,0);
  const buffer=Buffer.alloc(width*height*4,255),placements=[];let top=0;
  for(const label of labels){
    for(let y=0;y<label.height;y++)label.buffer.copy(buffer,((top+padding+y)*width+padding)*4,y*label.width*4,(y+1)*label.width*4);
    placements.push({...label,buffer:undefined,packedX:padding,packedY:top+padding});top+=label.height+padding*2;
  }
  return {buffer,width,height,placements};
}
function mapLines(lines,placements){
  return lines.flatMap(line=>{
    const box=placements.find(b=>line.y>=b.packedY-2&&line.y+line.height<=b.packedY+b.height+4&&line.x>=b.packedX-4&&line.x<b.packedX+b.width);
    return box?[{...line,x:line.x-box.packedX+box.x,y:line.y-box.packedY+box.y,regionId:box.id,regionValidated:true}]:[];
  });
}
function upscale(pixels,size){
  const width=size.width*2,height=size.height*2,buffer=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const source=(Math.floor(y/2)*size.width+Math.floor(x/2))*4,target=(y*width+x)*4;
    pixels.copy(buffer,target,source,source+4);
  }
  return {buffer,width,height};
}
async function recognizeLabels(pixels,size,catalog,recognize,colors=[]){
  const started=Date.now(),backgrounds=backgroundRegions(pixels,size);
  const glyphs=labelRegions(pixels,size,{adaptive:true}).filter(box=>!backgrounds.some(bg=>box.x>=bg.x-8&&box.y>=bg.y-8&&box.x+box.width<=bg.x+bg.width+8&&box.y+box.height<=bg.y+bg.height+8));
  const boxes=[...backgrounds,...glyphs].slice(0,48).map((box,id)=>({...box,id}));
  const prepared=boxes.map(box=>prepareLabel(pixels,size,box,colors));
  const groups=[];let group=[],height=0;
  for(const label of prepared){
    if(height+label.height+32>1200&&group.length){groups.push(group);group=[];height=0;}
    group.push(label);height+=label.height+32;
  }
  if(group.length)groups.push(group);
  const lines=[];const metrics={regions:boxes.length,ocrMs:0,cpuMs:0,rssMB:0,retries:0,ocrPixels:0};
  const add=response=>{metrics.ocrMs+=response.metrics.ocrMs||0;metrics.cpuMs+=response.metrics.cpuMs||0;metrics.rssMB=Math.max(metrics.rssMB,response.metrics.rssMB||0);};
  for(const group of groups){
    const packed=sheet(group),enlarged=upscale(packed.buffer,packed),response=await recognize(enlarged.buffer,enlarged);
    add(response);metrics.ocrPixels+=enlarged.width*enlarged.height;lines.push(...mapLines(response.lines.map(l=>({...l,x:l.x/2,y:l.y/2,width:l.width/2,height:l.height/2})),packed.placements));
  }
  const recognized=new Set(scanLines(lines,catalog,new Map()).map(row=>lines.find(l=>l.x===row.x&&l.y===row.y)?.regionId));
  for(const label of prepared.filter(l=>!recognized.has(l.id)).slice(0,4)){
    const enlarged=upscale(label.buffer,label),packed=sheet([{...label,width:enlarged.width,height:enlarged.height,buffer:enlarged.buffer}]);
    const response=await recognize(packed.buffer,packed);add(response);metrics.retries++;metrics.ocrPixels+=packed.width*packed.height;
    const mapped=mapLines(response.lines,packed.placements).map(l=>({...l,x:label.x+(l.x-label.x)/2,y:label.y+(l.y-label.y)/2,width:l.width/2,height:l.height/2}));
    if(scanLines(mapped,catalog,new Map()).length){for(let i=lines.length-1;i>=0;i--)if(lines[i].regionId===label.id)lines.splice(i,1);lines.push(...mapped);}
  }
  metrics.totalMs=Date.now()-started;
  return {lines,metrics};
}
module.exports={prepareLabel,sheet,mapLines,recognizeLabels};
