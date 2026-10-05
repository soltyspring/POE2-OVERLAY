import json, sys
from pathlib import Path
import cv2
from common import WORK

root=Path(__file__).resolve().parents[2]
truth=json.loads((root.parent/'test/fixtures/ocr-ground-truth.json').read_text(encoding='utf-8'))
image_dir=Path(sys.argv[1]) if len(sys.argv)>1 else Path.home()/'AppData/Local/Temp'
out=WORK/'ko'/'real'
out.mkdir(parents=True,exist_ok=True)
for scene in ('clean','dim','uhd','busy','narrow'):
 (out/scene).mkdir(parents=True,exist_ok=True)
with open(WORK/'ko'/'splits.json','w',encoding='utf-8') as f:
 json.dump({e['id']:('eval' if i%4==0 else 'train') for i,e in enumerate(truth['images'])},f)
for i,entry in enumerate(truth['images']):
 image_path=image_dir/f"codex-clipboard-{entry['id']}.png"
 if not image_path.exists(): continue
 image=cv2.imread(str(image_path));h,w=image.shape[:2]
 for j,label in enumerate(entry.get('labels',[])):
  nx,ny,nw,nh=label['box'];x,y,cw,ch=round(nx*w),round(ny*h),round(nw*w),round(nh*h)
  x0=max(0,x-12);y0=max(0,y-8);x1=min(w,x+cw+12);y1=min(h,y+ch+8)
  crop=image[y0:y1,x0:x1]
  # Remove surrounding scene while retaining the actual loot row and text.
  gray=cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY)
  scene=('clean','dim','uhd','busy','narrow')[i%5]
  name=f"{entry['id']}_row{j:02d}.png"
  cv2.imwrite(str(out/scene/name),gray)
  label_text=f"{label.get('count',1)}x {label['name']}" if label.get('count',1)>1 else label['name']
  with open(out/scene/'labels.tsv','a',encoding='utf-8') as f:f.write(f'{name}\t{label_text}\n')
print('crops ready',sum(1 for _ in out.glob('*/*.png')),'at',out)
