import json, os, re
from pathlib import Path
import cv2

ROOT = Path(__file__).resolve().parent.parent
WORK = Path(os.environ.get('RUNEHELPER_ML', '~/.cache/poe2-overlay-ocr')).expanduser()
LANGUAGE = type('Language', (), {'code':'ko','font':'', 'font_index':0,'extra':'BASIC + LATIN'})()
COMBINATIONS = ROOT / 'runeshape-combinations.json'
MODEL = ROOT / 'runehelper-ko-model.bin'
TESTS = ROOT.parent.parent / 'test' / 'fixtures'
PANELS = TESTS
TRUTH = TESTS
REAL = WORK / 'ko' / 'real'
FONT = Path(r'C:/Windows/Fonts/NotoSansKR-VF.ttf')
LATIN_FONT = None
MIN_CONFIDENCE = 80.0
SCENES = ('clean','dim','uhd','busy','narrow')
QUANTITY = re.compile(r"^\s*[0-9iIl|!OoS]{1,2}[xXnw]\s+")
BARE_QUANTITY = re.compile(r"^\s*\d{1,3}\s+(?=\D)")
BRACKETED_QUANTITY = re.compile(r"\s*\(\d{1,3}\)\s*$")
TRAILING_QUANTITY = re.compile(r"\s+[xX]\d{1,3}\s*$")
TRUTH_ROW = re.compile(r'(?:text="(.*?)" )?qty=(\d+) name="(.*)"')
DEBUG_READING = 'trimmed: '

def checkpoint(tag): return WORK / f'{tag}.pt'
def combinations(): return json.loads(COMBINATIONS.read_text(encoding='utf-8'))['combinations']
def localized_names(): return [entry.get('names',{}).get('ko','') for entry in combinations()]
def vocabulary_charset():
    extras = "0123456789xX ()-,:.'스킬 레벨 고유 희귀한 아이템 미가공 젬 정신력 무작위 화폐 개"
    return ''.join(sorted(set(''.join(localized_names()) + extras)))
CHARSET = vocabulary_charset()
def encode(text, charset=None):
    charset=charset or CHARSET
    return [charset.index(c)+1 for c in text if c in charset]
def unquantified(name): return name.startswith('스킬 레벨') or any(w in name.split() for w in ('고유',))
def displayed(quantity,name): return name if unquantified(name) else f'{quantity}x {name}'
def load_vocabulary():
    return sorted(set(localized_names()))
def load_truth(path):
    rows=[]
    with open(path,encoding='utf-8') as f:
        for line in f:
            m=TRUTH_ROW.search(line)
            if m:
                text,q,name=m.groups(); rows.append((text,int(q),name))
    return rows
def read_debug_text(path): return ''
def load_real(scene,labelled=True):
    folder=REAL/scene; rows=[]
    with open(folder/'labels.tsv',encoding='utf-8') as f:
        for line in f:
            name,label=(line.rstrip('\\n').split('\\t')+['',''])[:2]
            if labelled and not label: continue
            rows.append((name,cv2.imread(str(folder/name),cv2.IMREAD_GRAYSCALE),label))
    return rows
def has_real(): return all((REAL/s/'labels.tsv').exists() for s in SCENES)
def panel_of(name): return name.rsplit('_row',1)[0]
def squash(text): return ''.join(c for c in text.lower() if c.isalnum())
def expected_name(label):
    name=BARE_QUANTITY.sub('',QUANTITY.sub('',label))
    return TRAILING_QUANTITY.sub('',BRACKETED_QUANTITY.sub('',name)).strip()
def levenshtein(a,b):
    prev=list(range(len(b)+1))
    for i,ca in enumerate(a,1):
        cur=[i]
        for j,cb in enumerate(b,1): cur.append(min(prev[j]+1,cur[j-1]+1,prev[j-1]+(ca!=cb)))
        prev=cur
    return prev[-1]
class Matcher:
    def __init__(self): self.names=load_vocabulary(); self.squashed=[squash(n) for n in self.names]
    def best(self,text):
        target=squash(expected_name(text)); best=None; best_d=None
        for orig,cand in zip(self.names,self.squashed):
            limit=max(len(cand),len(target))*18//100
            if abs(len(cand)-len(target))>limit: continue
            d=levenshtein(target,cand)
            if d<=limit and (best_d is None or d<best_d): best,best_d=orig,d
        return best



