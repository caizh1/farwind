import {afterEach,describe,expect,it,vi} from 'vitest';
import {advancePathSearch,cancelPath,enemyNavigation,localPath,navigationBudget,NAV,pathPending,pathSearch,planPath} from '../src/game/systems/enemy';
import {syncMapGeometry} from '../src/data/world';
import {clearMotionLine,motionBlocked} from '../src/game/systems/obstacles';
import {EastDefense} from '../src/game/systems/defense';
import {initialState} from '../src/game/systems/state';

afterEach(()=>{vi.restoreAllMocks();syncMapGeometry(false);});
const start={x:0,y:0},target={x:100,y:0};
const query={blocked:(x:number,y:number)=>x===40&&Math.abs(y)<120,clear:()=>true};
const goal=(p:{x:number;y:number})=>p.x===target.x&&p.y===target.y;

describe('共享寻路时间预算与任务失效',()=>{
  it('分帧计算得到原路线，每批节点有界，待规划状态可克隆',()=>{
    const expected=localPath(start,goal,target,()=>true,query),nav=enemyNavigation();
    let result;
    for(let frame=0;frame<200&&!result;frame++){
      result=planPath(nav,target,'追击',frozen=>pathSearch(start,goal,frozen,()=>true,query),navigationBudget());
      expect(()=>structuredClone(nav)).not.toThrow();
    }
    expect(result?.path).toEqual(expected.path);expect(result?.visited).toBe(expected.visited);
    expect(nav.queries).toBe(1);expect(pathPending(nav)).toBe(false);
  });
  it('两次搜索和同帧后续子步共享两毫秒，预算耗尽后不继续展开',()=>{
    let clock=0,checks=0;
    vi.spyOn(performance,'now').mockImplementation(()=>clock);
    const search=()=>pathSearch(start,()=>{checks++;clock+=.75;return false;},target,()=>true,query);
    const budget=navigationBudget(),first=advancePathSearch(search(),budget),before=checks;
    expect(first.expanded).toBe(3);expect(budget.remainingMs).toBe(0);
    expect(advancePathSearch(search(),budget).expanded).toBe(0);expect(checks).toBe(before);
    expect(clock).toBeLessThanOrEqual(NAV.frameMs+.75);
  });
  it('节点预算独立于时钟，零查询预算不建立任务',()=>{
    vi.spyOn(performance,'now').mockReturnValue(0);
    const search=pathSearch(start,()=>false,target,()=>true,{blocked:()=>false,clear:()=>true});
    const legacy={queries:2};expect(advancePathSearch(search,legacy).expanded).toBe(NAV.nodesPerBatch);
    expect(legacy).toEqual({queries:1});
    const nav=enemyNavigation();planPath(nav,target,'追击',()=>search,{queries:0});
    expect(pathPending(nav)).toBe(false);expect(nav.queries).toBe(0);
  });
  it('更换目标身份、地图碰撞变化和大幅换目标都会释放旧搜索',()=>{
    let builds=0;
    const nav=enemyNavigation(),build=(p:{x:number;y:number})=>{builds++;return pathSearch(start,()=>false,p,()=>true,query);};
    planPath(nav,target,'追击玩家',build,{queries:1,remainingMs:.001});expect(pathPending(nav)).toBe(true);
    planPath(nav,target,'返家',build,{queries:1,remainingMs:.001});expect(builds).toBe(2);
    syncMapGeometry(true);
    planPath(nav,target,'返家',build,{queries:1,remainingMs:.001});expect(builds).toBe(3);
    planPath(nav,{x:500,y:0},'返家',build,{queries:1,remainingMs:.001});expect(builds).toBe(4);
    cancelPath(nav);expect(pathPending(nav)).toBe(false);
  });
  it('小幅移动目标保留搜索，外部起点移动不会改变已有搜索网格',()=>{
    const origin={...start},search=pathSearch(origin,goal,target,()=>true,query);
    search.next();origin.x=13;origin.y=17;
    let result;
    for(let frame=0;frame<200&&!result;frame++)result=advancePathSearch(search,navigationBudget()).result;
    expect(result).toEqual(localPath(start,goal,target,()=>true,query));
    const nav=enemyNavigation();let builds=0;
    const build=(p:{x:number;y:number})=>{builds++;return pathSearch(start,()=>false,p,()=>true,query);};
    planPath(nav,target,'追击',build,{queries:1,remainingMs:.001});
    planPath(nav,{x:140,y:0},'追击',build,{queries:1,remainingMs:.001});expect(builds).toBe(1);
  });
  it('守卫在真实地图绕过水井并到达目标，全程不穿障碍',()=>{
    const defense=new EastDefense(initialState().defense,0),body={x:863,y:415},destination={x:1017,y:415},nav=enemyNavigation();
    expect(clearMotionLine(body,destination)).toBe(false);
    for(let frame=0;frame<1500&&Math.hypot(body.x-destination.x,body.y-destination.y)>1;frame++){
      const previous={...body};defense.now=frame*16;
      defense.move(body,nav,destination,60,.016,navigationBudget(),()=>true);
      expect(motionBlocked(body.x,body.y)).toBeFalsy();expect(clearMotionLine(previous,body)).toBe(true);
      expect(Math.hypot(body.x-previous.x,body.y-previous.y)).toBeLessThanOrEqual(.961);
    }
    expect(Math.hypot(body.x-destination.x,body.y-destination.y)).toBeLessThanOrEqual(1);
    expect(nav.queries).toBeGreaterThan(0);
  });
});
