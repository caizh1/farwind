# 最终运行源码与素材摘要

HEAD：`e54693c71b902e7d40844723067e850b68fb3db5`；分支 `codex/initial-game`；开始时工作树干净，下面为本轮未提交修改后的SHA-256。录屏对应该HEAD加本轮修改，不是新的已提交版本。

- `src/data/animation.ts`：`d31f02493ba8f046daa8db7026b27a2be93aa4f3e17ffb2067282c22795d6dba`
- `src/game/entities/actor.ts`：`8e298466667df153d12592a1906da969bcf6f23763e554aa37698882511802b9`
- `src/game/scenes/World.ts`：`cad0b0050352c356df0556c90cc847a7f888bf155074400b87216d943d2739cc`
- `src/game/systems/combat.ts`：`02d849bd7f7fd8701638858b5d6a744f13bc209204dc7f76c61a1f72c09f3f10`
- `src/game/systems/audio.ts`：`4c50d9e9c971eeb1dde113d25a72d3e0c5dd3e138bb8e31edabb4149c73f0d3e`
- `src/game/systems/weaponTrail.ts`：`21071ab6f1d75ce5ca44d3c7fb3c3a0814b4448ead9823fa4d963c8a21ca8373`
- `src/game/systems/locomotion.ts`：`da7cd2373af25815115bc7b7a135e593123eb33dd99a7cceb7371b30d0c84148`
- `src/game/systems/sprint.ts`：`ed8e5e1245de124c78a8ccbe29fa4142e6e3c04c9d8142d44906209397438bfc`
- `src/game/systems/session.ts`：`b5b3fec49f3168ddf45d700c25154efcdc92a9b38ff3fef2226187f83561fa9a`
- `src/game/systems/state.ts`：`d14fcef3915f81af761be7a83cfd65019848a3fd5e74f39b4e651f82b8e9a9ca`
- `package-lock.json`：`2609c89f1f9d5e3e5c770eee20eac5f6eced41d47f6b57cd5592ecd3002bd9be`
- `public/assets/animation/hero-combat-side.png`：`e506f46f6548388a8ffea32a55acfedecf95c70179cc899d45ed50a1b8310916`
- `public/assets/animation/hero-carry-sword.png`：`74c473c5b2ff7f5f2bc2fa2a90a916f014b410ccf9d5ba9a22e5d21a51622990`
- `public/assets/animation/hero-combat-action.png`：`d29789879c44668523cb150035409b8d14b59acdf4da810f57823c104aa6d2b1`
- `public/assets/animation/round-three/hero-motion.png`：`cf7bbe438ecfe2b43b1375aa985e8df5f7c480db2c51dc615d578df2ffc46acc`
- `public/assets/animation/round-three/cat-motion.png`：`f4336eda1122da68c63c6bf951092ab37fac9e8074d79eb85876fccddd1a533b`
- `docs/combat-feel/assets/side-combo-source.png`：`6eb8133379bc087e0683f3cf1c39b8d1ecb36fad5506685728946b05c8fa24ab`

外部用户视频：无构建号，9.256667秒，2294×1490，120fps，无音轨；SHA-256：`b71040e7fcef4c6735b5570d4ffe30aac88571f87ccd8a4c187db315ff5b2a67`。不可据此声称与源码逐文件一致。

## 验证工具与测试摘要

- `tests/adventure.spec.ts`：`8749cfc19ad705cfe41257726a7eccc2b9872c8406e63ee60c1ae6a3f75856d2`
- `tests/combat-action.spec.ts`：`71921927288e9a9fb8c107b520a29593a3de6867346099492cbbf937613bfbfe`
- `tests/combat-feel.spec.ts`：`93a626a0e557083d8ad8ff0b927c318246ab1808d156350266276d953dde6d68`
- `tests/combat-followup.spec.ts`：`635cbe465519f9e5b294c7779df5b12c9fc88d6e82c49bc6b6b17c37a0129d2b`
- `tests/combat.spec.ts`：`8480d79b266855d0c2a7fcabaf7a63b6ba0c0d847b40c38250282eb1b2dd39c0`
- `tests/combat.test.ts`：`8a7c59ea482ef20f1ca043eb97dfbb843704e6dc249ca0745d260b2e75a5db65`
- `tools/capture-game-audio.mjs`：`25d4478c022abaeea3a605090edf83236ac89af397c262492f4eb244441d316d`
- `tools/combat-feel-preview.html`：`418b16edbab35140ed32fbb671b15c0bf7aad743f4c8954fcdd9cd86c9589bb6`
- `tools/pack-combat-feel.mjs`：`5f6138245ef70b1af21e9b31bb8cf2cbaa70c55e4761f0e4aee336737a8c68bc`
- `tools/record-combat-feel.mjs`：`f395fa157e27768d1c69b5c3b2485ba7d090374e6521ffb74127c8e2c557dd1e`
