# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: village-defense.spec.ts >> 版本2被村墙占用的位置就近恢复，任务背包保持，正常模式无工程标签
- Location: tests/village-defense.spec.ts:56:1

# Error details

```
TypeError: Cannot read properties of undefined (reading 'layoutLabels')
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic [ref=e4]:
          - img "旅行者" [ref=e5]
          - generic [ref=e6]:
            - generic [ref=e7]: 旅人 与小黑同行
            - generic [ref=e8]: 生命 100 / 100
            - generic [ref=e11]: 体力 100 / 100
        - generic [ref=e14]:
          - generic [ref=e15]: 风铃村
          - generic [ref=e16]: 第 1 日 · 08:01
          - generic "位置小地图" [ref=e17]
      - generic [ref=e18]:
        - generic [ref=e19]: 风从这里开始
        - generic [ref=e20]: 采集药草与浆果，在背包制作恢复药剂
        - button "Q 旅途手记" [ref=e21] [cursor=pointer]
      - generic:
        - generic: WASD 移动 · 空格 奔跑 · E 交互 · J/左键 三连斩 · L 风步 · 就绪
        - generic [ref=e22]:
          - button "1 恢复药剂 0" [ref=e23] [cursor=pointer]:
            - generic [ref=e24]: "1"
            - img "恢复药剂" [ref=e25]
            - strong [ref=e26]: "0"
          - button "2 浆果 0" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "2"
            - img "浆果" [ref=e29]
            - strong [ref=e30]: "0"
          - button "3 —" [ref=e31] [cursor=pointer]:
            - generic [ref=e32]: "3"
            - generic [ref=e33]: —
            - strong
          - button "4 —" [ref=e34] [cursor=pointer]:
            - generic [ref=e35]: "4"
            - generic [ref=e36]: —
            - strong
          - button "5 —" [ref=e37] [cursor=pointer]:
            - generic [ref=e38]: "5"
            - generic [ref=e39]: —
            - strong
          - button "6 —" [ref=e40] [cursor=pointer]:
            - generic [ref=e41]: "6"
            - generic [ref=e42]: —
            - strong
          - button "7 —" [ref=e43] [cursor=pointer]:
            - generic [ref=e44]: "7"
            - generic [ref=e45]: —
            - strong
          - button "8 —" [ref=e46] [cursor=pointer]:
            - generic [ref=e47]: "8"
            - generic [ref=e48]: —
            - strong
        - generic [ref=e49]:
          - button "Tab 行囊" [ref=e50] [cursor=pointer]
          - button "M 地图" [ref=e51] [cursor=pointer]
          - button "Esc 暂停" [ref=e52] [cursor=pointer]
    - status: 风铃村欢迎你。向北走几步，按 E 与守风人交谈。
```

# Test source

