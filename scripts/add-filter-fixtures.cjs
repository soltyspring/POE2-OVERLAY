const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'../test/fixtures/ocr-ground-truth.json'),data=JSON.parse(fs.readFileSync(file,'utf8'));
const entries=[
 {id:'5ffd4ffd-b057-4d72-a123-a03103d97476',scene:'ground-filter-variants',labels:[
  {name:'황혼의 불침번 · 잿빛 지팡이',box:[.06,.16,.22,.10]},
  {name:'미가공 스킬 젬',box:[.26,.21,.19,.05]},
  {name:'미가공 보조 젬',box:[.48,.17,.20,.05]},
  {name:'확장의 오브',box:[.62,.21,.17,.06]},
  {name:'사막 룬',box:[.40,.26,.12,.05]},
  {name:'엑잘티드 오브',box:[.32,.30,.22,.06]},
  {name:'영감 룬',box:[.73,.30,.13,.06]},
  {name:'단지 유물 - 가시',box:[.38,.41,.24,.06]},
  {name:'황혼의 불침번 · 잿빛 지팡이',box:[.06,.55,.19,.10]},
  {name:'미가공 스킬 젬',box:[.26,.61,.20,.06]},
  {name:'미가공 보조 젬',box:[.47,.56,.20,.06]},
  {name:'확장의 오브',box:[.60,.62,.18,.05]},
  {name:'사막 룬',box:[.40,.66,.11,.06]},
  {name:'엑잘티드 오브',box:[.32,.71,.19,.05]},
  {name:'영감 룬',box:[.73,.70,.12,.06]},
  {name:'단지 유물 - 가시',box:[.38,.81,.22,.06]}
 ]},
 {id:'cdf295e7-db11-4235-9827-84cdc49992d5',scene:'ground-dense-small',labels:[
  {name:'바알 오브',box:[.39,.02,.13,.08]},
  {name:'경로석 (15등급)',box:[.42,.09,.19,.08]},
  {name:'소멸의 오브',box:[.40,.16,.17,.08]},
  {name:'기회의 오브',box:[.62,.17,.17,.08]},
  {name:'진 바리야',box:[.37,.24,.12,.08]},
  {name:'도마뱀비늘 장화',box:[.49,.25,.22,.08]},
  {name:'연금술의 오브',box:[.30,.32,.18,.08]},
  {name:'전문 이중시위 활',box:[.19,.39,.18,.08]},
  {name:'카오스 오브',box:[.54,.37,.16,.08]},
  {name:'미가공 스킬 젬',box:[.70,.37,.15,.08]},
  {name:'제왕의 오브',box:[.29,.46,.15,.08]},
  {name:'상위 쥬얼러 오브',box:[.52,.48,.22,.08]},
  {name:'선도자 서판',box:[.16,.54,.16,.08]},
  {name:'경로석 (13등급)',box:[.73,.54,.17,.08]},
  {name:'철 룬',box:[.14,.61,.07,.07]},
  {name:'세공사의 프리즘',box:[.31,.60,.19,.08]},
  {name:'경로석 (14등급)',box:[.57,.59,.18,.08]},
  {name:'신성한 오브',box:[.27,.67,.18,.08]},
  {name:'엑잘티드 오브',box:[.42,.67,.19,.08]},
  {name:'상급 극한의 마나 플라스크',box:[.28,.76,.27,.07]},
  {name:'복제된 영토 파편',box:[.78,.76,.18,.07]},
  {name:'격퇴자의 지식의 서 IV',box:[.34,.82,.24,.07]},
  {name:'상위 강화의 에센스',box:[.67,.82,.23,.08]},
  {name:'성배 단 유물',box:[.06,.88,.13,.09]},
  {name:'정제된 철망',box:[.42,.88,.16,.09]}
 ]}
];
for(const entry of entries){const index=data.images.findIndex(image=>image.id===entry.id);if(index<0)data.images.push(entry);else data.images[index]=entry;}
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
