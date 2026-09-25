import sharp from "sharp";

const stages = ["one", "two", "three"];
const views = [
  { name: "down", foot: 500, height: 520 },
  { name: "up", foot: 540, height: 560 },
  { name: "side", foot: 515, height: 535 },
];
const frame = 160;
const sourceCell = 362;
const cropWidth = 560;
const scale = 0.28;
const out = [];

async function figures(source, height) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seen = new Uint8Array(info.width * info.height);
  const groups = [];
  for (let seed = 0; seed < seen.length; seed++) {
    if (seen[seed] || data[seed * 4 + 3] < 16) continue;
    const group = [seed];
    seen[seed] = 1;
    for (let i = 0; i < group.length; i++) {
      const at = group[i],
        x = at % info.width,
        y = Math.floor(at / info.width);
      for (const next of [at - 1, at + 1, at - info.width, at + info.width]) {
        if (next < 0 || next >= seen.length) continue;
        if (
          Math.abs((next % info.width) - x) +
            Math.abs(Math.floor(next / info.width) - y) !==
          1
        )
          continue;
        if (seen[next] || data[next * 4 + 3] < 16) continue;
        seen[next] = 1;
        group.push(next);
      }
    }
    if (group.length > 10000) groups.push(group);
  }
  if (groups.length !== 6)
    throw Error(`${source} 应有六个独立角色姿态，实际为 ${groups.length}`);
  groups.sort(
    (a, b) =>
      a.reduce((n, p) => n + (p % info.width), 0) / a.length -
      b.reduce((n, p) => n + (p % info.width), 0) / b.length,
  );
  return Promise.all(
    groups.map(async (group, pose) => {
      const canvas = Buffer.alloc(cropWidth * height * 4);
      const left = pose * sourceCell + sourceCell / 2 - cropWidth / 2;
      for (const pixel of group) {
        const x = (pixel % info.width) - left,
          y = Math.floor(pixel / info.width);
        if (x < 0 || x >= cropWidth || y >= height) continue;
        data.copy(canvas, (y * cropWidth + x) * 4, pixel * 4, pixel * 4 + 4);
      }
      return sharp(canvas, { raw: { width: cropWidth, height, channels: 4 } })
        .resize(Math.round(cropWidth * scale), Math.round(height * scale))
        .png()
        .toBuffer();
    }),
  );
}

for (let view = 0; view < views.length; view++) {
  let previousEnd;
  for (let stage = 0; stage < stages.length; stage++) {
    const source = `docs/combat-action/assets/${views[view].name}-strike-${stages[stage]}-source.png`;
    const cells = await figures(source, views[view].height);
    if (previousEnd) cells[0] = previousEnd;
    previousEnd = cells[5];
    for (let pose = 0; pose < cells.length; pose++)
      out.push({
        input: cells[pose],
        left: pose * frame + Math.round((frame - cropWidth * scale) / 2),
        top:
          (view * stages.length + stage) * frame +
          Math.round(154 - views[view].foot * scale),
      });
  }
}

await sharp({
  create: {
    width: frame * 6,
    height: frame * stages.length * views.length,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(out)
  .png()
  .toFile("public/assets/animation/hero-combat-action.png");
