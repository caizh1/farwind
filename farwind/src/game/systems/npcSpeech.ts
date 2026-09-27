import {
  LIFE,
  MAINTENANCE,
  person,
  type Activity,
  type ResidentId,
} from "../../data/npcLife";
import type { NpcLife } from "./npcLife";
import type { Memory, PersonState } from "./npcLifeState";
import { distance, spaceClear } from "./npcNavigation";

export type LifeSpeech = {
  speaker: ResidentId;
  text: string;
  until: number;
  urgent: boolean;
  actionId: number | null;
};
type Line = {
  text: string;
  priority: number;
  memory?: Memory;
  routine?: Activity;
};
const routine = (n: PersonState): string | undefined => {
  const a = n.action;
  if (
    !a ||
    a.phase !== "perform" ||
    ["sleep", "shelter", "treat", "escort"].includes(a.kind)
  )
    return;
  if (n.id === "healer") {
    if (a.kind === "work")
      return a.facility === "pharmacy"
        ? "这批药还在配，救护用的要先留好。"
        : "叶片晒透了，配药才稳妥。";
    if (a.kind === "habit") return "这片叶子的脉络，图鉴里还少一笔。";
    if (a.kind === "eat") return "先吃点东西，下午还有药田要照看。";
  }
  if (n.id === "carpenter") {
    if (a.kind === "work") return "说是麻烦，工具总不能放着不修。";
    if (a.kind === "habit")
      return n.project >= 66
        ? "木鸟快成了，还得把翅膀修细些。"
        : "这一刀慢些，木鸟才留得住神气。";
    if (a.kind === "repair") return "工具带到了，先把这处修结实。";
  }
  if (n.id === "elder") {
    if (a.kind === "work") return "听听风铃，再把今日风向记下。";
    if (a.kind === "habit" || a.kind === "rest")
      return "歇一会儿，村里的旧事还长着呢。";
    if (a.kind === "count")
      return n.reason.includes("已确认")
        ? n.reason
        : "先在集结处核对同伴，未知的去向要报告。";
  }
  if (!["rest", "habit"].includes(a.kind)) return;
  if (!n.id.includes("-")) return;
  if (n.id === "east-watch") return "村门和装备都得常看，撤离通道要留着。";
  if (n.id === "east-patrol") return "训练扎实些，遇到求援才帮得上忙。";
  if (n.id === "east-archer") return "先整理箭羽，再看村外动静。";
  return n.id.includes("archer")
    ? "箭羽得收齐，轮到值守时才不会慌。"
    : "趁轮休检查一下自己的装备。";
};
const memoryLine = (n: PersonState, m: Memory): Line | null => {
  const heard = m.source === "report" ? "听同伴说，" : "刚才看到，",
    name = person(m.subjects[0])?.name ?? "同伴";
  if (
    ["injury", "down"].includes(m.kind) &&
    n.memories.some(
      (later) =>
        later.sequence > m.sequence &&
        ["care", "help", "death"].includes(later.kind) &&
        later.subjects[0] === m.subjects[0],
    )
  )
    return null;
  if (
    ["care", "help"].includes(m.kind) &&
    n.memories.some(
      (later) =>
        later.sequence > m.sequence &&
        ["injury", "down", "death"].includes(later.kind) &&
        later.subjects[0] === m.subjects[0],
    )
  )
    return null;
  if (m.kind === "alarm" && n.alarm === 2)
    return {
      text:
        n.id === "healer" && n.gear === "carried"
          ? "先走安全通道！我带着药箱。"
          : n.id === "elder"
            ? "到安全集结处，先清点同伴。"
            : "先保住人，沿安全通道转移！",
      priority: 110,
      memory: m,
    };
  if (m.kind === "down" || m.kind === "injury")
    return {
      text: `${heard}${name}需要救护，先确认安全路线。`,
      priority: 100,
      memory: m,
    };
  if (m.kind === "death")
    return {
      text: `${heard}${name}没能回来。先照顾还在的人。`,
      priority: 100,
      memory: m,
    };
  if (m.kind === "help")
    return {
      text:
        m.subjects.includes(n.id) && m.source !== "report"
          ? "谢谢你到场照护，我记住了。"
          : `${heard}玩家到场帮忙照护了伤员。`,
      priority: 90,
      memory: m,
    };
  if (m.kind === "company")
    return {
      text: `${m.source === "report" ? "听同伴说，" : "刚才，"}${m.result}。慢慢恢复就好。`,
      priority: 80,
      memory: m,
    };
  if (m.kind === "care")
    return {
      text: `${heard}${name}已经接受救治，让伤员慢慢休养。`,
      priority: 90,
      memory: m,
    };
  if (
    m.kind === "damage" &&
    !n.memories.some(
      (later) =>
        later.sequence > m.sequence &&
        later.kind === "repair" &&
        later.subjects[0] === m.subjects[0],
    )
  )
    return {
      text: `${heard}${MAINTENANCE.find((f) => f.id === m.subjects[0])?.name ?? "设施"}受损了，安全后再去检查。`,
      priority: 75,
      memory: m,
    };
  if (m.kind === "repair")
    return {
      text: `${heard}${m.result}。日常可以慢慢恢复了。`,
      priority: 70,
      memory: m,
    };
  if (m.kind === "clear" && n.alarm === 0)
    return {
      text: "警报解除了，先核对同伴和伤情，再恢复日常。",
      priority: 80,
      memory: m,
    };
  return null;
};

