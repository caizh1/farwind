import {
  cp,
  mkdir,
  mkdtemp,
  symlink,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "vite";
// 冻结当前工作区的等内容副本，隔离开发热重载；不改变游戏状态。
const root = await mkdtemp(join(tmpdir(), "farwind-hud-runtime-"));
for (const path of [
  "src",
  "public",
  "index.html",
  "package.json",
  "tsconfig.json",
  "docs/hud-redesign/design",
  "docs/hud-redesign/before",
])
  await cp(path, `${root}/${path}`, { recursive: true });
await symlink(resolve("node_modules"), `${root}/node_modules`);
const paths = [
  "src/game/ui/interface.ts",
  "src/style.css",
  "src/game/systems/input.ts",
  "src/game/scenes/World.ts",
  "src/game/systems/state.ts",
  "src/data/world.ts",
  "src/main.ts",
  ...["carpenter-workbench", "plaza-fountain", "pond-water"].map(
    (id) => `public/assets/village-polish/${id}.png`,
  ),
];
await mkdir("docs/hud-redesign/after", { recursive: true });
await writeFile(
  "docs/hud-redesign/after/runtime-snapshot.json",
  JSON.stringify(
    {
      说明: "等内容源码和资源副本，仅用于稳定本地验收；无公开部署，无状态注入。",
      时间: new Date().toISOString(),
      目录: root,
      文件: await Promise.all(
        paths.map(async (path) => ({
          路径: path,
          摘要: createHash("sha256")
            .update(await readFile(path))
            .digest("hex"),
        })),
      ),
    },
    null,
    2,
  ),
);
const server = await createServer({
  root,
  cacheDir: join(root, "vite-cache"),
  server: { host: "127.0.0.1", port: 5198, strictPort: true, hmr: false },
});
await server.listen();
server.printUrls();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
