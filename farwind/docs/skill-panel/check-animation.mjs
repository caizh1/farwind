// 核对本页示意的命中、独立截断与去重，不作为正式战斗测试。
import assert from 'node:assert/strict';
import { demonstration } from './demonstration.js';
import { snapshot } from './sample-data.js';
const models=snapshot.stages.map(config=>demonstration(config.id,config));
assert.deepEqual(models.slice(0,4).map(model=>model.hits.length),[1,2,3,4],'五阶段命中范围示意不符');
for(const model of models) assert(!model.hits.some(hit=>hit.id==='behind'),'障碍后的目标不应受击');
assert.equal(models[2].lanes[0].end,285,'贯通在实体障碍处停止');
assert.equal(models[3].config.width,64,'疾风斩的攻击带必须变宽');
assert.deepEqual(models[4].lanes.map(lane=>lane.angle),[-30,0,30],'三向相邻30度');
assert.deepEqual(models[4].lanes.map(lane=>lane.end),[420,420,280],'三道独立截断');
assert.equal(models[4].lanes.filter(lane=>lane.contacts.some(hit=>hit.id==='shared')).length,3,'重叠目标应处于三条带内');
assert.equal(models[4].hits.filter(hit=>hit.id==='shared').length,1,'同次释放对同一目标只能反馈一次');
assert.equal(snapshot.speed,900,'演示参数快照必须与当前配置一致');
console.log('展示动画核对通过：一击、双穿、贯通、宽幅、三向、障碍截断与同次去重。');