// 可读性层只读取人物知道的事实；短句不产生任务、关系、物品或阻断窗口。
export function chooseSpeech(life: NpcLife): LifeSpeech | null {
  const l = life.data;
  const observer = { ...life.state.player, space: l.playerSpace },
    day = Math.floor(life.state.time / 1440);
  const options: { n: PersonState; line: Line; distance: number }[] = [];
  for (const n of l.people) {
    const p = life.body(n.id)!;
    if (
      n.body?.health === "down" ||
      (n.action?.kind === "sleep" && n.action.phase === "perform") ||
      !life.live(n.id) ||
      p.space !== observer.space ||
      distance(p, observer) > LIFE.speechRadius ||
      !spaceClear(p.space, p, observer)
    )
      continue;
    if (n.speech.day !== day) {
      n.speech.day = day;
      n.speech.routines = [];
    }
    const lines = n.memories
      .filter(
        (m) =>
          m.sequence > Math.max(n.speech.eventFloor, l.speechEventFloor) &&
          m.expires >= life.state.time &&
          life.state.time - m.time < 180,
      )
      .map((m) => memoryLine(n, m))
      .filter((line): line is Line => !!line)
      .sort(
        (a, b) =>
          b.priority - a.priority || b.memory!.sequence - a.memory!.sequence,
      );
    let line = l.elapsed >= l.speechUrgentAt ? lines[0] : undefined;
    if (
      !line &&
      l.elapsed >= l.speechAt &&
      l.elapsed >= n.speech.nextAt &&
      n.action &&
      !n.speech.routines.includes(n.action.kind) &&
      n.alarm !== 2 &&
      life.safe(observer, 550)
    ) {
      const text = routine(n);
      if (text) line = { text, priority: 10, routine: n.action.kind };
    }
    if (line) options.push({ n, line, distance: distance(p, observer) });
  }
  options.sort(
    (a, b) => b.line.priority - a.line.priority || a.distance - b.distance,
  );
  const chosen = options[0];
  if (!chosen) return null;
  const { n, line } = chosen;
  if (line.memory) {
    n.speech.eventFloor = Math.max(n.speech.eventFloor, line.memory.sequence);
    l.speechEventFloor = Math.max(l.speechEventFloor, line.memory.sequence);
    l.speechUrgentAt = l.elapsed + LIFE.speechAreaMs;
  }
  if (line.routine) n.speech.routines.push(line.routine);
  n.speech.nextAt = l.elapsed + LIFE.speechPersonMs;
  l.speechAt = l.elapsed + LIFE.speechAreaMs;
  return {
    speaker: n.id,
    text: line.text,
    until: l.elapsed + LIFE.speechMs,
    urgent: line.priority >= 80,
    actionId: n.action?.id ?? null,
  };
}
