# 三枚构筑符文图标更新

回风、留痕、续势已用内置 imagegen 各生成一枚独立透明原画，并替换此前临时 SVG 线稿。统一采用既有低阶符文的木铜框、暗青内芯与底部单叶品阶徽记。

- 回风：青白折返风刃，留出中心暗部，使回卷轮廓可辨。
- 留痕：石面上的发光风痕与局部扰流，表现地面留痕。
- 续势：银白剑身与金青运动残影，表现借势接刀。

[尺寸预览](preview.png)、[实际装备界面](evidence/r33-detail.png)、[实际战斗 HUD](evidence/hud.png)、[窄屏记录](evidence/validation.json)。原画保留在 `sources/`；完整中文提示词见 [prompts.json](prompts.json)，正式资源尺寸与哈希见 [manifest.json](manifest.json)。

整理命令：`node tools/pack-rune-icons.mjs docs/combat-build/rune-art`。只裁透明留白、缩放与编码，未用代码重画图像。正式资源为 `public/assets/runes/painted/r31.webp` 至 `r33.webp`，各为 512×512 透明 WebP，三枚共 337994 字节。图鉴、详情、自由槽、商店与 HUD 共用现有图标入口，布局继续使用既有文档流。

验证环境：macOS，Chromium 153，Metal／WebGL，1280×720；窄屏为 590×844 与 390×844。

执行结果：

- `npm run typecheck`：通过。
- `npm run test:runes`：2 文件、68 项通过。
- `npm run build`：通过；保留既有大于 500KB 的构建分块警告。
- `npx playwright test --config tools/playwright-runes.config.ts --grep 'rune-build-painted-icons|rune-painted-icons' --trace off`：2 项通过，15 秒。三枚新图标实际选择、装备、按住剑风与 HUD 显示通过；全部 34 枚资源解码、透明角及生产服务文件哈希通过；窄屏无横向溢出，页面错误为空。
- `npx playwright test --config tools/playwright-runes.config.ts --grep rune-build-painted-icons --trace off`：补充真实移动与详情顶部截图后，1 项通过，4.4 秒。首次使用带首尾锚点的筛选未匹配 Playwright 完整测试名，未执行测试；去掉锚点后正常运行，并非功能失败。

浏览器图标用例使用公开隔离试验场提供图标集合，再通过正式 UI 装备及真实键盘施放和移动。它只证明图标接入与显示，不冒充正常获取流程；正常获取证据沿用上一阶段记录。本轮没有调整槽位、获取、成长、伤害或存档。

VERDICT: PASS

P0/P1 BLOCKERS：无。已检查共用图标入口、正式资源引用与哈希、透明编码、品阶筛选、HUD 冷却覆盖以及窄屏边界，未发现成立的严重回归。

UNVERIFIED RISKS：玩家对图标风格的最终美术验收；跨设备画质。均不影响上述技术验证结论。

NON-BLOCKING FINDINGS：512 像素原画缩至 34 像素时细部自然损失，主要以主体轮廓区分；保留原始大图便于后续调整。
