import { cp, mkdir, symlink, writeFile, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import { resolve } from "node:path";
const root = process.env.FARWIND_WIND_RUNTIME ?? ".sword-wind-local/runtime",
  port = Number(process.env.FARWIND_WIND_PORT ?? 5193);
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
for (const path of [
  "src",
  "public",
  "index.html",
  "package.json",
  "tsconfig.json",
  "docs/sword-wind/assets",
  "tools/sword-wind-arena.html",
  "tools/sword-wind-arena.ts",
])
  await cp(path, `${root}/${path}`, { recursive: true });
await symlink(resolve("node_modules"), `${root}/node_modules`);
const sources = [
  "src/game/scenes/World.ts",
  "src/game/systems/combat.ts",
  "src/game/systems/swordWind.ts",
  "src/game/systems/swordWindGeometry.ts",
  "src/game/entities/swordWindView.ts",
  "src/game/systems/skills.ts",
  "src/game/systems/state.ts",
  "src/game/systems/timeline.ts",
  "src/game/systems/enemy.ts",
  "src/game/systems/contact.ts",
  "src/data/animation.ts",
  "src/data/swordWind.ts",
  "src/data/swordWindArt.ts",
  ...[
    "hero-sword-wind",
    "sword-wind-release",
    "sword-wind-flight",
    "sword-wind-hit",
    "sword-wind-dissolve",
    "sword-wind-ground",
  ].map((n) => `public/assets/animation/sword-wind/${n}.png`),
];
await writeFile(
  `docs/sword-wind/evidence/runtime-${port}.json`,
  JSON.stringify(
    {
      说明: "当前工作区等内容冻结副本，防止并行任务热更新扰动；未修改运行中角色、敌人或计时器",
      端口: port,
      开发授予: process.env.VITE_DEV_GRANT_SWORD_WIND !== "0",
      时间: new Date().toISOString(),
      文件: await Promise.all(
        sources.map(async (p) => ({
          路径: p,
          摘要: createHash("sha256")
            .update(await readFile(p))
            .digest("hex"),
        })),
      ),
    },
    null,
    2,
  ),
);
const server = await createServer({
  root: resolve(root),
  cacheDir: resolve(`${root}-cache`),
  server: { host: "127.0.0.1", port, strictPort: true },
});
await server.listen();
server.printUrls();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
