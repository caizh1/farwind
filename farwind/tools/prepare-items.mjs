import sharp from "sharp";
const p = "public/assets/";
const m = await sharp(p + "items-source.png").metadata();
console.log(m.width, m.height);
const names = [
  "wood",
  "stone",
  "herb",
  "berry",
  "potion",
  "crystal",
  "charm",
  "sword",
];
for (let i = 0; i < 8; i++) {
  const b = await sharp(p + "items-source.png")
    .extract({
      left: (i % 4) * Math.floor(m.width / 4),
      top: Math.floor(i / 4) * Math.floor(m.height / 2),
      width: Math.floor(m.width / 4),
      height: Math.floor(m.height / 2),
    })
    .png()
    .toBuffer();
  await sharp(b)
    .trim({ threshold: 15 })
    .resize(96, 96, { fit: "contain", background: "#00000000" })
    .png()
    .toFile(p + "icon-" + names[i] + ".png");
}
