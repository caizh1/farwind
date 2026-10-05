# 全人物对话立绘补齐

日期：2026年10月5日。

## 交付范围

新增44张独立透明立绘，保留原有药师、守风人、木匠、小宝4张，共覆盖48个说话者身份。包括守城将军岚铎、十二个村庄卫兵岗位、二十三名城市居民、四名具名行商、商路守备、赶集旅客、小黑与神秘黑焰身影。匿名旅客和匿名商路守备分别使用职业立绘；补员后卫兵沿用岗位立绘，不宣称每位后继者都有独立外貌。

人物名册及外貌设计见[catalog.json](catalog.json)。使用内置 imagegen 单独绘制角色，参考现有角色身份和手绘风格，采用自然比例的详细半身构图。完整中文提示词、生成原图路径见[generation.json](generation.json)，44张母版在[masters](masters/)。运行资源在 `public/assets/portraits/<角色ID>-neutral.webp`，统一768×1152，透明安全区，合计12140850字节；透明比例与实体像素量测见[asset-report.json](asset-report.json)。等比例导出脚本为 `tools/pack-dialogue-portraits.mjs`。

资源按稳定身份绑定。城市居民、行商、商路守备接入现有森林绿木框对话，保留原有交易与委托事务。场景精灵保持现有资源；运行时只加载当前人物的对话图片，不向Phaser预加载44张立绘。路牌、货箱、碑文和设施说明保持非人物模式。图像加载失败沿用既有无立绘降级。

全部立绘可通过正式构建的 `/dialogue-portraits.html` 校对页查看、放大；校对页不是游戏流程验收替代品。完整素材画面已通过四张联系图检查：[一](evidence/contact-sheet-1.png)、[二](evidence/contact-sheet-2.png)、[三](evidence/contact-sheet-3.png)、[四](evidence/contact-sheet-4.png)。素材登记仍标记临时，等待用户最终美术确认。

## 实际页面与验证

使用本机固定生产构建 `http://127.0.0.1:5337/?combatObservation=1`。通过正式存档导入、实际E交谈、鼠标回应和交易按钮验证；只读观察记录未授予游戏能力。固定样本不是从村庄自然步行抵城的证据，也没有改写用户原Chrome端口的存档。

- 岚铎桌面1280×720、窄屏390×844、短窗口740×360：真实立绘加载，三项回应及关闭可操作，无横向溢出。截图：[桌面](evidence/captain-desktop.png)、[窄屏](evidence/captain-narrow.png)、[短窗口](evidence/captain-short.png)。
- 苏苓购买两瓶药剂：金币120→84，库存6→4，行囊新增2瓶。截图：[交易结果](evidence/merchant-purchase.png)。窄屏正文、交易数量和滚动回应分区，截图：[窄屏](evidence/merchant-narrow.png)。
- 叶蘅实际室内交谈显示对应立绘；阿铎点击“询问遗失工具”后实际保存 `tools-hint`，金币保持120；鹿宁实际E交谈显示西门巡卫立绘。截图：[叶蘅](evidence/city-herbalist.png)、[阿铎](evidence/city-apprentice.png)、[鹿宁](evidence/village-guard.png)。
- 校对页面48张图片全部加载成功，岚铎可放大：[大图](evidence/gallery-captain.png)。
- `npx vitest run --maxWorkers=1 tests/dialogue-portraits.test.ts tests/merchant-road.test.ts tests/city-completion.test.ts`：3文件53项通过，覆盖身份完整性、透明安全边、资源登记、无额外任务副作用，以及既有商旅和城市任务事务。
- `npm run build -- --outDir .road-reopening-local/production`：类型检查及生产构建通过。正式页面实际资源及布局记录见[runtime-report.json](evidence/runtime-report.json)。

## 开放范围审查

VERDICT: PASS

P0/P1 BLOCKERS: 无。

已检查新增资源加载与生命周期、稳定身份与原型属性防护、非人物降级、城市居民入口、行商数量读取和异步事务、金币及库存归属、保存失败原有保护、响应式滚动与关闭、场景精灵和存档字段兼容。新增立绘不写入存档，也不改变交易价格或奖励。现有经济修订校验、位置/通路验证与保存后发布状态仍保留；未发现具有合理可达执行路径的严重数据完整性或可靠性缺陷。

UNVERIFIED RISKS:

- 尚未通过自然日程与移动逐一遇见全部48个说话者；全量身份及素材有自动校验，真实入口验证限于上述代表样本。
- 本轮未重跑完整商路剧情、守军战斗及全部委托流程，也未进行同条件帧耗时P95比较，因此不宣称性能增幅达到10%以内。
- 最终人物外貌和细节仍需用户美术确认；工程与素材检查通过不代表最终美术签收。

NON-BLOCKING FINDINGS:

- 构建保留现有大分块提示，不影响本轮构建通过；新增44张图片不在首次场景中全量解码。
- 匿名角色共享职业立绘，岗位补员沿用岗位形象；当前实现没有为无限后继者生成图片。
