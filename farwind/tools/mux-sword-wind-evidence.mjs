import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const raw = ".sword-wind-local/recording",
  dir = "docs/sword-wind/evidence",
  ffmpeg = "/opt/homebrew/bin/ffmpeg",
  ffprobe = "/opt/homebrew/bin/ffprobe";
const names = [
  "two-targets",
  "three-only",
  "four-directions",
  "range-wall",
  "cancel-pause-title",
  "parry-fourth",
  "save-focus",
  "death-drop",
  "remote-dash-training",
  "grant-off-three",
  "grant-off-restart",
  "grant-off-save-focus",
  "adventure",
  "rise-ground",
];
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) throw Error(`媒体处理失败：${r.stderr}`);
  return r;
};
const reports = [];
for (const name of names) {
  const media = JSON.parse(await readFile(`${dir}/${name}-media.json`, "utf8")),
    out = `${dir}/${name}.mp4`;
  run(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    `${raw}/${name}-video.webm`,
    "-itsoffset",
    String(media.音频偏移秒),
    "-i",
    `${raw}/${name}-audio.webm`,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-shortest",
    "-movflags",
    "+faststart",
    out,
  ]);
  const probe = JSON.parse(
      run(ffprobe, [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,codec_type,width,height,sample_rate",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        out,
      ]).stdout,
    ),
    volume = run(ffmpeg, [
      "-i",
      out,
      "-vn",
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ]).stderr;
  const frames = JSON.parse(
      await readFile(`${raw}/${name}-trace.json`, "utf8"),
    ),
    first = frames[0],
    last = frames.at(-1),
    ratio = (last.时间 - first.时间) / (last.墙钟 - first.墙钟);
  reports.push({
    名称: name,
    文件: out,
    媒体: probe,
    峰值分贝: volume.match(/max_volume: ([\d.-]+) dB/)?.[1] ?? "无",
    模拟与墙钟比: ratio,
    说明:
      name === "two-targets"
        ? "固定共线敌人夹具，不运行敌人AI；原速封装，真实音轨"
        : "含起始存档夹具／诊断辅助输入及菜单暂停；不变速，真实音轨",
  });
}
await writeFile(
  `${dir}/media-check.json`,
  JSON.stringify(
    {
      说明: "只封装真实录像和游戏音轨，没有补配假音效；模拟与墙钟比包含菜单暂停、加载和命中停顿，不是设备性能测量。音色尚未试听验收。",
      录像: reports,
    },
    null,
    2,
  ),
);
console.log("十四段正常比例录像已封装，媒体检查已记录。");
