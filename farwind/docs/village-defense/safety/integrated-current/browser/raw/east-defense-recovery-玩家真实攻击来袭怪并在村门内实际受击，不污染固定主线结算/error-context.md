# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: east-defense-recovery.spec.ts >> 玩家真实攻击来袭怪并在村门内实际受击，不污染固定主线结算
- Location: tests/east-defense-recovery.spec.ts:46:1

# Error details

```
TypeError: Cannot read properties of undefined (reading 'some')
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic:
          - generic [ref=e4]:
            - img "旅行者" [ref=e5]
            - generic [ref=e6]:
              - generic [ref=e7]: 旅人 与小黑同行
              - generic [ref=e8]: 生命 70 / 100
              - generic [ref=e11]: 体力 100 / 100
          - generic: L 风步 · 就绪
          - status: K 架剑就绪
        - generic:
          - button "展开小地图" [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: 风铃村
            - generic [ref=e16]: ·
            - generic [ref=e17]: 第1日 08:10 · 白天
            - generic [aria-hidden] [ref=e20]: ▾
          - button "展开任务详情：与广场的守风人交谈" [ref=e21] [cursor=pointer]:
            - generic [ref=e22]: 任务 · 与广场的守风人交谈
            - generic [aria-hidden] [ref=e23]: ▾
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 0" [ref=e24] [cursor=pointer]:
            - generic [ref=e25]: "1"
            - strong [ref=e26]: "0"
          - button "浆果 · 快捷键 2 · 数量 0" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "2"
            - strong [ref=e29]: "0"
          - button "空槽 · 快捷键 3 · 在行囊中绑定" [ref=e30] [cursor=pointer]:
            - generic [ref=e31]: "3"
            - generic [ref=e32]: —
            - strong
          - button "空槽 · 快捷键 4 · 在行囊中绑定" [ref=e33] [cursor=pointer]:
            - generic [ref=e34]: "4"
            - generic [ref=e35]: —
            - strong
          - button "空槽 · 快捷键 5 · 在行囊中绑定" [ref=e36] [cursor=pointer]:
            - generic [ref=e37]: "5"
            - generic [ref=e38]: —
            - strong
          - button "空槽 · 快捷键 6 · 在行囊中绑定" [ref=e39] [cursor=pointer]:
            - generic [ref=e40]: "6"
            - generic [ref=e41]: —
            - strong
          - button "空槽 · 快捷键 7 · 在行囊中绑定" [ref=e42] [cursor=pointer]:
            - generic [ref=e43]: "7"
            - generic [ref=e44]: —
            - strong
          - button "空槽 · 快捷键 8 · 在行囊中绑定" [ref=e45] [cursor=pointer]:
            - generic [ref=e46]: "8"
            - generic [ref=e47]: —
            - strong
    - status: 风铃急响：居民正转移，救护点已启用。
  - complementary [ref=e48]:
    - button "居民笔记 · N" [ref=e49] [cursor=pointer]
```

# Test source

