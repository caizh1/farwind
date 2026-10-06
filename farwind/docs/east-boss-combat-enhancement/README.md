# 东侧首领攻击增强交付

打开 [录像与截图](review.html)，或阅读 [中文验收记录](VALIDATION.md)。

- [增强前后正常速度对照](evidence/combat-comparison.mp4)
- [增强前后四分之一慢放](evidence/combat-comparison-quarter.mp4)
- [完整赤环](evidence/laser-normal.mp4)／[慢放](evidence/laser-quarter.mp4)
- [完整双镰](evidence/scythe-normal.mp4)／[慢放](evidence/scythe-quarter.mp4)
- [施法中的黑洞实战](evidence/black-hole.webm)
- [普通弹反](evidence/parry-normal.webm)／[完美弹反](evidence/parry-perfect.webm)
- [指标索引与原始采样位置](measurements.json)

采样文件采用压缩保存，解压后仍可核对完整正式状态。正常速度录像和慢放不补间，原录屏为 25 帧每秒，展示版为 1080p／60 帧输出。

复现时在独立副本启动 5368，以增强前的副本启动 5367；共享现有公开素材和依赖。通过正式导入入口加载 `fixtures` 的初始样本，不能向自己的正常旅途直接导入这些测试存档。

检查命令：

```sh
npx playwright test --config tools/playwright-east-boss-combat.config.ts
```

样本生成工具是 `tools/create-east-boss-combat-fixtures.mjs`，基于已保留的上一轮初始样本；录像整理工具是 `tools/export-east-boss-combat-videos.py`。正常键鼠推进后才获得实战结果，生成初始存档不能代替实际验收。
