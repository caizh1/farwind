// 正式世界与详情预览使用同一批透明手绘材质。
export const RUNE_ART = {
  phoenix: 'phoenix.webp',
  flame: 'flame.webp',
} as const;
export type RuneArt = keyof typeof RUNE_ART;
export const runeArtUrl = (id: RuneArt) => `${import.meta.env.BASE_URL}assets/runes/combat/${RUNE_ART[id]}`;
const images = new Map<RuneArt, HTMLImageElement>();
export function runeArtImage(id: RuneArt) { return images.get(id); }
export function loadRuneArt() {
  for (const id of Object.keys(RUNE_ART) as RuneArt[]) {
    if (images.has(id)) continue;
    const image = new Image();
    image.src = runeArtUrl(id);
    images.set(id, image);
  }
}
