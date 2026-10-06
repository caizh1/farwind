# 东侧首领白边修复验收

日期：2026-10-06。已修复压缩图集的透明混合错误，5173 已提供新素材；已有浏览器需刷新以释放旧纹理。

## 原因与修复

原压缩图集保存普通透明颜色，Phaser 普通混合使用预乘颜色，压缩上传不会自动进行该转换。因此透明区域扩散的亮色也进入画面，形成整圈亮边。

现在仅在 DXT5 压缩前将颜色乘透明度；PNG 仍采用普通透明，由浏览器正常上传。透明区域由邻近像素逐圈复制整组颜色，不再逐通道取最大值。没有硬裁透明度或缩小轮廓，没有重做模型、动作和战斗。

清单增加透明格式标记与内容摘要。请求地址和纹理键使用内容摘要，清单要求重新校验缓存；旧清单没有预乘格式标记时走 PNG。当前资源摘要：`e1b341b3d2c43841b7b0d285f8748d3bfb4d8ad8475fbee78073667450462fc3`。

## 验证结果

- 从现有母版重打包四十片段、八方向、七千三百二十八采样、六百七十一页。全部帧坐标、裁切尺寸、根点、特效挂点和时序与修复前逐项一致。
- 八方向固定姿势的边缘预乘颜色平均绝对误差由约一百零九至一百一十二，降为约一点二七至一点三六，量纲零至二百五十五。统计包括透明边缘邻域，不是全角色美术评分。
- 深浅背景下并排使用 Phaser 真正绘制修复前压缩图、修复后压缩图和 PNG。检查八方向；修复后没有连续白圈、黑框或透明矩形。DXT5 仍存在轻微块压缩误差，不宣称与 PNG 逐像素一致。
- 独立 5365 端口通过合法初始样本和真实键鼠检查起步、行走、双镰第一击、衔接和第二击。另以十二生命初始样本，通过普通剑击触发死亡，继续剧情对话后检查完整倒地淡出。没有运行中修改生命、位置或时钟；没有覆盖 5173 旅途存档。
- 本次实战纹理峰值为 201314176 字节，约 191.988 MiB，低于 192 MiB；记录中加载失败为零。
- 三项像素级回归、三十七项动画与图集测试、类型检查和生产构建通过。全部传输压缩包解包后与原 KTX 一致，内容摘要可重新计算验证。
- 只读请求确认 5173 的清单和首张压缩页与新本地文件一致。

## 证据

- [深色背景修复前后](evidence/alpha-fix/comparison-dark.png)、[浅色背景修复前后](evidence/alpha-fix/comparison-light.png)：从左到右为旧压缩、新压缩、PNG。
- [真实巢穴第二镰](evidence/alpha-fix/game-cross-right.png)、[真实行走](evidence/alpha-fix/game-walk.png)、[死亡淡出](evidence/alpha-fix/death-3.png)。
- [像素与打包审计](evidence/alpha-fix/audit.json)、[实战只读记录](evidence/alpha-fix/gameplay.json)、[死亡记录](evidence/alpha-fix/death.json)、[正式端口检查](evidence/alpha-fix/service-check.json)。
- `alpha-check.html` 可交互查看修复前后，使用独立检查纹理；该页面不用于衡量正式游戏的驻留预算。

复核命令：`python3 tools/test-east-boss-alpha.py`、`python3 tools/audit-east-boss-alpha.py`、`npx vitest run tests/east-boss-atlas.test.ts tests/east-boss-animation.test.ts --maxWorkers=1`、`npm run build`。

## 审查

VERDICT: PASS

P0/P1 BLOCKERS: 无。已检查普通透明与预乘路径隔离、旧清单兼容、内容版本更新、纹理键清理、预算及全局混合状态；反证后没有发现当前修改引入的阻塞问题。

UNVERIFIED RISKS: 未新增低端设备或其他 GPU 压缩格式验收；仅对当前本机环境确认视觉效果。

NON-BLOCKING FINDINGS: DXT5 的轻微颜色误差仍存在；传输压缩总量约三百七十六 MiB，公网加载优化仍是独立工作。原整场验收报告中的旧下载体积与旧截图作为历史记录保留。
