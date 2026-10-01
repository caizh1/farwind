# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: skill-growth.spec.ts >> 固定边界夹具：0—5导入导出，旧档继承与乱序事实
- Location: tests/skill-growth.spec.ts:339:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 14
Received: 15
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
              - generic [ref=e8]: 生命 100 / 100
              - generic [ref=e11]: 体力 100 / 100
          - generic: L 风步 · 就绪
          - status: K 架剑就绪
          - button "小宝 · 自由 · 640/640" [ref=e14] [cursor=pointer]
        - generic:
          - button "展开小地图" [ref=e15] [cursor=pointer]:
            - generic [ref=e16]: 风铃村
            - generic [ref=e17]: ·
            - generic [ref=e18]: 第1日 08:00 · 白天
            - generic [aria-hidden] [ref=e21]: ▾
          - button "展开任务详情：与广场的守风人交谈" [ref=e22] [cursor=pointer]:
            - generic [ref=e23]: 任务 · 与广场的守风人交谈
            - generic [aria-hidden] [ref=e24]: ▾
      - status: Esc 打开菜单 / 查看操作
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
    - status: 村門戒备：附近居民避开危险路线。
    - dialog [ref=e70]:
      - banner [ref=e71]:
        - text: 远 风 之 地
        - heading "在风中歇一会儿" [level=1] [ref=e72]
      - paragraph [ref=e73]: 世界与时间已暂停。
      - button "继续旅途" [ref=e74] [cursor=pointer]:
        - text: 继续旅途
        - generic [ref=e75]: Esc
      - generic [ref=e76]:
        - button "行囊 Tab" [ref=e77] [cursor=pointer]:
          - text: 行囊
          - generic [ref=e78]: Tab
        - button "完整地图 M" [ref=e79] [cursor=pointer]:
          - text: 完整地图
          - generic [ref=e80]: M
        - button "旅途手记 Q" [ref=e81] [cursor=pointer]:
          - text: 旅途手记
          - generic [ref=e82]: Q
        - button "符文与共鸣 R" [ref=e83] [cursor=pointer]:
          - text: 符文与共鸣
          - generic [ref=e84]: R
        - button "操作说明 查看操作" [ref=e85] [cursor=pointer]:
          - text: 操作说明
          - generic [ref=e86]: 查看操作
      - heading "存档与设置" [level=2] [ref=e87]
      - generic [ref=e88]:
        - button "保存旅途" [ref=e89] [cursor=pointer]
        - button "导出备份" [active] [ref=e90] [cursor=pointer]
        - button "导入存档" [ref=e91] [cursor=pointer]
        - button "导出迁移前备份" [ref=e92] [cursor=pointer]
        - button "设置" [ref=e93] [cursor=pointer]
        - button "保存并返回标题" [ref=e94] [cursor=pointer]
      - paragraph [ref=e95]: 备份需下载到站点之外；清理站点数据会删除本地存档。
