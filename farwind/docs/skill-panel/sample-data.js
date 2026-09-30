// 独立设计样例。参数是当前源码的只读快照，不导入游戏，也不接触任何存档。
export const snapshot = {
  date: '2026年9月29日',
  source: 'src/data/swordWind.ts 与 src/data/windLessons.ts',
  stages: [
    { id: 1, name: '一线斩', brief: '命中一个有效敌人', width: 28, range: 300, angles: [0] },
    { id: 2, name: '一线斩·双穿', brief: '贯穿首个敌人，继续命中第二个', width: 28, range: 300, angles: [0] },
    { id: 3, name: '一线斩·贯通', brief: '贯穿有效路径与射程内的敌人', width: 28, range: 300, angles: [0] },
    { id: 4, name: '疾风斩', brief: '继承贯通，攻击带更宽、射程更远', width: 64, range: 420, angles: [0] },
    { id: 5, name: '三向疾风斩', brief: '左前、正前、右前三道独立疾风', width: 64, range: 420, angles: [-30, 0, 30] },
  ],
  lessons: [
    { name: '临水送风', source: '临水草坡的守风教本' },
    { name: '两铃相继', source: '森林串联风铃' },
    { name: '长风不息', source: '森林长风道' },
    { name: '展风于野', source: '遗迹扩流装置' },
    { name: '一风三向', source: '遗迹三向分流庭' },
  ],
  baseDamage: 36,
  speed: 900,
};

export const states = {
  stage3: { stage: 3, completed: [1,2,3], discovered: [1,2,3,4], status: '永久掌握', title: '剑风已贯通，下一段传承已有线索。' },
  few: { stage: 0, completed: [], discovered: [], status: '尚未发现', title: '佩剑、架剑与风步，陪你踏上旅途。' },
  unlearned: { stage: 0, completed: [], discovered: [1], status: '有线索 · 未学习', title: '已经发现剑风的第一条学习线索。' },
  complete: { stage: 5, completed: [1,2,3,4,5], discovered: [1,2,3,4,5], status: '永久掌握', title: '五段传承已掌握，本领永久保留。' },
  legacy: { stage: 1, completed: [], discovered: [], legacy: true, status: '旧版正式学习继承', title: '一线斩来自旧版旅途，没有新增学习经历。' },
  grant: { stage: 0, completed: [], discovered: [], temporary: 1, status: '测试授予 · 非永久掌握', title: '正式阶段未学习；测试环境暂可使用一线斩。' },
  trial: { stage: 3, completed: [1,2,3], discovered: [1,2,3,4], temporary: 4, status: '教学试用 · 非永久掌握', title: '正式掌握贯通；教学区域暂可试用疾风斩。' },
  waiting: { stage: 0, completed: [3,4,5], discovered: [3,4,5], status: '经历已记录，尚待前置', title: '后续经历已保存，正式剑风仍未学习。' },
};

export const currentSkills = [
  { id: 'sword-wind', name: '剑风', category: '战斗', icon: 'wind', current: '一线斩·贯通', status: '已掌握', brief: '贯穿有效路径内的敌人', external: true },
  { id: 'attack', name: '基础攻击', category: '战斗', icon: 'sword', current: '佩剑三连斩', status: '基础能力', brief: '佩剑三连，衔接近身攻势', key: 'J / 左键' },
  { id: 'parry', name: '迎风架剑', category: '战斗', icon: 'guard', current: '架剑与反斩', status: '基础能力', brief: '成功弹反后自动反斩', key: 'K / 右键' },
  { id: 'dash', name: '风步', category: '战斗', icon: 'step', current: '短距闪避', status: '基础能力', brief: '调整位置，避开来招', key: 'L' },
];

// 以下名称只用于容量压力样例。没有实现状态、学习条件或效果数值。
const planned = [
  ['听风','探索','wind'], ['引风','探索','wind'], ['草木调和','生存','leaf'], ['猫伴默契','同行','companion'],
  ['雾径辨向','探索','wind'], ['星野辨路','探索','wind'], ['古痕识读','探索','leaf'], ['风铃辨音','探索','wind'],
  ['足迹研判','探索','step'], ['溪谷听流','探索','wind'], ['岩隙察风','探索','wind'], ['夜林观望','探索','leaf'],
  ['药草辨识','生存','leaf'], ['营火料理','生存','leaf'], ['露水采集','生存','leaf'], ['耐候扎营','生存','leaf'],
  ['绳结工艺','生存','guard'], ['简易包扎','生存','leaf'], ['旅粮保藏','生存','leaf'], ['溪边净水','生存','wind'],
  ['协同警戒','同行','companion'], ['同行掩护','同行','guard'], ['伙伴呼应','同行','companion'], ['默契回援','同行','companion'],
  ['风痕回响','战斗','wind'], ['迎风守势','战斗','guard'],
];
export const capacitySkills = planned.map(([name,category,icon],index)=>({ id: `sample-${index}`, name, category, icon, current: '设计样例，非已实装', status: '规划样例', brief: '仅检验目录容量，不代表玩家可用', planned: true }));
