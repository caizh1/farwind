import type { State } from './state';
import { BUILD_LESSONS,earnedWindStage,initialSkills,LESSON_IDS,lessonById,WIND_LESSONS,WIND_NAMES,type LessonId,type SkillState } from '../../data/windLessons';
export {resolveSwordWindConfig} from '../../data/swordWind';
export {initialSkills};
export const DEV_GRANT_SWORD_WIND=import.meta.env?.DEV===true&&import.meta.env.VITE_DEV_GRANT_SWORD_WIND==='1'&&!(typeof location!=='undefined'&&new URLSearchParams(location.search).has('combatSlice'));
export const effectiveWindStage=(s:Pick<State,'skills'>,grant=DEV_GRANT_SWORD_WIND)=>s.skills.swordWindStage||(grant?1:0);
export const hasSwordWind=(s:Pick<State,'skills'>,grant=DEV_GRANT_SWORD_WIND)=>effectiveWindStage(s,grant)>0;
export const swordWindSource=(s:Pick<State,'skills'>,grant=DEV_GRANT_SWORD_WIND)=>s.skills.swordWindStage?'正式学习':grant?'测试授予':'未学习';
export function migrateLegacySkills(raw:unknown):SkillState {
  const result=initialSkills();
  if(raw===undefined)return result;
  if(!raw||typeof raw!=='object'||typeof (raw as {swordWind?:unknown}).swordWind!=='boolean')throw Error('存档技能状态无效');
  result.legacySwordWind=(raw as {swordWind:boolean}).swordWind;
  result.swordWindStage=result.legacySwordWind?1:0;
  return result;
}
export function validateSkills(raw:unknown):SkillState {
  const s=raw as SkillState;
  const ids=(a:unknown):a is LessonId[]=>Array.isArray(a)&&a.length<=5&&new Set(a).size===a.length&&a.every(id=>LESSON_IDS.includes(id));
  const choice=(n:unknown)=>n===0||n===1||n===2;
  if(!s||typeof s.meleeFinisher!=='boolean'||!Array.isArray(s.buildLessons)||new Set(s.buildLessons).size!==s.buildLessons.length||s.buildLessons.some(id=>!BUILD_LESSONS.includes(id))||s.meleeFinisher!==s.buildLessons.includes('melee')||!Number.isInteger(s.swordWindStage)||s.swordWindStage<0||s.swordWindStage>5||typeof s.legacySwordWind!=='boolean'||!ids(s.completedLessons)||!ids(s.discoveredLessons)||
    !s.devices||!choice(s.devices.serialValve)||!choice(s.devices.splitLeft)||!choice(s.devices.splitRight)||typeof s.devices.leakClosed!=='boolean'||
    s.completedLessons.some(id=>!s.discoveredLessons.includes(id))||earnedWindStage(s)!==s.swordWindStage||
    s.completedLessons.includes(LESSON_IDS[1])&&s.devices.serialValve!==1||s.completedLessons.includes(LESSON_IDS[2])&&!s.devices.leakClosed||
    s.completedLessons.includes(LESSON_IDS[4])&&(s.devices.splitLeft!==1||s.devices.splitRight!==2))throw Error('存档技能阶段或学习来源无效');
  return {meleeFinisher:s.meleeFinisher,buildLessons:[...s.buildLessons],swordWindStage:s.swordWindStage,legacySwordWind:s.legacySwordWind,completedLessons:[...s.completedLessons],discoveredLessons:[...s.discoveredLessons],devices:{serialValve:s.devices.serialValve,leakClosed:s.devices.leakClosed,splitLeft:s.devices.splitLeft,splitRight:s.devices.splitRight}};
}
// 仅由真实场景完成入口调用；此函数计算副本，提交成功前不发布学习结果。
export function completeWindLesson(s:State,id:LessonId):State {
  if(!LESSON_IDS.includes(id))throw Error('学习事件无效');
  const next=structuredClone(s);
  if(!next.skills.discoveredLessons.includes(id))next.skills.discoveredLessons.push(id);
  if(!next.skills.completedLessons.includes(id))next.skills.completedLessons.push(id);
  next.skills.swordWindStage=earnedWindStage(next.skills);
  const stage=next.skills.swordWindStage;
  const following=stage<5?LESSON_IDS.at(stage):undefined;
  if(following&&!next.skills.discoveredLessons.includes(following))next.skills.discoveredLessons.push(following);
  return next;
}
// 已完成事件的来源由手记读取，旧版继承不伪造导师或风道经历。
export function windLearningSource(s:SkillState){return s.swordWindStage===0?'尚未学习':s.swordWindStage===1&&s.legacySwordWind&&!s.completedLessons.includes(LESSON_IDS[0])?'旧版正式学习继承':lessonById(LESSON_IDS[s.swordWindStage-1]).source;}
// 完成数量与连续解锁阶段分别呈现；教本和手记共用下一步指引。
export function windLessonProgress(s:SkillState){
  const stage=s.swordWindStage,completed=WIND_LESSONS.filter(l=>s.completedLessons.includes(l.id));
  const next=WIND_LESSONS.find(l=>l.stage>stage&&!s.completedLessons.includes(l.id));
  const records=WIND_LESSONS.map(l=>`${l.stage}. ${l.name} · ${s.completedLessons.includes(l.id)?l.stage<=stage?'已完成 · 已解锁':'已完成 · 待解锁':l.stage<=stage?'旧版继承 · 已解锁':'未完成'}`).join('\n');
  const pending=completed.filter(l=>l.stage>stage);
  return `传承完成：${completed.length}/5\n能力已解锁：${stage?`第 ${stage} 段 · ${WIND_NAMES[stage]}`:'尚未学习'}${pending.length?`\n能力按顺序解锁，目前缺少第 ${next!.stage} 关「${next!.name}」。`:''}\n${next?`下一步：第 ${next.stage} 关「${next.name}」 · ${next.source}\n${next.hint}`:'五段传承已掌握。能力永久保留，不占技法位置。'}${pending.length?`\n补齐后会自动结算，无需重做已完成的传承：${pending.map(l=>l.name).join('、')}。`:''}\n\n${records}`;
}
// 记录机关经历不等于掌握对应本领；重读、结算与手记使用同一份前置说明。
export function windLessonStatus(s:SkillState,id:LessonId){
  const lesson=lessonById(id),stage=s.swordWindStage;
  const done=s.completedLessons.includes(id);
  return `${lesson.name}：${done?lesson.stage>stage?`已完成并保存，尚未掌握 ${WIND_NAMES[lesson.stage]}，无需重做。`:'已完成并保存，本领已解锁。':'尚未完成。'}\n\n${windLessonProgress(s)}`;
}
