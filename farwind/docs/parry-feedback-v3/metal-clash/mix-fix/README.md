# 5173招架声遮蔽修复

5173实际服务目录为当前farwind工作区，HTTP返回的招架合成器已包含双剑金属音色；不是仅5226有新源码。用户已有标签页的缓存状态未读取，不能把“刷新”当作已确认的根因。

确认的混音缺陷：同一次已被招架截住的攻击，仍与招架声同帧播放enemy-strike低频冲撞。单音RMS约−19.00分贝，金属声约−29.49分贝，相差约10.5分贝。此前只确认音色接入，没有检查它在完整混音中被遮蔽，属于验证遗漏。

修复保留完整出手事实，只在音频提交时过滤该攻击编号的冲撞声。较早子步已启动的同次冲撞，在招架或余势承接时停止；声音结束、暂停／重置清理该索引。其他攻击编号的声音和整个威胁声部均保留。旧开发A／C对照仍保持历史声音，正式D使用修复。未改输入、窗口、伤害、失衡、动作、特效、总音量或金属声峰值；保留并行剑风呼啸及水景代码。

## 直接验证5173

七项浏览器检查在 <http://127.0.0.1:5173/> 上执行，不使用另一个冻结端口替代：普通成功连击、精准成功连击、风步取消、未招架真实伤害仍有出手声、双敌人余势、缓存／释放／静音、同帧与此前子步截停／其他威胁保留。仅合法初始存档导入，没有写运行中状态。85项相关逻辑通过，类型检查、生产构建通过，保留大分包提示。本次没有重跑历史全量检查。

[实际音轨对照](comparison.json)：接触起音后120毫秒，经700赫兹二阶低通测得RMS从−28.74降到−41.44分贝，约下降12.7分贝。滤波不是理想频带分割；两个独立操作样本也不是主观等响实验。设备听感仍需用户确认，不宣称已认可。

[5173普通实机](ab-D.mp4)、[精准实机](perfect-combo.mp4)、[合法取消](cancel.mp4)均为正常速度、实际游戏音轨，无后期补音。[真实接口反例](intercepted-strike.json)检查只截住对应来招，另一攻击保持发声；[未招架](unparried-strike.json)保留真实伤害及出手声。开发诊断音频配置为“双剑金属／同来招截停”。

改动：`combatFeedback.ts`增加有界批次音频选择；`audio.ts`增加按攻击编号的声音截停与清理；`World.ts`改为批次音频提交；原专项测试扩展两项逻辑和两项浏览器检查。原始报告、追踪与WebM在忽略目录 `.parry-local/metal-mix/`；未提交、推送或部署。

重新验证可使用本地临时配置：`FARWIND_V3_EVIDENCE_ROOT=docs/parry-feedback-v3/metal-clash/mix-fix FARWIND_V3_RAW_ROOT=.parry-local/metal-mix/recording npx playwright test --config .parry-local/metal-mix/playwright.config.mjs --grep 'V3-AB-D-normal|V3-VISUAL-perfect-hit-combo|V3-VISUAL-cancel-no-false-hit|V3-AUDIO-|V3-INTEGRATION-two-enemies'`。
