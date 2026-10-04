// 独立界面验收入口；不接入正式旅途，不写用户的正式站点存档。
import '../src/style.css';
import '../src/equipment.css';
import '../src/bag.css';
import { Interface } from '../src/game/ui/interface';
import { economySnapshot, EconomyCommit } from '../src/game/systems/economy';
import { validate } from '../src/game/systems/state';
import { load, save } from '../src/game/systems/save';
import fixture from '../docs/bag-redesign/evidence/bag-fixture.json';
const ui = new Interface();
const commit = new EconomyCommit();
ui.state = (await load()) ?? validate(fixture);
ui.actions = {
  canMutate: () => !commit.busy,
  trade: request => commit.run(() => ui.state!, request, save, next => { ui.state = next; }),
  start: () => {}, save: () => save(ui.state!), import: async () => {}, use: () => {},
  pause: () => {}, volume: () => {}, getVolume: () => 0, title: () => {},
  practice: () => {}, indicators: () => {}, getIndicators: () => false, runeChange: async () => {}, runeLock: () => '', runeA: () => 0,
};
ui.potionQuantity = 5;
ui.open('bag');
// 背景仅作明示的界面验收衬底，不模拟战斗或旅途通关。
document.body.style.background = '#627961';
