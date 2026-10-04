# 地图缩放专项验收

日期：2026年10月3日。本机固定生产构建 `game-BHXM1LW8.js` 运行于5309端口，浏览器使用真实键鼠与触控输入。源码和素材指纹见 `evidence/source-record.json`。所有读取通过只读观察接口，不授予能力、生命或坐标，不使用传送替代通行。

## 已完成的验证

六个逻辑文件共51项一次通过，覆盖缩放锚点、极端倍率、大陆边界、城市外缘定位、原野地图、地图迁移、商路与城市几何及连续通路。命令：

```sh
npx vitest run --maxWorkers=1 --testTimeout=30000 tests/map-viewport.test.ts tests/first-map.test.ts tests/map-expansion.test.ts tests/wilderness-map.test.ts tests/windwhisper-city.test.ts tests/city-route-path.test.ts
```

类型检查和生产构建通过。构建保留既有大分包提示，不作为地图阻塞。没有增加依赖，未提交、推送或部署。

浏览器专项验证：

| 场景 | 已核对内容 |
| --- | --- |
| 输入与世界 | 新档空商路节点；指针下坐标稳定；真实滚轮和拖动；地图标签点击风语城；未开放介绍可见；放大按钮、键盘与最近1000单位边界；主角定位；正式进度不变 |
| 触控与布局 | 双指缩放和取消；1280×720、1440×900、800×600、390×844、320×640、600×420、390×420、320×480；无横向溢出、画布不越过关闭栏 |
| 生命周期 | 八次M开关、Home、暂停子菜单返回、HUD鼠标打开及关闭后真实奔跑；体力实际消耗；无浏览器异常 |
| 默认区域 | 正式导入合法固定样本，原野外商路、城市、城市外缘及室内入口定位；窗口调整后主角仍处于视口；此项不是连续通行证明 |

本机 Chrome 另核对600×420横屏：地图完整位于容器内，关闭栏可见；测试后恢复正常窗口。见 `evidence/native-window-record.json`。

## 设计与实机对照

世界、原野、城市设计源图见 `design/`。额外地物的校核与处理见 `DESIGN.md`。已开放区域以真实几何裁剪 imagegen 材质；道路、水域、桥梁、城墙和建筑不采用概念图中的虚构位置。

- [世界实机](evidence/world-runtime.png)
- [原野实机](evidence/plains-runtime.png)
- [城市实机](evidence/city-runtime.png)
- [商路实机](evidence/road-runtime.png)
- [最近倍率](evidence/local-runtime.png)
- [低矮横屏](evidence/viewport-600-420.png)
- [窄屏](evidence/viewport-320-480.png)

## 缩放性能

固定浏览器键鼠样本覆盖区域—世界—城市—商路—最近倍率、定位和平移。记录48次绘制，平均约0.65毫秒，P95约1.3毫秒，生成105块、缓存峰值96块；上限得到实际触发验证。返回区域后共54次绘制，平均约0.67毫秒，P95约2.9毫秒。见 `evidence/input-record.json`。

这些是地图绘制耗时，包含本机与软件渲染环境影响，不代表完整游戏帧率或所有设备性能。没有持续空闲重绘；关闭释放视口事件和缓存。

## 真实往返

新档正式邀请小宝同行、用初始金币购买补给，并用真实键鼠沿原野—商路—跨河桥—风语城路线行走。进城后保存、刷新并继续，城市默认地图、访问状态和商路种子回读一致；随后原路跨桥返回原野东口。全程无导入、传送、授予或运行状态改写。最终本趟待领风赐为0，不把这趟录像当作有待领候选的实战回读证明。录制辅助流程支持正式“稍后再选”，修复过程中的候选页面证据单独保留。

耗时约164.2秒，返程坐标约（4229.2，1600.1），生命90，浏览器异常0。返程终点位于原野旧范围内，M恢复默认原野地图。本项验收城市与原野的连续往返，不包含额外回村导航或全战斗通关。

[完整往返录像](evidence/map-real-continuous-walk.webm)、[只读运行记录](evidence/walk-record.json)、[桥头实机](evidence/walk-bridge.png)、[城市刷新](evidence/walk-city-reload.png)、[返程默认原野地图](evidence/walk-return.png)。

五项浏览器场景在同一固定候选构建通过：前四项来自一次专项，完整往返单独通过。复验命令如下，均为单工作进程、无重试：

```sh
npx playwright test --config tools/playwright-map-zoom.config.ts --grep 'map-input-and-world|map-touch-and-responsive|map-lifecycle-and-focus|map-default-area-and-interior'
npx playwright test --config tools/playwright-map-zoom.config.ts --grep map-real-continuous-walk
```

各场景的录像与中文运行记录保存于 `evidence/`；首因失败不被计为通过。

## 首因与验收边界

修复真实新档空节点、指针坐标换算、城市外缘默认范围、旧画布边距裁切、选区地点列表及地区介绍可见性。测试自身的动画终值、观察接口延迟、按钮状态排队和奖励页处理均按实际生命周期修正，没有绕过正式状态。失败证据见 `evidence/failures/`，不由简单重试掩盖首因。

全项目所有并行改动未完整回归；最终美术偏好、实体触控板与移动浏览器、低性能设备仍未验证。审查见 `REVIEW.md`。

## 最终审查结论

VERDICT: PASS

P0/P1 BLOCKERS: 无。

UNVERIFIED RISKS: 实体触控板、移动浏览器、低性能设备、最终美术偏好及全项目并行战斗改动尚未完整验收，不影响本轮地图结论。

NON-BLOCKING FINDINGS: 既有构建大分包提示；规划区域底图不代表已实现玩法。