```ts
  1  | import { test, expect, type Page } from "@playwright/test";
  2  | import { mkdir, writeFile } from "node:fs/promises";
  3  | import { move } from "./map-navigation";
  4  | import { VILLAGE_PORTALS, portalAnchor } from "../src/data/village";
  5  | import { props } from "../src/data/world";
  6  | import { initialState } from "../src/game/systems/state";
  7  | const directory="docs/village-defense/m1/evidence";
  8  | const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
  9  | async function importFixture(page:Page,state:ReturnType<typeof initialState>){
  10 |   page.once("dialog",d=>d.accept());
  11 |   const chooser=page.waitForEvent("filechooser");
  12 |   await page.getByRole("button",{name:"导入存档"}).click();
  13 |   await (await chooser).setFiles({name:"passage-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(state))});
  14 |   await page.waitForFunction(()=>(window as any).__farwind().mode==="");
  15 | }
  16 | test("真实输入通过三门，北南不触发森林任务，主角和黑猫返回，西门与两柱实际阻挡",async({page})=>{
  17 |   await mkdir(directory,{recursive:true});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  18 |   await page.goto("/");await page.getByRole("button",{name:"启程 · 新游戏"}).click();
  19 |   await move(page,670,680);await page.keyboard.press("e");await page.getByRole("button",{name:"继续 · E"}).click();
  20 |   const samples:any[]=[];
  21 |   for(const id of ["north-gate","south-gate","east-gate"]){
  22 |     const gate=VILLAGE_PORTALS.find(p=>p.id===id)!;
  23 |     const inside=portalAnchor(gate,false),outside=portalAnchor(gate,true);
  24 |     await move(page,inside.x,inside.y);await move(page,outside.x,outside.y);
  25 |     await expect.poll(async()=>{const s=await read(page);return gate.axis==="x"?s.companion.x>gate.x+15:gate.id==="north-gate"?s.companion.y<gate.y-15:s.companion.y>gate.y+15;},{timeout:8000}).toBe(true);
  26 |     const snapshot=await read(page);expect(snapshot.companion.blocked).toBe(false);
  27 |     expect(snapshot.region).toBe(gate.id==="north-gate"?"北部山路":gate.id==="south-gate"?"南部荒野":"翡翠森林");
  28 |     expect(snapshot.state.quest).toBe(gate.id==="east-gate"?2:1);
  29 |     samples.push({门:id,主角:snapshot.state.player,黑猫:snapshot.companion,区域:snapshot.region,主线:snapshot.state.quest});
  30 |     await page.screenshot({path:`${directory}/${id}-passage.png`});
  31 |     await move(page,inside.x,inside.y);
  32 |   }
  33 |   await move(page,170,990);await page.keyboard.down("a");await page.waitForTimeout(900);await page.keyboard.up("a");
  34 |   let snapshot=await read(page);expect(snapshot.state.player.x).toBeGreaterThanOrEqual(103-0.1);expect(snapshot.state.player.x).toBeLessThan(110);
  35 |   await page.screenshot({path:`${directory}/west-gate-blocked.png`});
  36 |   expect(snapshot.state.map_version).toBe(3);
  37 |   await page.keyboard.press("Escape");await page.getByRole("button",{name:"保存旅途",exact:true}).click();
  38 |   await page.reload();await page.getByRole("button",{name:"继续旅途",exact:true}).click();
  39 |   snapshot=await read(page);expect(snapshot.state.quest).toBe(2);expect(snapshot.state.map_version).toBe(3);
  40 |   await page.keyboard.press("Escape");await page.getByRole("button",{name:"保存并返回标题"}).click();
  41 |   for(const gate of VILLAGE_PORTALS.filter(p=>p.open))for(const side of [0,1]){
  42 |     const post=props.find(p=>p.id===`${gate.id}-post-${side}`)!;
  43 |     const fixture=initialState();
  44 |     fixture.player.x=gate.axis==="x"?post.x-100:post.x;
  45 |     fixture.player.y=gate.axis==="y"?post.y-100:post.y-13;
  46 |     await importFixture(page,fixture);
  47 |     await page.keyboard.down(gate.axis==="x"?"d":"s");await page.waitForTimeout(1000);await page.keyboard.up(gate.axis==="x"?"d":"s");
  48 |     const s=await read(page),expected=gate.axis==="x"?post.x-31:post.y-36;
  49 |     expect(Math.abs(s.state.player[gate.axis]-expected)).toBeLessThan(2);
  50 |     await page.screenshot({path:`${directory}/${gate.id}-post-${side}.png`});
  51 |     samples.push({门柱:post.id,停止位置:s.state.player});
  52 |     await page.keyboard.press("Escape");await page.getByRole("button",{name:"保存并返回标题"}).click();
  53 |   }
  54 |   expect(errors).toEqual([]);await writeFile(`${directory}/passages.json`,JSON.stringify({说明:"所有位移及碰撞由正式键盘输入产生；门柱夹具经正式存档导入。",样本:samples,页面错误:errors},null,2));
  55 | });
  56 | test("版本2被村墙占用的位置就近恢复，任务背包保持，正常模式无工程标签",async({page})=>{
  57 |   await page.goto("/");const fixture=initialState();fixture.map_version=2;fixture.player.x=2100;fixture.player.y=1400;fixture.quest=2;fixture.side=1;fixture.bag[0]={id:"wood",count:4};fixture.collected={"herb-v1":479};
  58 |   await importFixture(page,fixture);const s=await read(page);
  59 |   expect(Math.hypot(s.state.player.x-2100,s.state.player.y-1400)).toBeLessThan(160);
  60 |   expect(s.state.player.x).toBeLessThan(2100);expect(s.state.map_version).toBe(3);expect(s.state.quest).toBe(2);expect(s.state.side).toBe(1);expect(s.state.bag).toEqual(fixture.bag);expect(s.state.collected).toEqual(fixture.collected);
> 61 |   expect(s.map.layoutLabels).toBe(0);
     |                ^ TypeError: Cannot read properties of undefined (reading 'layoutLabels')
  62 | });
  63 | 
```