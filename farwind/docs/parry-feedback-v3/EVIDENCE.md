# 弹反反馈第三轮证据索引

## 直接查看

[对照播放器](evidence/index.html)提供四版、13段正常速度实机、静音和分身份试听。当前本地地址：<http://127.0.0.1:5215/docs/parry-feedback-v3/evidence/index.html>，没有公开部署。

[完整联动](evidence/media/ab-D.mp4)可见来招／指示器、K成功、短停顿、拨开、自动24、停顿中J接二／三刀总74。[精准](evidence/media/perfect-combo.mp4)自动30、连击总80。音轨来自实际AudioContext，未后期补音。

## A／B同玩法对照

| 版本 | 内容 | 录像／事实 |
| --- | --- | --- |
| A | 原声音、固定反斩姿态、对称闪 | [录像](evidence/media/ab-A.mp4)／[事实](evidence/ab-A.json) |
| B | 只换声音／编排 | [录像](evidence/media/ab-B.mp4)／[事实](evidence/ab-B.json) |
| C | 只换真实扫掠、接触／命中闪、快速受力 | [录像](evidence/media/ab-C.mp4)／[事实](evidence/ab-C.json) |
| D | 完整联动 | [录像](evidence/media/ab-D.mp4)／[事实](evidence/ab-D.json) |

四版同合法初始慢速练习、装备与玩法参数。正常比例截图宽容区触发真实K，成功停顿真实J。它证明画面线索进入正式链路，不是人类反应或用户主观认可测试。

四版全片LUFS最大相差1.0；新首重拍RMS高于旧约1.3至1.7分贝、采样峰值更低，不称已主观等响。使用修正后的采集时钟重新录制，旧异步通知偏移批次保留本地。见[接触窗口](evidence/contact-audio-metrics.json)、[全片／重拍／提交索引](evidence/media-index.json)。

## 场景覆盖

| 场景 | 证据与类别 |
| --- | --- |
| 普通、自动反斩、停顿J连击 | 四版对照，画面触发B类 |
| 精准、双刃闪、30及连击 | [录像](evidence/media/perfect-combo.mp4)，画面触发B类 |
| 成功停顿风步取消，无第二重拍 | [录像](evidence/media/cancel.mp4)／[事实](evidence/cancel.json)，画面触发B类 |
| 正式史莱姆 | [录像](evidence/media/wild-slime.mp4)／[事实](evidence/wild-slime.json)，只读时序辅助A类 |
| 正式叶灵精准 | [录像](evidence/media/wild-leaf.mp4)／[事实](evidence/wild-leaf.json)，A类 |
| 两敌人一成功、一余势 | [录像](evidence/media/two-enemies.mp4)／[事实](evidence/two-enemies.json)，A类 |
| 叶灵投影、正确材质、无扣血 | [录像](evidence/media/leaf-projection.mp4)／[事实](evidence/leaf-projection.json)，A类 |
| 防御战敌人24 | [录像](evidence/media/defense.mp4)／[事实](evidence/defense.json)，A类 |
| 四方向、静音 | [结果](evidence/four-directions-muted.json)、[上](evidence/counter-up.png)、[下](evidence/counter-down.png)、[左](evidence/counter-left.png)、[右](evidence/counter-right.png)，A类 |
| 暂停、真实失焦、标题／续玩 | [录像](evidence/media/pause-reset.mp4)／[事实](evidence/pause-reset.json)，另有有头旧失焦回归 |
| 真实死亡／复活、新游戏清理 | [录像](evidence/media/death-newgame.mp4)／[事实](evidence/death-newgame.json)，合法初始生命1，不写运行生命 |
| 正式已解锁第四段36 | [事实](evidence/unlocked-fourth.json)，真实四段键盘 |
| 生产K／右键、成功自动24 | [截图](evidence/production.png)／[事实](evidence/production.json)，画面触发 |
| 缓存、同帧五身份、威胁声部、释放／静音 | [真实AudioContext](evidence/audio-context.json)，独立接口测试，不强制游戏成功 |

全部仅合法初始存档导入，未写运行中血量、位置、计时器或强制成功。A类内部时间用于精确联调，**不冒充只看怪物动作的人类手感证明**。

## 素材与首帧

[固定根六姿态](evidence/counter-fixed-preview.png)、[源图](assets/counter-source.png)、[根与武器点](assets/counter-manifest.json)。四方向固定根非零扫掠、左右镜像、真实剑尖像素由39项逻辑覆盖，图集仍临时。

[普通首重拍](evidence/ab-D-beat-1.png)、[普通次重拍](evidence/ab-D-beat-2.png)、[精准首重拍](evidence/perfect-combo-beat-1.png)按正常游戏比例提取。25帧录像间隔40毫秒，截图只接近提交时刻；首个呈现更新的姿态／闪光断言另用逐帧只读诊断。

[播放器页面](evidence/review-player.png)与[真实按钮结果](evidence/review-player.json)证明可直接播放，测试静音，不证明听感。内置浏览器动作接口未启动播放，未计成功。

## 声音与分析

[来源与暂定状态](ASSETS.md)、[单音指标](assets/audio/index.json)。普通／精准相同−9.90分贝采样峰值、不同刃鸣模态，破风／命中独立。33缓存与真实结束释放通过。

[媒体索引](evidence/media-index.json)含共同墙钟偏移、采集通知延迟、渲染时钟与墙钟差、采样峰值、FFmpeg过采样真峰值估计、全片LUFS、重拍模拟时刻／提交帧／音频提交差／报告输出延迟。最高真峰值估计−6.1分贝不证明全部极端叠音；设备延迟不为零，未测物理同步。

## 基线与未完成项

[修改前](evidence/baseline.json)：18文件309；[最终](evidence/validation.json)：20文件410、专项16、生产1，旧回归分批15+2通过。并发全量曾有1项居民模拟超时，独立运行通过，失败历史保留。原报告／大追踪在 `.parry-local/v3/`；[冻结源码](evidence/runtime-snapshot.json)、[交付源码与冻结玩法](evidence/final-source.json)定位版本。

[已有恢复边界失败](evidence/known-timing-edge.json)保留首因，不把成功录像当已修复。

已完成自动化事实与开发者固定预览／实际帧检查。未完成耳机／扬声器听感、长期疲劳、盲听辨识、关提示的人类节奏试玩、用户美术／手感认可、目标FPS／长压。全绿、素材生成或非静音均不能替代这些验收。