```

# Test source

```ts
  253 |   if (mode !== "title") {
  254 |     if (mode !== "pause") await page.keyboard.press("Escape");
  255 |     await page
  256 |       .getByRole("button", { name: "保存并返回标题", exact: true })
  257 |       .click();
  258 |   }
  259 |   const chooser = page.waitForEvent("filechooser");
  260 |   await page.getByRole("button", { name: "导入存档", exact: true }).click();
  261 |   await (
  262 |     await chooser
  263 |   ).setFiles({
  264 |     name: "skill-boundary-fixture.json",
  265 |     mimeType: "application/json",
  266 |     buffer: Buffer.from(JSON.stringify(state)),
  267 |   });
  268 |   await page.waitForFunction(() => (window as any).__farwind().mode === "");
  269 |   await page.waitForTimeout(180);
  270 | }
  271 | function fixture(stage: number, point = { x: 1310, y: 1400 }) {
  272 |   let s = initialState();
  273 |   Object.assign(s.player, point);
  274 |   for (let i = 0; i < stage; i++) {
  275 |     if (i === 1) s.skills.devices.serialValve = 1;
  276 |     if (i === 2) s.skills.devices.leakClosed = true;
  277 |     if (i === 4) {
  278 |       s.skills.devices.splitLeft = 1;
  279 |       s.skills.devices.splitRight = 2;
  280 |     }
  281 |     s = completeWindLesson(s, LESSON_IDS[i]);
  282 |   }
  283 |   return s;
  284 | }
  285 | // 乱序一风三向：明确前置、重开保留，补齐后实际释放三道剑风。
  286 | test("wind-prerequisite-progression", async ({ page }) => {
  287 |   page.on("dialog", dialog => dialog.accept());
  288 |   await page.goto("/");
  289 |   await importFixture(page, fixture(1, WIND_LESSONS[4].stand));
  290 |   await page.keyboard.press("e");
  291 |   await page.getByRole("button", { name: "扶正左侧风帆", exact: true }).click();
  292 |   await page.waitForFunction(() => (window as any).__farwind().mode === "");
  293 |   await page.keyboard.press("e");
  294 |   await page.getByRole("button", { name: "扶正右侧风帆", exact: true }).click();
  295 |   await expect(page.locator(".dialog-copy")).toContainText("尚未掌握 三向疾风斩");
  296 |   await expect(page.locator(".dialog-copy")).toContainText("当前本领：一线斩（1/5）");
  297 |   await expect(page.locator(".dialog-copy")).toContainText("还需完成：两铃相继、长风不息、展风于野");
  298 |   await restored(page, 1);
  299 |   await page.keyboard.press("e");
  300 |   await expect(page.locator(".dialog-copy")).toContainText("下一步：西部旧农庄的串联风铃");
  301 |   await expect(page.locator(".dialog-copy")).toContainText("补齐后会自动结算，无需重做一风三向");
  302 |   await page.screenshot({ path: ".skill-growth-local/wind-prerequisite-dialog.png", animations: "disabled" });
  303 |   await close(page);
  304 |   await page.keyboard.press("q");
  305 |   await expect(page.locator(".skill-journal")).toContainText("当前本领：一线斩（1/5）");
  306 |   await expect(page.locator(".skill-journal")).toContainText("下一步：西部旧农庄的串联风铃");
  307 |   await expect(page.locator(".skill-journal")).not.toContainText("已发现的线索：一风三向");
  308 |   await page.locator(".skill-journal").scrollIntoViewIfNeeded();
  309 |   await page.screenshot({ path: ".skill-growth-local/wind-prerequisite-journal.png" });
  310 |   await page.keyboard.press("Escape");
  311 | 
  312 |   // 固定边界样本模拟农庄与山口经历已补齐；最后一处教学仍由真实键鼠完成。
  313 |   let ahead = fixture(3, { x: WIND_LESSONS[3].x, y: WIND_LESSONS[3].y+25 });
  314 |   ahead.skills.devices.splitLeft = 1;
  315 |   ahead.skills.devices.splitRight = 2;
  316 |   ahead = completeWindLesson(ahead, LESSON_IDS[4]);
  317 |   await importFixture(page, ahead);
  318 |   await page.keyboard.press("e");
  319 |   await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  320 |   await move(page, WIND_LESSONS[3].stand.x, WIND_LESSONS[3].stand.y);
  321 |   await face(page, "w");
  322 |   await chain(page);
  323 |   await expect.poll(async () => (await read(page)).state.skills.swordWindStage).toBe(5);
  324 |   await expect(page.locator(".dialog-copy")).toContainText("学会 三向疾风斩");
  325 |   await restored(page, 5);
  326 |   expect((await read(page)).skillGrowth.trial).toBeNull();
  327 |   expect((await read(page)).skillGrowth.ability).toBe("三向疾风斩");
  328 |   await face(page, "w");
  329 |   await chain(page, async () => {
  330 |     const winds = (await read(page)).skillGrowth.winds;
  331 |     expect(winds).toHaveLength(3);
  332 |     expect(new Set(winds.map((w: any) => w.releaseId)).size).toBe(1);
  333 |     await page.screenshot({ path: ".skill-growth-local/wind-prerequisite-three.png" });
  334 |   });
  335 |   await page.keyboard.press("q");
  336 |   await expect(page.locator(".skill-journal")).toContainText("五段传承已掌握");
  337 |   await expect(page.locator(".skill-journal")).not.toContainText("尚未掌握");
  338 | });
  339 | test("固定边界夹具：0—5导入导出，旧档继承与乱序事实", async ({ page }) => {
  340 |   page.on("dialog", (d) => d.accept());
  341 |   await page.goto("/");
  342 |   const records = [];
  343 |   for (let stage = 0; stage <= 5; stage++) {
  344 |     await importFixture(page, fixture(stage));
  345 |     expect((await read(page)).state.skills.swordWindStage).toBe(stage);
  346 |     await page.keyboard.press("Escape");
  347 |     const download = page.waitForEvent("download");
  348 |     await page.getByRole("button", { name: "导出备份", exact: true }).click();
  349 |     const path = await (await download).path();
  350 |     const fs = await import("node:fs/promises");
  351 |     const exported = JSON.parse(await fs.readFile(path!, "utf8"));
  352 |     expect(exported.skills.swordWindStage).toBe(stage);
> 353 |     expect(exported.schema_version).toBe(14);
      |                                     ^ Error: expect(received).toBe(expected) // Object.is equality
  354 |     await page.reload();
  355 |     await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  356 |     await page.waitForFunction(() => (window as any).__farwind().mode === "");
  357 |     expect((await read(page)).state.skills.swordWindStage).toBe(stage);
  358 |     records.push({ 阶段: stage, 导出并重开: true });
  359 |   }
  360 |   const old: any = fixture(0);
  361 |   old.schema_version = 6;
  362 |   old.skills = { swordWind: true };
  363 |   old.bag[0] = { id: "wood", count: 3 };
  364 |   await importFixture(page, old);
  365 |   const inherited = (await read(page)).state;
  366 |   expect(inherited.skills.swordWindStage).toBe(1);
  367 |   expect(inherited.skills.legacySwordWind).toBe(true);
  368 |   expect(inherited.skills.completedLessons).toEqual([]);
  369 |   expect(inherited.bag).toEqual(old.bag);
  370 |   let ahead = fixture(0, { x: 1310, y: 1400 });
  371 |   ahead.skills.devices.splitLeft = 1;
  372 |   ahead.skills.devices.splitRight = 2;
  373 |   ahead = completeWindLesson(ahead, LESSON_IDS[4]);
  374 |   ahead = completeWindLesson(ahead, LESSON_IDS[3]);
  375 |   ahead.skills.devices.leakClosed = true;
  376 |   ahead = completeWindLesson(ahead, LESSON_IDS[2]);
  377 |   ahead.skills.devices.serialValve = 1;
  378 |   ahead = completeWindLesson(ahead, LESSON_IDS[1]);
  379 |   await importFixture(page, ahead);
  380 |   expect((await read(page)).state.skills.swordWindStage).toBe(0);
  381 |   await move(page, 1380, 1525);
  382 |   await page.keyboard.press("e");
  383 |   await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  384 |   await move(page, 1310, 1400);
  385 |   await face(page, "w");
  386 |   await chain(page);
  387 |   await expect
  388 |     .poll(async () => (await read(page)).state.skills.swordWindStage)
  389 |     .toBe(5);
  390 |   await expect(page.locator(".dialog-copy")).toContainText("学会 一线斩·双穿");
  391 |   await expect(page.locator(".dialog-copy")).toContainText("学会 三向疾风斩");
  392 |   await restored(page, 5);
  393 |   writeFileSync(
  394 |     root + "save-boundaries.json",
  395 |     JSON.stringify(
  396 |       {
  397 |         说明: "明确的导入导出和乱序边界夹具，不作为自然学习证据。只有补齐基础教学的一击在页面完成。",
  398 |         各阶段: records,
  399 |         旧档继承: inherited.skills,
  400 |         乱序复核: (await read(page)).state.skills,
  401 |       },
  402 |       null,
  403 |       2,
  404 |     ),
  405 |   );
  406 | });
  407 | 
  408 | test("固定边界夹具：教学退出、重开清除与保存事务中断安全重试", async ({
  409 |   page,
  410 | }) => {
  411 |   const errors: string[] = [];
  412 |   page.on("pageerror", (e) => errors.push(e.message));
  413 |   page.on("dialog", (d) => d.accept());
  414 |   await page.goto("/");
  415 |   await importFixture(page, fixture(0));
  416 |   await move(page, 1380, 1525);
  417 |   await page.keyboard.press("e");
  418 |   await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  419 |   await move(page, 1100, 1550);
  420 |   expect((await read(page)).skillGrowth.trial).toBeNull();
  421 |   expect((await read(page)).state.skills.swordWindStage).toBe(0);
  422 |   await importFixture(page, fixture(0));
  423 |   await move(page, 1380, 1525);
  424 |   await page.keyboard.press("e");
  425 |   await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  426 |   await page.reload();
  427 |   await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  428 |   await page.waitForFunction(() => (window as any).__farwind().mode === "");
  429 |   expect((await read(page)).skillGrowth.trial).toBeNull();
  430 |   expect((await read(page)).skillGrowth.ability).toBeNull();
  431 |   await move(page, 1380, 1525);
  432 |   await page.keyboard.press("e");
  433 |   await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  434 |   // 只中断真实保存事务一次；不改动正式状态、命中或任务事实。
  435 |   await page.evaluate(() => {
  436 |     const original = IDBObjectStore.prototype.put;
  437 |     IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
  438 |       const result = original.call(this, value, key!);
  439 |       if (value?.skills?.swordWindStage === 1) {
  440 |         IDBObjectStore.prototype.put = original;
  441 |         this.transaction.abort();
  442 |       }
  443 |       return result;
  444 |     };
  445 |   });
  446 |   await move(page, 1310, 1400);
  447 |   await face(page, "w");
  448 |   await chain(page);
  449 |   await expect(
  450 |     page.getByRole("heading", { name: "经历尚未保存", exact: true }),
  451 |   ).toBeVisible();
  452 |   const failed = await read(page);
  453 |   expect(failed.state.skills.swordWindStage).toBe(0);
```