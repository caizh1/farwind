import {describe, expect, it} from 'vitest';
import {advanceGroundBake, groundCacheEvictions, groundChunks, GROUND_CACHE_LIMIT} from '../src/game/systems/terrainChunks';

describe('地形往返缓存与绘制预算', () => {
  it('截图位置三轮往返直接复用地面，不按视野边界销毁', () => {
    const cache=new Map<string,number>();let created=0,afterFirstCross=0;
    for(const [index,x] of [8745,8485,8745,8485,8745,8485,8745].entries()){
      const wanted=groundChunks({left:x-640,right:x+640,top:1100,bottom:1900},16000,4800,2,{x:-2110,y:-1380});
      const keys=new Set(wanted.map(t=>t.key));
      for(const tile of wanted){if(cache.has(tile.key)){const value=cache.get(tile.key)!;cache.delete(tile.key);cache.set(tile.key,value);}else{for(const key of groundCacheEvictions(cache.keys(),keys,GROUND_CACHE_LIMIT-1))cache.delete(key);cache.set(tile.key,++created);}}
      expect(cache.size).toBeLessThanOrEqual(GROUND_CACHE_LIMIT);
      if(index===1)afterFirstCross=created;
      if(index>1)expect(created).toBe(afterFirstCross);
    }
    expect(created).toBe(cache.size);
  });
  it('只释放最久未使用的远处块，缓存满时仍保护视野和在建范围', () => {
    const cache=new Map(Array.from({length:70},(_,i)=>[`地面${i}`,i]));
    cache.delete('地面0');cache.set('地面0',0);
    const keep=new Set(['地面1','地面2']);
    expect(groundCacheEvictions(cache.keys(),keep,64)).toEqual(['地面3','地面4','地面5','地面6','地面7','地面8']);
    expect(groundCacheEvictions(['可见地面'],new Set(['可见地面']),0)).toEqual([]);
  });
  it('预算用完立即让出执行，下一帧从未完成处继续', () => {
    let clock=0,steps=0;
    const task=(function*(){for(let i=0;i<6;i++){steps++;clock+=.6;yield;}})();
    expect(advanceGroundBake(task,2,()=>clock)).toBe(false);
    expect(steps).toBe(4);
    expect(advanceGroundBake(task,4,()=>clock)).toBe(true);
    expect(steps).toBe(6);
  });
});