```ts
  1   | import {test,expect,type Page} from "@playwright/test";
  2   | import {mkdir,writeFile} from "node:fs/promises";
  3   | import {initialState} from "../src/game/systems/state";
  4   | import {prepareEastRaid} from "../src/game/systems/defense";
  5   | import {regionAt} from "../src/data/village";
  6   | const root=process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m3/recovery";
  7   | const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
  8   | async function fixture(page:Page,s:any){
  9   |  page.once("dialog",d=>d.accept());const chooser=page.waitForEvent("filechooser");
  10  |  await page.getByRole("button",{name:"导入存档",exact:true}).click();
  11  |  await(await chooser).setFiles({name:"defense-recovery.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(s))});
  12  |  await page.waitForFunction(()=>(window as any).__farwind().mode==="");
  13  | }
  14  | test("实际守卫死亡后IDB请求成功但事务中止，暂停反馈与手动重存可恢复",async({page})=>{
  15  |  await mkdir(root,{recursive:true});
  16  |  await page.addInitScript(()=>{
  17  |   const put=IDBObjectStore.prototype.put;
  18  |   IDBObjectStore.prototype.put=function(value,key){
  19  |    const r=put.call(this,value,key);
  20  |    if(value.defense?.guards?.some((g:any)=>g.id==='east-watch'&&g.dead))
  21  |     r.addEventListener('success',()=>{if((window as any).__abortDefenseSave)this.transaction.abort();},{once:true});
  22  |    return r;
  23  |   };
  24  |  });
  25  |  await page.goto('/');const s=initialState();s.player.x=930;s.player.y=1220;
  26  |  s.defense=prepareEastRaid(s.defense,s.player);s.defense.guards[0].hp=1;
  27  |  s.defense.raid!.members[0].x=2018;s.defense.raid!.members[0].y=977;
  28  |  await page.evaluate(()=>(window as any).__abortDefenseSave=true);
  29  |  await fixture(page,s);
  30  |  await expect(page.locator('#toast')).toContainText('驻防变化尚未保存',{timeout:20000});
  31  |  const failed=await read(page);expect(failed.mode).toBe('pause');expect(failed.state.defense.guards[0].dead).toBe(true);
  32  |  expect(failed.defense.critical).toBe(true);await page.waitForTimeout(400);
  33  |  expect((await read(page)).state.defense).toEqual(failed.state.defense);
  34  |  const stored=await page.evaluate(async()=>{
  35  |   const d=await new Promise<IDBDatabase>((ok,no)=>{const r=indexedDB.open('farwind-save',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
  36  |   const v=await new Promise<any>((ok,no)=>{const r=d.transaction('states').objectStore('states').get('current');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});d.close();return v;
  37  |  });
  38  |  expect(stored.defense.guards[0]).toMatchObject({hp:1,dead:false});
  39  |  await page.screenshot({path:`${root}/death-save-aborted.png`});
  40  |  await page.evaluate(()=>(window as any).__abortDefenseSave=false);
  41  |  await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
  42  |  await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  43  |  const restored=await read(page);expect(restored.state.defense.guards[0]).toMatchObject({hp:0,dead:true,mode:'dead'});
  44  |  await writeFile(`${root}/death-save-recovery.json`,JSON.stringify({说明:'仅故障注入IDB事务中止；死亡由正式怪物接触产生，未修改运行中的单位。',失败时:failed.state.defense,上一份有效档:stored.defense,恢复:restored.state.defense},null,2));
  45  | });
  46  | test("玩家真实攻击来袭怪并在村门内实际受击，不污染固定主线结算",async({page})=>{
  47  |  await mkdir(root,{recursive:true});await page.goto('/');const s=initialState();s.player.x=2050;s.player.y=1080;
  48  |  // 合法历史夹具仅建立驻防已阵亡与城门内来袭前提。
  49  |  s.defense=prepareEastRaid(s.defense,{x:930,y:1220});
  50  |  for(const g of s.defense.guards)Object.assign(g,{hp:0,dead:true,mode:'dead'});
  51  |  s.defense.raid!.members.forEach((m,i)=>Object.assign(m,i?{hp:0}:{x:2105,y:1080,cooldownMs:1800}));
  52  |  await fixture(page,s);await page.keyboard.down('d');await page.waitForTimeout(30);await page.keyboard.up('d');
  53  |  const before=(await read(page)).state;await page.keyboard.press('j');
  54  |  await expect.poll(async()=>(await read(page)).state.defense.raid.members[0].hp).toBe(30);
  55  |  await expect.poll(async()=>(await read(page)).state.player.hp,{timeout:15000}).toBe(90);
  56  |  const hurt=await read(page);expect(regionAt(hurt.state.player).id).toBe('village');
> 57  |  expect(hurt.contacts.some((c:any)=>c.id.startsWith('east-raid-1:1:')&&c.result==='hurt')).toBe(true);
      |                       ^ TypeError: Cannot read properties of undefined (reading 'some')
  58  |  expect([hurt.state.quest,hurt.state.killed,hurt.state.bag,hurt.state.coins]).toEqual([before.quest,before.killed,before.bag,before.coins]);
  59  |  await page.screenshot({path:`${root}/player-raid-contact.png`});
  60  |  await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();
  61  |  await expect(page.locator('#toast')).toContainText('已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  62  |  const restored=await read(page);expect(restored.state.defense.guards.every((g:any)=>g.dead)).toBe(true);
  63  |  expect(restored.state.defense.raid.members[0].hp).toBe(30);
  64  |  await writeFile(`${root}/player-raid-contact.json`,JSON.stringify({说明:'正式J攻击与怪物接触造成伤害，门内没有按横坐标无敌；历史存档只建立前提。',受击:hurt.state,接触:hurt.contacts,重载:restored.state.defense},null,2));
  65  | });
  66  | test("保留新剑风与弹反入口，真实第四刀和K可命中动态来袭怪",async({page})=>{
  67  |  await mkdir(root,{recursive:true});await page.goto('/');const s=initialState();s.player.x=2050;s.player.y=1080;
  68  |  s.skills.swordWind=true;s.killed=['slime-1','slime-2','leaf-1','leaf-2'];
  69  |  s.defense=prepareEastRaid(s.defense,{x:930,y:1220});for(const g of s.defense.guards)Object.assign(g,{hp:0,dead:true,mode:'dead'});
  70  |  s.defense.raid!.members.forEach((m,i)=>Object.assign(m,i?{hp:0}:{x:2440,y:1080}));
  71  |  await fixture(page,s);await page.keyboard.down('d');
  72  |  await page.waitForFunction(()=>(window as any).__farwind().animation.hero.direction===3);await page.keyboard.up('d');
  73  |  await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);
  74  |  await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);
  75  |  await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===3);
  76  |  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===3&&s.session.attackUntil-s.session.sim<140;},{},{polling:5});await page.keyboard.press('j');
  77  |  await expect.poll(async()=>(await read(page)).state.defense.raid.members[0].hp).toBe(12);
  78  |  const wind=await read(page);expect(wind.swordWind.events.some((e:any)=>e.target==='east-raid-1:1'&&e.damage===36)).toBe(true);
  79  |  expect(wind.state.killed).toEqual(s.killed);expect(wind.state.quest).toBe(s.quest);await page.screenshot({path:`${root}/wind-raid-contact.png`});
  80  |  await page.keyboard.press('Escape');const parry=structuredClone(s);parry.defense.raid!.members[0].x=2105;parry.defense.raid!.members[0].cooldownMs=1000;
  81  |  await fixture(page,parry);await page.keyboard.down('d');
  82  |  await page.waitForFunction(()=>(window as any).__farwind().animation.hero.direction===3);await page.keyboard.up('d');
  83  |  // A类工程验证依据只读预期接触提交真实K；画面识别验收另行记录。
  84  |  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith('east-raid-1:1:')&&w.lead<180&&w.lead>110);},{},{polling:5});
  85  |  await page.keyboard.press('k');await expect.poll(async()=>(await read(page)).contacts.at(-1)?.result).toMatch(/normal|perfect/);
  86  |  const end=await read(page);expect(end.state.player.hp).toBe(100);expect(end.state.killed).toEqual(s.killed);
  87  |  await writeFile(`${root}/wind-parry-raid.json`,JSON.stringify({说明:'合法历史夹具建立站位和已学习技能，正式键盘四连与K由运行时命中；A类依据诊断输入，不作为画面易读性验收。',剑风:wind.swordWind,弹反:end.contacts},null,2));
  88  | });
  89  | test("生产构建恢复活跃演练并自主结算，查询开关不暴露开发按钮",async({page})=>{
  90  |  test.skip(!process.env.FARWIND_PRODUCTION,'单独在冻结生产预览运行');
  91  |  await mkdir(root,{recursive:true});await page.goto('/?defenseDebug=1');const s=initialState();s.player.x=1960;s.player.y=1230;
  92  |  s.defense=prepareEastRaid(s.defense,s.player);await fixture(page,s);
  93  |  await expect.poll(async()=>(await read(page)).target).toBe('east-gate-sign');await page.keyboard.press('e');
  94  |  await expect(page.getByRole('heading',{name:'东门驻防',exact:true})).toBeVisible();
  95  |  await expect(page.locator('#defense-drill')).toHaveCount(0);await page.getByRole('button',{name:'继续 · E',exact:true}).click();
  96  |  await expect.poll(async()=>(await read(page)).mode).toBe('');
  97  |  await expect.poll(async()=>(await read(page)).state.defense.raid,{timeout:45000}).toBeNull();
  98  |  await expect.poll(async()=>{const r=await read(page);return !r.defense.critical&&!r.defenseCheckpointPending;}).toBe(true);
  99  |  await page.screenshot({path:`${root}/production-autonomous.png`});await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  100 |  const r=await read(page);expect(r.state.defense.completedSequence).toBe(1);expect(r.state.defense.guards.every((g:any)=>!g.dead)).toBe(true);
  101 |  expect([r.state.schema_version,r.state.map_version]).toEqual([6,6]);
  102 |  await writeFile(`${root}/production.json`,JSON.stringify({说明:'冻结生产构建从正式导入恢复演练，正常版不提供开发启动入口。',驻防:r.state.defense},null,2));
  103 | });
  104 | 
```