# M3素材与生成提示

使用内置图像生成工具，不使用CLI。旧carpenter.png和house.png已查看，仅作笔触、视角、头身比、石木材质与左上光照参考；没有复制设计图文字到游戏。

## 近战守卫

保存：[guard-source.png](/Users/archer/.codex/worktrees/farwind-east-defense-m3/Game/farwind/public/assets/village-defense/m3/guard-source.png)。

最终提示：手绘2D游戏守卫动作图集，旧木匠仅匹配手绘线条、头身比和左上柔光。透明PNG，严格6列×3行，共18个独立完整人物；每格足底同一位置，无格线、文字或背景。年轻村庄近战守卫，蓝灰罩衫、链甲、棕皮靴，短铁剑与小木盾。第一行正面向下，依次站立、左脚迈步、右脚迈步、举剑准备、短剑斩出、受击后仰；第二行背向上，同六动作；第三行朝右，同六动作，左向由游戏镜像。固定2D俯视游戏略看头顶，完整剑盾不过格，留透明边距。自然色纸感手绘，非像素、等距、3D或写实人像。真正透明底，不画棋盘底和文字。

## 塔上弓手

保存：[archer-source.png](/Users/archer/.codex/worktrees/farwind-east-defense-m3/Game/farwind/public/assets/village-defense/m3/archer-source.png)。

最终提示：手绘2D游戏弓手动作图集，旧木匠仅匹配笔触、头身比和左上柔光。真正alpha透明PNG，禁止棕底、黑底、棋盘、渐变。4列×2行，8个完整人物，统一脚点、留边距，无网格文字。年轻村卫，暗绿罩衣、皮胸甲、棕靴、短木弓和箭袋。全部朝右，第一行依次放松持弓、搭箭、拉满弓、松弦箭刚离弓；第二行收弓、微转身警戒、受击后仰、倒地死亡。固定俯视游戏略见头顶，自然色手绘，不越格或裁切，不是像素、等距或3D。

## 东门小木塔

保存：[watchtower-candidate.png](/Users/archer/.codex/worktrees/farwind-east-defense-m3/Game/farwind/public/assets/village-defense/m3/watchtower-candidate.png)。

最终提示：小型村庄木哨塔，旧房屋只匹配手绘笔触、视角、石木材质和左上光照。石矮脚基座、粗木支柱、上层开放箭手平台、少量栏杆和小橙红瓦雨棚，画面右侧突出开放射击平台，留一名弓手空位。固定2D俯视的正面偏俯视，不做等距菱形。完整居中建筑，无人、无箭、无UI文字、无大片地面；基座窄，上层稍宽，非大型城堡。真正alpha透明底，不画棋盘、网格、黑棕底或渐变，不裁切。

## 图集登记与候选状态

生成源图未像素编辑。按等分矩形登记Phaser帧，读取每格透明轮廓建立脚点；登记见src/data/defense-art.json。角色身体约87像素高，塔运行200×270；动作显示仍以地面根与每帧脚点分开。候选已在实机与旧角色、木匠、房屋、树木同屏检查，但尚未经人工美术确认，主素材清单保持临时。不能因测试成功或截图存在而取消临时标记。
