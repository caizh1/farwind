// M3 首条支线拥有独立身份；后续章节事件消费同一份据点事实，不占用旧 quest 数值。
export const FIELD_QUEST_IDS=["south-supply"] as const;
export type FieldQuestId=(typeof FIELD_QUEST_IDS)[number];
export type FieldQuestState=Record<FieldQuestId,"available"|"active"|"complete">;
export const initialFieldQuests=():FieldQuestState=>({"south-supply":"available"});
export function validateFieldQuests(raw:unknown):FieldQuestState{
 const s=raw as FieldQuestState;
 if(!s||Object.keys(s).length!==FIELD_QUEST_IDS.length||!FIELD_QUEST_IDS.every(id=>["available","active","complete"].includes(s[id])))throw Error("野外委托存档无效。");
 return Object.fromEntries(FIELD_QUEST_IDS.map(id=>[id,s[id]])) as FieldQuestState;
}
