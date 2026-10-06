// 仅生成独立验收的初始存档，不读取或改写浏览器中的用户旅途。
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {initialState,validate,add}=await server.ssrLoadModule('/src/game/systems/state.ts');
 const {initialBossBattle}=await server.ssrLoadModule('/src/game/systems/campBossState.ts');
 const {ENCOUNTERS}=await server.ssrLoadModule('/src/data/maps/windbell/encounters.ts');
 const {syncMapGeometry}=await server.ssrLoadModule('/src/data/world.ts');
 const {motionBlocked}=await server.ssrLoadModule('/src/game/systems/obstacles.ts');
 syncMapGeometry(false);
 const camp=ENCOUNTERS.find(d=>d.id==='east-thorn-camp'),boss=camp.members.find(m=>m.boss),out='docs/east-boss-motion-v2/fixtures';await mkdir(out,{recursive:true});
 const entries=[];
 for(const [name,phase,skill,hp,arriving] of [['arrival',1,-1,2500,true],['full-battle',1,-1,2500,false],['phase-two',2,-1,1300,false],['transform',1,-1,1300,false],['death',2,0,12,false],...Array.from({length:8},(_,d)=>['direction-'+d,1,0,2500,false]),...Array.from({length:7},(_,i)=>['skill-'+i,1,i,2500,false])]){
  const s=initialState();s.encounters.seed=287391;s.equipment.weapon='ironSword';s.equipment.armor='leatherCoat';add(s,'potion',48);s.quest=1;
  const direction=name.startsWith('direction-')?Number(name.split('-')[1]):null;const candidates=direction===null?[{x:boss.x,y:boss.y+160},{x:boss.x-160,y:boss.y},{x:boss.x+160,y:boss.y}]:[240,210,270,180].map(r=>({x:boss.x+Math.sin(direction*Math.PI/4)*r,y:boss.y+Math.cos(direction*Math.PI/4)*r}));const p=candidates.find(p=>!motionBlocked(p.x,p.y));if(!p)throw Error('样本出生位置受阻');Object.assign(s.player,p);
  const g=s.encounters.groups[camp.id];g.activated=true;
  for(const member of g.members)if(member.id!==boss.id)Object.assign(member,{hp:0,defeated:true,participated:true,drop:false,dropRemaining:0});else member.hp=hp;
  g.boss={stage:'battle',warning:0,attempt:1,away:0,combat:{battle:{...initialBossBattle(0,arriving),phase,move:skill,nextAt:arriving?2450:650},attack:null,hazards:[],shots:[],stagger:0,parried:null}};
  const clean=validate(s);await writeFile(`${out}/${name}.json`,JSON.stringify(clean));entries.push({文件:name+'.json',阶段:phase,起始招式:skill,首领生命:hp,玩家起点:p});
 }
 await writeFile(`${out}/README.md`,'# 独立实战验收样本\n\n这些文件仅设置初始条件，通过游戏正式导入入口载入独立端口。杂兵预先清除、装备与药剂预先配备，不代表正常旅途通关。导入后只使用正常键鼠操作，伤害、弹反、阶段、死亡与保存全部由正式系统结算。\n\n'+entries.map(e=>`- ${e.文件}：阶段 ${e.阶段}，起始招式 ${e.起始招式}，首领生命 ${e.首领生命}。`).join('\n')+'\n');console.log('已生成并通过正式存档校验的独立样本：',entries.length);
}finally{await server.close();}
