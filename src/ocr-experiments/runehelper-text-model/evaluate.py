import argparse, json, struct, sys, time
from pathlib import Path
import cv2, numpy as np, torch
from model import Net, read as model_read

HERE=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import CHARSET, combinations, squash, expected_name, levenshtein

def load_model(path):
 data=Path(path).read_bytes(); offset=8
 height,=struct.unpack_from('<I',data,offset);offset+=4
 count,=struct.unpack_from('<I',data,offset);offset+=4
 charset=[]
 for _ in range(count):
  size=data[offset];offset+=1;charset.append(data[offset:offset+size].decode('utf-8'));offset+=size
 layer_count,=struct.unpack_from('<I',data,offset);offset+=4
 net=Net(count+1); convs=[m for m in [*net.features,*net.sequence] if isinstance(m,(torch.nn.Conv1d,torch.nn.Conv2d))]+[net.classifier]
 state=net.state_dict(); keys=[]
 for key in state:
  if key.endswith('.weight') and key.split('.')[0].isdigit(): keys.append(key)
 # Explicitly pair conv layers and adjacent batch norms. Exported weights are BN-folded.
 convs_with_keys=[]
 for name,module in net.features.named_children():
  if isinstance(module,(torch.nn.Conv1d,torch.nn.Conv2d)): convs_with_keys.append((f'features.{name}.weight',f'features.{int(name)+1}.weight',f'features.{int(name)+1}.bias'))
 for name,module in net.sequence.named_children():
  if isinstance(module,(torch.nn.Conv1d,torch.nn.Conv2d)): convs_with_keys.append((f'sequence.{name}.weight',f'sequence.{int(name)+1}.weight',f'sequence.{int(name)+1}.bias'))
 convs_with_keys.append(('classifier.weight',None,'classifier.bias'))
 for li in range(layer_count):
  shape=struct.unpack_from('<4I',data,offset);offset+=16
  pad=struct.unpack_from('<5I',data,offset);offset+=20
  o,i,kh,kw=shape;n=o*i*kh*kw
  weight=torch.frombuffer(bytearray(data[offset:offset+n*4]),dtype=torch.float32).clone().reshape(shape);offset+=n*4
  bias=torch.frombuffer(bytearray(data[offset:offset+o*4]),dtype=torch.float32).clone();offset+=o*4
  wk,bwk,bbk=convs_with_keys[li]
  if wk=='classifier.weight': weight=weight.reshape(o,i,1)
  elif wk.startswith('sequence.'): weight=weight.reshape(o,i,kw)
  state[wk]=weight; state[bbk]=bias
  if bwk is not None:
   state[bwk].fill_(1.0);state[bbk].zero_()
 net.load_state_dict(state);net.charset=''.join(charset);net.eval();return net

def read(net,gray):
 # The RuneShape model was trained on pale parchment text over a dark rune tile panel.
 # PoE ground drops use dark glyphs on light panels, so invert foreground polarity.
 return model_read(net,torch.device('cpu'),255-gray)

def closest(text,names):
 target=squash(expected_name(text));best=None;dist=None
 for name in names:
  candidate=squash(name);limit=max(len(candidate),len(target))*18//100
  if abs(len(candidate)-len(target))>limit:continue
  d=levenshtein(target,candidate)
  if d<=limit and (dist is None or d<dist):best,dist=name,d
 return best

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--images',default=str(Path.home()/'AppData/Local/Temp'));ap.add_argument('--fixtures',default=str(HERE.parent.parent/'test/fixtures/ocr-ground-truth.json'));ap.add_argument('--model',default=str(HERE/'runehelper-ko-model.bin'));ap.add_argument('--out',default=str(HERE/'baseline.json'));args=ap.parse_args()
 truth=json.loads(Path(args.fixtures).read_text(encoding='utf-8'));names=sorted({e.get('names',{}).get('ko','') for e in combinations() if e.get('names',{}).get('ko','')})
 net=load_model(args.model);results=[];started=time.perf_counter()
 for entry in truth['images']:
  path=Path(args.images)/f"codex-clipboard-{entry['id']}.png"
  if not path.exists():results.append({'id':entry['id'],'error':'missing'});continue
  image=cv2.imread(str(path),cv2.IMREAD_COLOR);h,w=image.shape[:2];matches=[]; exact=[];miss=[]
  count_ok=0
  for label in entry.get('labels',[]):
   nx,ny,nw,nh=label['box'];x,y,cw,ch=round(nx*w),round(ny*h),round(nw*w),round(nh*h)
   crop=image[max(0,y-10):min(h,y+ch+10),max(0,x-12):min(w,x+cw+12)]
   gray=cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY)
   text,confidence=read(net,gray)
   if not text.strip() or confidence < 80:
    pred=None
   else:
    pred=closest(text,names)
   qty=1
   import re
   q=re.match(r'^\s*([0-9]{1,2})\s*[xX]?\s+',text)
   if q: qty=int(q.group(1))
   elif text.startswith(('상위','화폐','스킬')): qty=1
   target_count=int(label.get('count',1))
   if pred==label['name'] and qty==target_count:count_ok+=1
   if pred==label['name']:matches.append(label['name'])
   exact.append(text==label['name'])
   if pred!=label['name']:miss.append({'truth':label['name'],'text':text,'candidate':pred,'confidence':round(confidence,1),'count':label.get('count',1)})
  results.append({'id':entry['id'],'scene':entry['scene'],'expected':len(entry.get('labels',[])),'matched':len(matches),'countCorrect':count_ok,'exact':sum(exact),'misses':miss})
  Path(args.out).write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
  print(entry['id'],entry['scene'],len(matches),'/',len(entry.get('labels',[])))
 print('TOTAL',sum(x.get('matched',0) for x in results),'/',sum(x.get('expected',0) for x in results),'count',sum(x.get('countCorrect',0) for x in results),'seconds',round(time.perf_counter()-started,2))
if __name__=='__main__':main()
