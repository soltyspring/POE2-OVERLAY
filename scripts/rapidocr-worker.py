import contextlib
import json
import os
import sys
import time

os.environ.setdefault('OMP_NUM_THREADS', '2')
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
with contextlib.redirect_stdout(sys.stderr):
    import psutil
    import cv2
    from rapidocr import RapidOCR, LangRec, ModelType, OCRVersion
    cv2.setNumThreads(2)
    engine = RapidOCR(params={
        'Det.model_type': ModelType.MOBILE,
        'Det.ocr_version': OCRVersion.PPOCRV4,
        'Rec.lang_type': LangRec.KOREAN,
        'Rec.model_type': ModelType.MOBILE,
        'Rec.ocr_version': OCRVersion.PPOCRV5,
        'Global.use_cls': False,
        'EngineConfig.onnxruntime.intra_op_num_threads': 2,
        'EngineConfig.onnxruntime.inter_op_num_threads': 1,
    })
process = psutil.Process()
for request in sys.stdin:
    try:
        data = json.loads(request)
        before = process.cpu_times()
        started = time.perf_counter()
        with contextlib.redirect_stdout(sys.stderr):
            result = engine(data['path'])
        lines = []
        if result.txts is not None:
            for box, text, score in zip(result.boxes, result.txts, result.scores):
                if score >= .65:
                    lines.append({'text': text, 'x': float(min(p[0] for p in box)), 'y': float(min(p[1] for p in box))})
        after = process.cpu_times()
        response = {'lines': lines, 'metrics': {'engine': 'RapidOCR Korean mobile CPU',
            'ocrMs': round((time.perf_counter()-started)*1000),
            'cpuMs': round((after.user+after.system-before.user-before.system)*1000),
            'rssMB': round(process.memory_info().rss/1048576,1)}}
    except Exception as error:
        response = {'error': str(error)}
    print(json.dumps(response, ensure_ascii=False), flush=True)
