const fs=require('node:fs/promises');
const path=require('node:path');
// Colors are recognition hints, never evidence of rarity or value.
function parseFilter(text){
  const colors=new Map();
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*SetTextColor\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+))?\s*(?:#.*)?$/);
    if(!match)continue;
    const rgb=match.slice(1,4).map(Number),alpha=Number(match[4]??255);
    if(rgb.some(v=>v>255)||alpha>255||alpha===0)continue;
    colors.set(rgb.join(','),rgb);
  }
  return [...colors.values()];
}
function parseStyle(text){
  const style={text:parseFilter(text),background:[],border:[],fontSizes:[]};
  for(const line of text.split(/\r?\n/)){
    const color=line.match(/^\s*Set(Background|Border)Color\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+))?/);
    if(color){const rgba=color.slice(2).map(v=>Number(v??255));if(rgba.every(v=>v>=0&&v<=255))style[color[1].toLowerCase()].push(rgba);}
    const font=line.match(/^\s*SetFontSize\s+(\d+)/);if(font&&Number(font[1])>=18&&Number(font[1])<=45)style.fontSizes.push(Number(font[1]));
  }
  style.fontSizes=[...new Set(style.fontSizes)];return style;
}
class FilterProfile{
  constructor(directory){this.directory=directory;this.checked=0;this.colors=[];this.signature='';}
  async load(){
    if(Date.now()-this.checked<5000)return this.colors;
    this.checked=Date.now();
    try{
      const config=await fs.readFile(path.join(this.directory,'poe2_production_Config.ini'),'utf8');
      const name=config.match(/^item_filter=(.+)$/m)?.[1].trim();
      if(!name||name!==path.basename(name)){this.colors=[];this.signature='';return this.colors;}
      const candidates=[path.join(this.directory,'OnlineFilters',name),path.join(this.directory,name.endsWith('.filter')?name:name+'.filter')];
      let found=false;
      for(const file of candidates){
        try{
          const stat=await fs.stat(file),signature=file+':'+stat.mtimeMs+':'+stat.size;
          if(signature!==this.signature){this.style=parseStyle(await fs.readFile(file,'utf8'));this.colors=this.style.text;this.signature=signature;}
          found=true;break;
        }catch(error){if(error.code!=='ENOENT')throw error;}
      }
      if(!found){this.colors=[];this.signature='';}
    }catch{this.colors=[];this.signature='';}
    return this.colors;
  }
}
module.exports={parseFilter,parseStyle,FilterProfile};
