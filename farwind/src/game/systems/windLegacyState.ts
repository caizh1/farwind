// 节点0未接取，1调查，2中段，3进阶已获得，4路线完成；奖励记录就是稳定任务状态。
export type LegacyTrack='wind'|'blade'|'ending'|'return'|'momentum'|null;
export type WindLegacyState={wind:0|1|2|3|4;blade:0|1|2|3|4;device:boolean;ending:boolean;track:LegacyTrack};
export const initialWindLegacy=():WindLegacyState=>({wind:0,blade:0,device:false,ending:false,track:null});
export function validateWindLegacy(raw:unknown):WindLegacyState{
 const s=raw as WindLegacyState;
 if(!s||![0,1,2,3,4].includes(s.wind)||![0,1,2,3,4].includes(s.blade)||typeof s.device!=='boolean'||typeof s.ending!=='boolean'||![null,'wind','blade','ending','return','momentum'].includes(s.track)||s.device&&s.wind<2||s.wind>=3&&!s.device||s.ending&&s.wind!==4&&s.blade!==4)throw Error('散落风式存档无效。');
 return {wind:s.wind,blade:s.blade,device:s.device,ending:s.ending,track:s.track};
}
