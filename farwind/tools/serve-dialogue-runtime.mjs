import { cp, mkdir, symlink, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

// 测试当前源码的等内容副本，隔离其他工作的热更新；不修改任务或运行状态。
const root = ".dialogue-local/runtime";
await mkdir(root, { recursive: true });
for (const path of ["src", "public", "index.html", "package.json", "tsconfig.json", "docs/dialogue-portraits/preview.html", "docs/dialogue-portraits/evidence/preview-world.png"])
  await cp(path, `${root}/${path}`, { recursive: true });
try { await symlink("../../node_modules", `${root}/node_modules`); }
catch (error) { if (error.code !== "EEXIST") throw error; }
const paths = ["src/game/ui/interface.ts", "src/style.css", "src/data/dialoguePortraits.ts", "src/game/systems/interactions.ts", "src/game/scenes/World.ts", "src/data/world.ts", "src/game/systems/input.ts", ...["healer", "elder", "carpenter"].map(id => `public/assets/portraits/${id}-neutral.webp`)];
await writeFile("docs/dialogue-portraits/evidence/runtime-snapshot.json", JSON.stringify({
  说明: "当前源码和资源等内容副本，只用于隔离热更新，无游戏状态注入，无公开部署",
  时间: new Date().toISOString(),
  文件: await Promise.all(paths.map(async path => ({ 路径: path, 摘要: createHash("sha256").update(await readFile(path)).digest("hex") }))),
}, null, 2));
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", root, "--host", "127.0.0.1", "--port", "5197", "--strictPort"], { stdio: "inherit" });
process.on("SIGTERM", () => child.kill());
process.on("SIGINT", () => child.kill());
child.on("exit", code => process.exit(code ?? 0));
