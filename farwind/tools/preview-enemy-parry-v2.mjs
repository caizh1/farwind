import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const cells=[];
for(const [row,kind] of ['slime','leaf'].entries())for(const [column,frame] of [1,2,2,3,0].entries())cells.push({input:await sharp(`public/assets/${kind}.png`).extract({left:frame*128,top:0,width:128,height:128}).resize(75,75).png().toBuffer(),left:column*170+50,top:row*170+64});
const labels=[['史莱姆：压低蓄力','锁向与蹬起','冲顶：真实前冲34像素','落地回弹／被弹偏倒','恢复就绪'],['叶灵：蓄势','锁定叶刃方向','小步12像素＋叶刃扫掠','挥击拨偏／躯干失衡','恢复就绪']];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="850" height="340"><rect width="850" height="340" fill="#e7e4d6"/><g font-family="sans-serif" font-size="12" fill="#263c36">${labels.flatMap((row,r)=>row.map((label,c)=>`<text x="${c*170+8}" y="${r*170+27}">${label}</text><path d="M${c*170+20} ${r*170+141}H${c*170+155}" stroke="#7b857a"/><circle cx="${c*170+87.5}" cy="${r*170+139}" r="2" fill="#b2593c"/>`)).join('')}<text x="8" y="330">固定75像素显示尺寸与地面根；阶段采样示意，不作为实机或手感通过证据。</text></g></svg>`;
await sharp(Buffer.from(svg)).composite(cells).png().toFile('docs/parry-v2/assets/enemy-design.png');
await writeFile('docs/parry-v2/assets/enemy-design.md','# 敌人攻击动作设计图\n\n上排史莱姆，下排叶灵。复用现有四帧身体图，配合正式阶段采样的前冲、叶刃几何、表现偏移和被弹旋转，不逐帧缩放角色。叶刃与物理根的实际关系以及失衡持续过程以正常速度运行录像为准，静态设计图不代替实机验收。\n');
