import {it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {initialState} from '../src/game/systems/state';
import {completeWindLesson} from '../src/game/systems/skills';
import {LESSON_IDS} from '../src/data/windLessons';
// Node的浏览器测试加载器不处理工程JSON导入；通过正式模块离线生成合法存档，仍从游戏导入入口使用。
it('生成剑风键鼠验收夹具',()=>{
 mkdirSync('.rapid-fire-local/fixtures',{recursive:true});
 for(const [level,stage,rhythm] of [[0,1,0],[1,1,0],[2,1,0],[3,1,0],[3,5,2]]){
  let s=initialState();for(let i=0;i<stage;i++){if(i===1)s.skills.devices.serialValve=1;if(i===2)s.skills.devices.leakClosed=true;if(i===4){s.skills.devices.splitLeft=1;s.skills.devices.splitRight=2;}s=completeWindLesson(s,LESSON_IDS[i]);}
  s.player.x=760;s.player.y=650;if(level)s.windGifts.held.push({id:'rapidFire',level});if(rhythm)s.windGifts.held.push({id:'windRhythm',level:rhythm});
  writeFileSync(`.rapid-fire-local/fixtures/${level}-${stage}-${rhythm}.json`,JSON.stringify(s,null,2));
 }
});
