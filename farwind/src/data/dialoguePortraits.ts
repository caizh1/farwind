export type DialoguePortrait = {
  src: string;
  alt: string;
  objectPosition: string;
};

// 对话专属独立立绘；世界图集继续由场景加载，未知标识不替换成其他人的脸。
export const dialoguePortraits = {
  healer: {
    src: "/assets/portraits/healer-neutral.webp",
    alt: "药师小满，棕色发髻，绿衣与米白围裙，手持药草和药篮",
    objectPosition: "50% 0%",
  },
  elder: {
    src: "/assets/portraits/elder-neutral.webp",
    alt: "守风人岚爷爷，灰白发须，绿色披肩，手扶木杖",
    objectPosition: "100% 0%",
  },
  carpenter: {
    src: "/assets/portraits/carpenter-neutral.webp",
    alt: "木匠阿禾，草帽与黑发须，米色衬衣和棕色工作围裙",
    objectPosition: "50% 0%",
  },
} as const satisfies Record<string, DialoguePortrait>;

export function dialoguePortraitFor(id: string): DialoguePortrait | undefined {
  return Object.hasOwn(dialoguePortraits, id)
    ? dialoguePortraits[id as keyof typeof dialoguePortraits]
    : undefined;
}
