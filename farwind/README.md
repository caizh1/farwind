# 远风之地

桌面浏览器二维俯视手绘冒险游戏。TypeScript + Phaser 4 + Vite，无后端、账号或在线业务接口。

## 启动

需要 Node.js 22.12 或更新版本。当前实测 Node.js 26.0.0、npm 11.12.1。

```sh
cd farwind
npm ci
npm run dev
```

打开终端显示的本地 HTTP 地址，默认是 http://127.0.0.1:5173/ 。不要双击 HTML。

```sh
npm run typecheck
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

预览默认使用 http://127.0.0.1:4173/ 。不同端口属于不同站点来源，浏览器存档不会自动共享；可导出后导入。静态托管只需完整上传 `dist` 目录到站点根目录。本项目未公开部署。

## 操作

- WASD／方向键：移动；Shift：奔跑。
- E：与最近可达目标交互；J／画布左键：挥剑。
- Tab：行囊与制作；M：地图；Q：任务；Esc：暂停。
- 数字 1～8：使用快捷栏物品；行囊选择物品后可绑定快捷栏。
- 暂停菜单：手动保存、导出备份、导入、音量、全屏、返回标题。

## 冒险路线

向北找守风人接任务；在广场采药草、浆果、木材和石材。沿东侧石路进入森林，在行囊用药草 ×2、浆果 ×1 制作恢复药剂。击退叶灵取得风之结晶，沿东北道路抵达遗迹。阅读古碑，依次回应西侧晨风、北侧林风、东侧暮风；消耗木材 ×2、石材 ×2、结晶 ×1 修复路标。南侧归乡风径开启后返回村庄交付。

木匠另有采集支线；森林南部岔路藏有宝箱。敌人不会追入村庄。死亡回到广场，保留行囊和任务。

采集点三个游戏小时后恢复。打开的宝箱不复原，击败的敌人在本存档不重生。夜间采用统一色调，世界时间每现实秒推进 1.5 游戏分钟。对话、菜单、失焦、页面隐藏会暂停。

## 存档

使用 IndexedDB 事务保存结构化数据；安全节点自动保存，并可手动保存。新游戏覆盖有效存档前提示。导入校验版本、大小、数值、物品和世界对象 ID，确认后覆盖。损坏档不会自动重置。

**清理站点数据可能删除本地存档。请使用“导出备份”把 JSON 下载到站点之外。**同一浏览器中的存储不是独立备份。不承诺完全断网启动，尚未实现资源缓存。

## 实现和证据

- `src/data`：稳定对象 ID、地图、物品和任务文本。
- `src/game/entities`：角色与动画；`systems`：输入、背包、音频与存档。
- `src/game/scenes`：世界、碰撞、交互、战斗和渲染；`ui`：共享同一游戏状态的界面。
- `public/assets/manifest.json`：素材来源、尺寸、锚点与动画配置；生成资源未完成商业权利审查。
- `docs/STATUS.md`：准确完成边界；`docs/REFERENCE.md`：视觉比对；`docs/screenshots`：运行截图。

当前内容为首版冒险切片，10～20 分钟是设计目标，未完成首次玩家时长盲测。画面接近程度、功能通过和帧率测试分别记录，不相互代替。

依赖锁定：Phaser 4.2.1、Vite 8.3.1、TypeScript 7.0.2、Vitest 5.0.1、Playwright 1.63.0。以 `package-lock.json` 为准。已核对 [Phaser 官方版本页](https://phaser.io/download/phaser4) 和 [Vite 官方运行要求](https://vite.dev/guide/)，并使用安装版本的类型定义检查 API。

## 移动动画专项（第二轮）

当前已接入四方向待机／行走及独立侧向奔跑；竖向奔跑暂用同方向行走，尚待补齐。启动开发服务后访问 `/docs/animation/index.html` 观看上一轮通过版本与当前版本的正常速度录屏、各方向放大循环和接触表。`/animation-preview.html` 可选择动作；`/?animationDebug=1` 开启开发诊断，生产版默认不提供。

详细素材、验证与剩余任务见 [第二轮报告](docs/animation/ROUND-TWO.md)。生成素材及原始提示词在 `public/assets/animation/round-two`，上一轮基线保留在 `docs/animation/round-one`。
