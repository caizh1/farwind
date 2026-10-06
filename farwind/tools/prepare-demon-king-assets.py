"""准备寂冠之王手绘材质与只读基准；原始设计图保持不变。"""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/demon-king-model-v1'
TEX = OUT / 'source/textures'
TEX.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(206)
size = 1024
reference = ROOT / 'docs/demon-king-design/demon-king-black-flame-v2.png'
reference_image=Image.open(reference).convert('RGB')
palette = {
    'stone': ((27, 30, 37), (67, 67, 72)),
    'bronze': ((54, 43, 31), (126, 108, 78)),
    'cloth': ((21, 25, 34), (43, 48, 63)),
    'seal': ((110, 103, 91), (170, 161, 140)),
}
labels = {'stone': '风蚀石甲', 'bronze': '旧古铜', 'cloth': '墨青布料', 'seal': '灰白封印'}
for name, (low, high) in palette.items():
    broad = Image.fromarray(rng.integers(0, 256, (32, 32), dtype=np.uint8)).resize((size, size), Image.Resampling.BICUBIC)
    fine = Image.fromarray(rng.integers(0, 256, (160, 160), dtype=np.uint8)).resize((size, size), Image.Resampling.BICUBIC)
    vertical = Image.fromarray(rng.integers(0, 256, (16, 256), dtype=np.uint8)).resize((size, size), Image.Resampling.BICUBIC)
    value = np.asarray(broad, dtype=float) / 255 * .81 + np.asarray(fine, dtype=float) / 255 * .14 + np.asarray(vertical, dtype=float) / 255 * .05
    y, x = np.mgrid[:size, :size]
    value += .008 * np.sin(x * .087 + y * .011) + rng.normal(0, .008, value.shape)
    if name in ['stone','cloth']:
        crop=(843,238,892,286) if name=='stone' else (838,586,902,677)
        brush=reference_image.crop(crop).convert('L').resize((size,size),Image.Resampling.BICUBIC)
        paint=np.asarray(brush,dtype=float)/255
        value=.65*np.clip(paint*2.2,0,1)+.35*value
    color = np.asarray(low) + (np.asarray(high) - np.asarray(low)) * np.clip(value, 0, 1)[..., None]
    Image.fromarray(np.uint8(color.clip(0, 255))).save(TEX / f'{name}-paint.png')
report = {'说明': '使用已确认的黑焰第二版作为唯一造型基准；石甲与布料提取原画局部笔触后限制到各自暗色范围，铜与旧封印使用确定性柔和底纹。',
          '原画路径': str(reference.relative_to(ROOT)), '原画摘要': hashlib.sha256(reference.read_bytes()).hexdigest(),
          '材质': [{'文件': f'{name}-paint.png', '用途': labels[name], '尺寸': [size, size]} for name in palette]}
(OUT / 'source/texture-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print('四张材质贴图与原画摘要已保存。')
