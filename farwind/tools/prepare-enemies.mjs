import sharp from "sharp";
const p = "public/assets/";
const m = await sharp(p + "enemies-source.png").metadata();
console.log(m.width, m.height);
for (let row = 0; row < 2; row++) {
  const layers = [];
  for (let col = 0; col < 4; col++) {
    const b = await sharp(p + "enemies-source.png")
      .extract({
        left: col * Math.floor(m.width / 4),
        top: row * Math.floor(m.height / 2),
        width: Math.floor(m.width / 4),
        height: Math.floor(m.height / 2),
      })
      .png()
      .toBuffer();
    const t = await sharp(b)
      .trim({ threshold: 15 })
      .resize(112, 108, { fit: "inside" })
      .png()
      .toBuffer();
    const d = await sharp(t).metadata();
    layers.push({
      input: t,
      left: col * 128 + Math.floor((128 - d.width) / 2),
      top: 124 - d.height,
    });
  }
  await sharp({
    create: { width: 512, height: 128, channels: 4, background: "#00000000" },
  })
    .composite(layers)
    .png()
    .toFile(p + (row ? "leaf" : "slime") + ".png");
}
