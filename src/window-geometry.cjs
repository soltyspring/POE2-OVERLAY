const fs=require('node:fs');
const path=require('node:path');
function restoreGeometry(saved,areas){
  if(!saved||!['x','y','width','height'].every(k=>Number.isFinite(saved[k])))return {width:530,height:760};
  const bounds={x:Math.round(saved.x),y:Math.round(saved.y),width:Math.max(450,Math.round(saved.width)),height:Math.max(400,Math.round(saved.height))};
  const overlap=area=>Math.max(0,Math.min(bounds.x+bounds.width,area.x+area.width)-Math.max(bounds.x,area.x))*Math.max(0,Math.min(bounds.y+bounds.height,area.y+area.height)-Math.max(bounds.y,area.y));
  const area=[...areas].sort((a,b)=>overlap(b)-overlap(a))[0];
  if(!area)return {width:530,height:760};
  bounds.width=Math.min(bounds.width,area.width);bounds.height=Math.min(bounds.height,area.height);
  bounds.x=Math.max(area.x,Math.min(bounds.x,area.x+area.width-bounds.width));
  bounds.y=Math.max(area.y,Math.min(bounds.y,area.y+area.height-bounds.height));
  return bounds;
}
function readGeometry(file,areas){try{return restoreGeometry(JSON.parse(fs.readFileSync(file,'utf8')),areas);}catch{return restoreGeometry(null,areas);}}
function saveGeometry(file,bounds){
  try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(bounds));fs.renameSync(file+'.tmp',file);}catch(error){console.error('Window position save:',error.message);}
}
module.exports={restoreGeometry,readGeometry,saveGeometry};
