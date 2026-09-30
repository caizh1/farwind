import {runeById,RETURN_RUNE,TIER_NAMES} from '../../data/runes';

// 正式图标直接加载手绘位图。SVG 只承载图片及 HUD 的冷却扇面、蓄积刻度。
// 图鉴、自由槽、商店、详情和 HUD 共用此入口，不再用路径重新描摹原画。
export function runeIcon(id:string,size=48){
 if(id==='empty-slot')return `<svg xmlns="http://www.w3.org/2000/svg" class="rune-icon" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="空符文槽"><rect x="9" y="9" width="46" height="46" rx="11" fill="#29433b" stroke="#b5c1a5" stroke-dasharray="3 4"/><path d="M32 22V42M22 32H42" stroke="#b5c1a5" stroke-width="2"/></svg>`;
 const rune=runeById(id),assetId=rune?.id??RETURN_RUNE.id,tier=rune?.tier??'fixed';
 const label=`${rune?.name??RETURN_RUNE.name} · ${rune?TIER_NAMES[rune.tier]:'固定归风'}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" class="rune-icon rune-art-${tier}" width="${size}" height="${size}" viewBox="0 0 64 64" data-rune-art="painted-v3" data-rune-tier="${tier}" data-rune-art-id="${assetId}" role="img" aria-label="${label}"><title>${label}</title><image href="${import.meta.env.BASE_URL}assets/runes/painted/${assetId}.webp" x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid meet"/></svg>`;
}
