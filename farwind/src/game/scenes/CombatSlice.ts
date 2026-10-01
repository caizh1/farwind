import {World} from './World';
// 独立场景只选择隔离起点；输入、AI、结算与表现全部继承正式世界。
export class CombatSlice extends World {
  constructor(){super('CombatSlice');}
}
