# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: combat-build.spec.ts >> representative-build-combat
- Location: tests/combat-build.spec.ts:59:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 1
Received:   0
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic:
          - generic [ref=e4]:
            - img "旅行者" [ref=e5]
            - generic [ref=e6]:
              - generic [ref=e7]: 旅人 与小黑同行
              - generic [ref=e8]: 生命 78 / 100
              - generic [ref=e11]: 体力 100 / 100
          - generic: L 风步 · 就绪
          - status: K 架剑就绪
          - generic: 一线斩：正式学习
          - button "小宝 · 自由 · 640/640" [ref=e14] [cursor=pointer]
        - generic:
          - button "展开小地图" [ref=e15] [cursor=pointer]:
            - generic [ref=e16]: 翡翠森林
            - generic [ref=e17]: ·
            - generic [ref=e18]: 第1日 08:07 · 白天
            - generic [aria-hidden] [ref=e21]: ▾
          - button "展开任务详情：与广场的守风人交谈" [ref=e22] [cursor=pointer]:
            - generic [ref=e23]: 任务 · 与广场的守风人交谈
            - generic [aria-hidden] [ref=e24]: ▾
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 0" [ref=e25] [cursor=pointer]:
            - generic [ref=e26]: "1"
            - strong [ref=e27]: "0"
          - button "浆果 · 快捷键 2 · 数量 0" [ref=e28] [cursor=pointer]:
            - generic [ref=e29]: "2"
            - strong [ref=e30]: "0"
          - button "空槽 · 快捷键 3 · 在行囊中绑定" [ref=e31] [cursor=pointer]:
            - generic [ref=e32]: "3"
            - generic [ref=e33]: —
            - strong
          - button "空槽 · 快捷键 4 · 在行囊中绑定" [ref=e34] [cursor=pointer]:
            - generic [ref=e35]: "4"
            - generic [ref=e36]: —
            - strong
          - button "空槽 · 快捷键 5 · 在行囊中绑定" [ref=e37] [cursor=pointer]:
            - generic [ref=e38]: "5"
            - generic [ref=e39]: —
            - strong
          - button "空槽 · 快捷键 6 · 在行囊中绑定" [ref=e40] [cursor=pointer]:
            - generic [ref=e41]: "6"
            - generic [ref=e42]: —
            - strong
          - button "空槽 · 快捷键 7 · 在行囊中绑定" [ref=e43] [cursor=pointer]:
            - generic [ref=e44]: "7"
            - generic [ref=e45]: —
            - strong
          - button "空槽 · 快捷键 8 · 在行囊中绑定" [ref=e46] [cursor=pointer]:
            - generic [ref=e47]: "8"
            - generic [ref=e48]: —
            - strong
        - generic "已装备符文与冷却" [ref=e49]:
          - button "◇ ·" [ref=e50] [cursor=pointer]:
            - generic [ref=e51]: ◇
            - generic [ref=e52]: ·
          - button "◇ ·" [ref=e53] [cursor=pointer]:
            - generic [ref=e54]: ◇
            - generic [ref=e55]: ·
          - button "◇ ·" [ref=e56] [cursor=pointer]:
            - generic [ref=e57]: ◇
            - generic [ref=e58]: ·
          - button "◇ ·" [ref=e59] [cursor=pointer]:
            - generic [ref=e60]: ◇
            - generic [ref=e61]: ·
          - button "◇ ·" [ref=e62] [cursor=pointer]:
            - generic [ref=e63]: ◇
            - generic [ref=e64]: ·
          - button "归风 · 固定归风 G" [ref=e65] [cursor=pointer]:
            - img "归风 · 固定归风" [ref=e66]
            - generic [ref=e68]: G
    - status: 抵达 · 翡翠森林
    - alert [ref=e69]:
      - strong [ref=e70]: 本次进度未保存
      - paragraph [ref=e71]: 荒野遭遇存档无效，上一份有效存档仍保留。
      - generic [ref=e72]: 上一份有效存档仍保留；刷新或退出可能丢失本次进度。
      - generic [ref=e73]:
        - button "重试保存" [ref=e74] [cursor=pointer]
        - button "导出当前进度" [ref=e75] [cursor=pointer]
  - complementary [ref=e76]:
    - button "居民笔记 · N" [ref=e77] [cursor=pointer]
  - group [ref=e78]:
    - generic "战斗验证 · 隔离存档 · 素材待视觉验收" [active] [ref=e79]
    - option "近战、冲撞与远程"
    - option "单个高生命目标" [selected]
    - option "单只叶刃螳卫"
    - option "木桩"
    - option "单只苔团史莱姆"
    - option "单只苔甲守卫"
    - option "单只灰冠孢卫"
    - option "单只棘甲林豕"
    - option "林豕与现有树障"
    - option "四只小遭遇"
    - option "剑风双穿多目标样板"
    - option "完整世界"
    - option "五空槽" [selected]
    - option "回风＋留痕"
    - option "续势＋破岸"
    - option "正常" [selected]
    - option "300 毫秒"
    - option "1000 毫秒"
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {writeFileSync} from 'node:fs';
  3  | import {move} from './skill-navigation';
  4  | const root='docs/combat-build/evidence/';
  5  | const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
  6  | async function idle(p:Page){await p.waitForFunction(()=>{const c=(window as any).__farwind().session.combat;return !c.stage&&!c.ready;},null,{timeout:15000});}
  7  | async function chain(p:Page,four=false){
  8  |  await idle(p);await p.keyboard.press('j');
  9  |  await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);await p.keyboard.press('j');
  10 |  await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);await p.keyboard.press('j');
  11 |  await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===3);
  12 |  if(four){await p.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===3&&s.skillGrowth.sim-s.session.combat.actions.filter((x:any)=>x.executed!==undefined).at(-1).executed>=370;});await p.keyboard.press('j');await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===4);}
  13 |  await idle(p);
  14 | }
  15 | async function close(p:Page){if((await read(p)).mode==='dialog')await p.getByRole('button',{name:'继续 · E',exact:true}).click();}
  16 | async function train(p:Page,name:string){await p.getByRole('button',{name:'本领与构筑训练',exact:true}).click();await p.getByRole('button',{name:'开始'+name,exact:true}).click();}
  17 | async function dismiss(p:Page){
  18 |  await p.locator('#close').click();
  19 |  if((await read(p)).mode==='pause')await p.locator('#close').click();
  20 |  await p.waitForFunction(()=>(window as any).__farwind().mode==='');
  21 | }
  22 | async function equip(p:Page,id:string,slot:number){
  23 |  await p.locator(`[data-rune-slot="${slot}"]`).click();await p.locator(`[data-rune-id="${id}"]`).click();
  24 |  const claim=p.locator('#rune-claim');if(await claim.count())await claim.click();await p.locator('#rune-equip').click();
  25 |  await expect.poll(async()=>(await read(p)).state.runes.slots[slot]).toBe(id);
  26 | }
  27 | async function resume(p:Page){
  28 |  await move(p,850,715);await p.keyboard.press('w');await idle(p);
  29 |  await p.keyboard.press('j');await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);await p.keyboard.press('j');await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);
  30 |  await p.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===2&&s.session.combat.dashLegalAt<=s.skillGrowth.sim;});
  31 |  await p.keyboard.down('d');await p.keyboard.press('l');await p.keyboard.up('d');
  32 |  await p.waitForFunction(()=>(window as any).__farwind().session.combat.momentum?.stage===3);
  33 |  await p.waitForFunction(()=>(window as any).__farwind().session.combat.dashRemaining===0);
  34 |  await p.keyboard.down('a');await p.keyboard.down('w');await p.keyboard.press('j');await p.keyboard.up('a');await p.keyboard.up('w');
  35 |  await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===3);await idle(p);
  36 | }
  37 | test('normal-unlock-flow',async({page})=>{
  38 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  39 |  await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏'}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  40 |  expect((await read(page)).state.skills.swordWindStage).toBe(0);expect((await read(page)).state.runes.owned).toEqual([]);
  41 |  await move(page,850,715);await page.keyboard.press('w');await train(page,'四连入门');await chain(page);
  42 |  await expect.poll(async()=>(await read(page)).state.skills.meleeFinisher).toBe(true);expect((await read(page)).state.runes.owned).toContain('r33');
  43 |  await train(page,'破岸终结');await chain(page,true);await expect.poll(async()=>(await read(page)).state.runes.owned).toContain('r12');
  44 |  await page.screenshot({path:root+'normal-melee-learning.png'});
  45 |  await page.waitForTimeout(8500);await page.keyboard.press('r');await equip(page,'r33',0);await equip(page,'r12',1);await page.locator('[data-preset-save="1"]').click();await dismiss(page);
  46 |  await train(page,'借势训练');await resume(page);await resume(page);await expect.poll(async()=>(await read(page)).state.runes.growth.r33.advanced).toBe(true);
  47 |  await page.waitForTimeout(8500);await page.keyboard.press('r');await page.locator('[data-rune-id="r33"]').click();await page.locator('[data-growth-branch="calm"]').click();await expect.poll(async()=>(await read(page)).state.runes.growth.r33.branch).toBe('calm');await dismiss(page);
  48 |  await move(page,1380,1525);await page.keyboard.press('e');await page.getByRole('button',{name:'开始限定试用',exact:true}).click();await move(page,1310,1400);await page.keyboard.press('w');await page.keyboard.press('i');
  49 |  await expect.poll(async()=>(await read(page)).state.skills.swordWindStage).toBe(1);await close(page);await idle(page);
  50 |  await page.screenshot({path:root+'normal-wind-learning.png'});
  51 |  await page.waitForTimeout(8500);await page.keyboard.press('r');await equip(page,'r31',0);await equip(page,'r32',1);await page.locator('[data-preset-save="0"]').click();await dismiss(page);
  52 |  await move(page,850,715);await page.keyboard.press('w');await train(page,'回流训练');await page.keyboard.down('i');await expect.poll(async()=>(await read(page)).state.runes.growth.r31.advanced).toBe(true);await page.keyboard.up('i');await idle(page);
  53 |  await page.waitForTimeout(8500);await page.keyboard.press('r');await page.locator('[data-rune-id="r31"]').click();await page.locator('[data-growth-branch="anchor"]').click();await expect.poll(async()=>(await read(page)).state.runes.growth.r31.branch).toBe('anchor');await page.screenshot({path:root+'normal-branches.png'});await dismiss(page);
  54 |  const before=(await read(page)).state;await page.keyboard.press('Escape');await page.locator('#save').click();await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  55 |  await page.waitForFunction(()=>(window as any).__farwind().mode==='');const after=(await read(page)).state;
  56 |  expect(after.skills).toEqual(before.skills);expect(after.runes.growth).toEqual(before.runes.growth);expect(after.runes.presets.map((x:any)=>x.slots)).toEqual(before.runes.presets.map((x:any)=>x.slots));expect(after.runes.slots).toHaveLength(5);expect(errors).toEqual([]);
  57 |  writeFileSync(root+'normal-flow.json',JSON.stringify({说明:'正式新档入口，仅键盘移动、实际木桩训练、教本与风铃命中、领取和装备。未修改血量、背包、任务或进度。',学习:after.skills,符文:after.runes,错误:errors},null,2));
  58 | });
  59 | test('representative-build-combat',async({page})=>{
  60 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?combatSlice=1');await page.waitForFunction(()=>(window as any).__combatFeel);
  61 |  await page.locator('#combat-wind').check();await page.locator('#combat-four').check();await page.locator('#combat-preset').selectOption('highLife');await page.locator('#combat-build').selectOption('none');await page.locator('#combat-reset').click();
  62 |  await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.locator('#combat-feel-debug summary').click();
  63 |  const start=(await read(page)).skillGrowth.enemies.find((x:any)=>x.hp===20000);expect(start).toBeTruthy();
> 64 |  await page.keyboard.down('i');await page.waitForTimeout(3000);await page.keyboard.up('i');const basic=await read(page);expect(basic.runes.metrics.native).toBeGreaterThan(1);expect(basic.state.runes.slots.filter(Boolean)).toHaveLength(0);
     |                                                                                                                                                            ^ Error: expect(received).toBeGreaterThan(expected)
  65 |  await page.keyboard.down('i');await page.keyboard.press('Escape');await page.keyboard.up('i');await page.getByRole('button',{name:'继续旅途',exact:true}).click();await idle(page);const serial=(await read(page)).session.combat.attackInstanceId;await page.waitForTimeout(700);expect((await read(page)).session.combat.attackInstanceId).toBe(serial);
  66 |  await page.locator('#combat-feel-debug summary').click();await page.locator('#combat-preset').selectOption('slice');await page.locator('#combat-build').selectOption('wind');await page.locator('#combat-reset').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[0]==='r31');await page.locator('#combat-feel-debug summary').click();
  67 |  for(let i=0;i<5;i++){await page.keyboard.down('i');await page.waitForTimeout(650);await page.keyboard.up('i');await page.keyboard.press('k');await page.waitForTimeout(300);await page.keyboard.down('w');await page.keyboard.press('l');await page.waitForTimeout(200);await page.keyboard.up('w');await page.keyboard.press('d');}
  68 |  const wind=await read(page);await page.screenshot({path:root+'wind-build-combat.png'});
  69 |  await page.locator('#combat-feel-debug summary').click();await page.locator('#combat-build').selectOption('melee');await page.locator('#combat-reset').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[0]==='r33');await page.locator('#combat-feel-debug summary').click();
  70 |  for(let i=0;i<3;i++){await page.keyboard.press('j');await page.waitForTimeout(160);await page.keyboard.press('j');await page.waitForTimeout(470);await page.keyboard.down('s');await page.keyboard.press('l');await page.waitForTimeout(220);await page.keyboard.up('s');await page.keyboard.press('w');await page.keyboard.press('j');await page.waitForTimeout(400);await page.keyboard.press('j');await page.waitForTimeout(750);await page.keyboard.press('k');await page.waitForTimeout(650);}
  71 |  const melee=await read(page);await page.screenshot({path:root+'melee-build-combat.png'});expect(melee.state.player.hp).toBeGreaterThan(0);
  72 |  const diagnostic=await page.evaluate(()=>(window as any).__combatFeel.snapshot());expect(errors).toEqual([]);
  73 |  writeFileSync(root+'representative-combat.json',JSON.stringify({说明:'显式隔离样板初始条件，包含近战、冲撞、远程敌人与20000生命单体；后续走正式输入与AI。不能替代正常解锁流程或全主线平衡验收。',基础:basic,剑风:wind,近战:melee,诊断:diagnostic,错误:errors},null,2));
  74 | });
  75 | 
```