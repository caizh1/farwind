import {giftGlyphSvg,WIND_GIFT_ART,GIFT_MATERIALS,type GiftVisualId} from '../entities/windGiftArt';
import {giftPreviewMarkup,startGiftPreview} from './windGiftPreview';
import { WIND_GIFTS, EXTRA_WIND_GIFTS,GIFT_RESONANCES,resonanceLevel,giftDisplayValue, giftEffect, type WindGiftId } from "../systems/windGifts";
import type { Interface } from "./interface";
import "../../wind-gifts.css";

// 徽记为界面矢量图形，全部留在文档流中；数值仍取自正式风赐定义。
const GIFT_ART: Partial<Record<
  WindGiftId,
  { kind: string; label: string; path: string }
>> = {
  blade: {
    kind: "attack",
    label: "近战伤害",
    path: "M21 43 43 21l-2 10-15 16M18 39l11 11M21 47l-6 6M34 22l8-8 8 8",
  },
  gale: {
    kind: "attack",
    label: "剑风伤害",
    path: "M13 26h30c12 0 10-14 2-12M13 34h37M20 42h19c12 0 10 14 2 12",
  },
  blackHole:{kind:"attack",label:"I黑洞斩触发率",path:"M32 8 24 28l7 3-4 25 13-25-8-4 0-19M14 36c-6-13 18-28 34-17M50 28c7 12-15 27-35 18M12 18l4 3M49 46l4 4"},
  riposte: {
    kind: "attack",
    label: "弹反反击",
    path: "M19 42 43 18l-2 11-17 17M16 39l12 12M18 49l-4 4M47 35c8 13-2 22-15 18M32 53l6-7M32 53l8 3",
  },
  shock: {
    kind: "attack",
    label: "终结冲击",
    path: "M32 13v22M26 16l6-5 6 5M20 35l12 8 12-8M12 43l20 12 20-12M12 32l7 4M52 32l-7 4",
  },
  chain: {
    kind: "attack",
    label: "跳跃附伤",
    path: "m36 12-16 22h13l-6 18 18-24H32l4-16M14 18l-4 6M50 42l4-6",
  },
  stride: {
    kind: "motion",
    label: "移动速度",
    path: "M14 39c8-15 23-21 37-22-1 16-7 29-23 32M18 45l28-23M28 34l1 10M37 26l-10-1M12 51l7-7",
  },
  thrift: {
    kind: "motion",
    label: "风步消耗",
    path: "M17 39c-8-8-2-23 9-19 8-13 23-5 19 7 13 6 7 24-5 20M15 34h23M30 26l8 8-8 8",
  },
  breath: {
    kind: "motion",
    label: "体力恢复",
    path: "M12 27h29c12 0 12-15 3-15M12 36h35M20 45h18c12 0 12 13 3 13M15 16l3-4",
  },
  armor: {
    kind: "survival",
    label: "实际受伤",
    path: "M32 12 49 19v16c0 10-10 17-17 21-7-4-17-11-17-21V19l17-7ZM32 20v27M23 29l9-9 9 9",
  },
  potion: {
    kind: "survival",
    label: "药剂治疗",
    path: "M25 12h14M27 12v12L17 37c-5 8 0 17 8 17h14c8 0 13-9 8-17L37 24V12M20 37h24M27 45h10M32 40v10",
  },
  spring: {
    kind: "survival",
    label: "整场回血",
    path: "M32 12c-5 10-17 22-17 31a17 17 0 0 0 34 0c0-9-12-21-17-31ZM23 43c0 5 4 8 9 8M32 28v9M28 33h8",
  },
  poise: {
    kind: "survival",
    label: "弹反回力",
    path: "M32 12 48 20v15c0 9-8 17-16 21-8-4-16-12-16-21V20l16-8ZM34 23l-9 13h9l-3 10 10-15h-9l2-8",
  },
};
function giftArt(id:WindGiftId){const extra=EXTRA_WIND_GIFTS[id as keyof typeof EXTRA_WIND_GIFTS];const group=extra?.group??'';const base=group==='防御'||group==='治疗'||group==='弹反'?'armor':group==='风步'||group==='被动'?'stride':'gale';return {...(GIFT_ART[id]??{...GIFT_ART[base]!,label:group+'增益'}),path:giftGlyphSvg(id)};}
function giftIcon(id: WindGiftId) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${giftArt(id).path}"/></svg>`;
}
function giftMetric(id: WindGiftId, level: number) {
  if(id==='blackHole')return `${Math.round(Math.min(.1,.05+.01*(level-1))*100)}%`;
  const extra=EXTRA_WIND_GIFTS[id as keyof typeof EXTRA_WIND_GIFTS];if(extra)return `+${Math.round(giftDisplayValue(id,level)*(extra.unit==='%'?100:1)*100)/100}${extra.unit}`;
  const value = Math.round(
    WIND_GIFTS[id].value *
      level *
      (id === "spring" || id === "poise" ? 1 : 100),
  );
  return `${id === "armor" || id === "thrift" ? "−" : "+"}${value}${id === "spring" || id === "poise" ? "点" : "%"}`;
}
export function showWindGifts(ui: Interface, feedback = "",selected?:GiftVisualId) {
  const s = ui.state!;
  ui.mode = "wind-gifts";
  const gifts = s.windGifts,
    pending = gifts.pending[0],
    saved = !pending || ui.actions.giftSaved?.(pending.receipt) !== false,
    choice = saved ? pending : undefined;
  ui.shell(
    "风赐",
    `<div class="gift-intro"><p>随旅人长存的力量</p><span>死亡、回村与换方向均保留</span></div>
 ${giftPreviewMarkup(selected??gifts.held[0]?.id??'blade',!!selected)}
 <section class="gift-reward" aria-labelledby="gift-reward-title"><div class="gift-section-heading"><div><span class="gift-eyebrow">${choice ? "整场胜利 · 旅途馈赠" : "旅途积累 · 长久相伴"}</span><h2 id="gift-reward-title">${choice ? "风已回应，择一同行" : pending ? "风赐等待保存" : "每一份馈赠，都随你远行"}</h2></div><span class="gift-count">${choice ? "三选一" : pending ? "待保存" : "暂无待选"}${gifts.pending.length > 1 ? ` · 待领 ${gifts.pending.length} 场` : ""}</span></div>
 ${
   choice
     ? `<div class="gift-choices">${choice.candidates
         .map((id, index) => {
           const owned = gifts.held.find((g) => g.id === id),
             level = (owned?.level ?? 0) + 1,
             art = giftArt(id);
           return `<article class="gift-card" data-kind="${art.kind}"><div class="gift-card-top"><span>${art.kind === "attack" ? "锋芒 · 进攻" : art.kind === "motion" ? "流风 · 身法" : "守护 · 生存"}</span><span class="gift-card-index">${String(index + 1).padStart(2, "0")}</span></div><div class="gift-emblem">${giftIcon(id)}</div><div class="gift-name"><h3>${WIND_GIFTS[id].name}</h3><span class="gift-level ${owned ? "gift-upgrade" : ""}">${owned ? `${owned.level} → ${level}级` : "1级 · 新风赐"}</span></div><div class="gift-stat"><strong>${giftMetric(id, level)}</strong><span>${art.label}${owned ? " · 升级后" : " · 获得后"}</span></div><p class="gift-effect">${giftEffect(id, level)}</p><p class="gift-growth">${owned ? `当前 ${giftMetric(id, owned.level)} → 升级后 ${giftMetric(id, level)}` : id === "blackHole" ? "每级增加 1 个百分点 · 最高 10%" : EXTRA_WIND_GIFTS[id as keyof typeof EXTRA_WIND_GIFTS]?.cap!==undefined?`每级 ${giftMetric(id,1)} · 数值受单项上限限制`:`可持续叠加 · 每级 ${giftMetric(id, 1)}`}</p><button type="button" data-gift="${id}" aria-label="${owned ? "升级" : "选择"}${WIND_GIFTS[id].name}"><span>${owned ? `升至${level}级` : "接受风赐"}</span><span aria-hidden="true">→</span></button></article>`;
         })
         .join("")}</div>`
     : pending
       ? '<div class="gift-empty-state"><p>本场奖励已保留，保存成功后即可查看候选。</p><button id="gift-save">保存奖励并继续选择</button></div>'
       : '<div class="gift-empty-state"><p>清完整场遭遇，即可获得一次三选一风赐。</p><span>已获得的力量会一直伴随旅途。</span></div>'
 }</section>
 <details class="gift-owned" ${choice ? "" : "open"}><summary tabindex="0"><span class="gift-owned-title">随身风赐 <b>${gifts.held.length}<small> 种 · 累计 ${gifts.held.reduce((sum, g) => sum + g.level, 0)}级</small></b></span><span class="gift-sockets" aria-hidden="true">${gifts.held.map((g) => `<i class="filled">${giftIcon(g.id)}</i>`).join("")}</span><span class="gift-owned-hint">查看效果 <span aria-hidden="true">⌄</span></span></summary><div class="gift-held">${gifts.held.map((g) => `<article><span class="gift-held-icon" data-kind="${giftArt(g.id).kind}">${giftIcon(g.id)}</span><div><b>${WIND_GIFTS[g.id].name} · ${g.level}级</b><p>${giftEffect(g.id, g.level)}</p></div></article>`).join("") || '<p class="gift-empty">尚未持有风赐，选择第一份与你同行的力量。</p>'}</div><p class="gift-owned-rule">持有种类与等级均无上限 · 重复选择累加一级 · 不占符文槽</p></details>
 <section class="gift-resonances"><h2>流派共鸣 · 自动激活</h2><div class="gift-held">${Object.entries(GIFT_RESONANCES).map(([id,r])=>{const level=resonanceLevel(gifts,id as keyof typeof GIFT_RESONANCES);return `<article data-active="${level>0}"><span class="gift-held-icon" style="color:${GIFT_MATERIALS[WIND_GIFT_ART[id as GiftVisualId].motion].color}"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${giftGlyphSvg(id as GiftVisualId)}"/></svg></span><div><b>${r.name} · ${level?`${level}级已激活`:'未集齐'}</b><p>${r.components.map(c=>`${WIND_GIFTS[c].name}${gifts.held.some(g=>g.id===c)?' ✓':''}`).join(' + ')}</p><p>${r.effect}${level>1?`；共鸣数值 ×${level}`:''}</p></div></article>`;}).join('')}</div><p class="gift-owned-rule">共鸣等级取组件最低等级；不额外抽取，不占符文槽。新增走速、减伤、减速、治疗与护盾分别设上限。</p></section>
 <footer class="gift-footer"><div><p id="gift-feedback" role="status" aria-live="polite"></p><span>不必匆忙决定，可随时从旅途手记继续领取。</span></div><button type="button" id="gift-close">${pending ? "稍后再选 · 继续旅途" : "继续旅途"} <span aria-hidden="true">→</span></button></footer>`,
  );
  ui.previewCleanup=startGiftPreview(ui.modal,s.runes.settings.simple,s.runes.settings.lowFlash,Object.fromEntries(gifts.held.map(g=>[g.id,g.level])));
  ui.modal.querySelector(".panel")!.classList.add("gift-panel");
  ui.modal.querySelector("header small")!.textContent = "远风之地 · 旅途馈赠";
  ui.modal.querySelector("#gift-feedback")!.textContent =
    feedback || "风赐长存 · 没有倒计时";
  const heading = ui.modal.querySelector<HTMLElement>("#panel-title")!;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  ui.button("gift-close", () => ui.close(true));
  if (pending && !saved)
    ui.button("gift-save", async () => {
      if (ui.economyBusy) return;
      ui.economyBusy = true;
      let message = "候选已保存。";
      try {
        await ui.actions.save();
      } catch (error) {
        message = (error as Error).message;
      } finally {
        ui.economyBusy = false;
      }
      showWindGifts(ui, message);
    });
  ui.modal
    .querySelectorAll<HTMLButtonElement>("[data-gift]")
    .forEach((button) =>
      button.addEventListener("click", async () => {
        if (ui.economyBusy || !choice || !ui.actions.giftChoose) return;
        const id = button.dataset.gift as WindGiftId;
        ui.economyBusy = true;
        ui.modal
          .querySelectorAll<HTMLButtonElement | HTMLSelectElement>(
            "button,select",
          )
          .forEach((b) => (b.disabled = true));
        ui.modal.querySelector("#gift-feedback")!.textContent =
          "正在保存选择……";
        let message = "风赐已保存并生效。";
        try {
          await ui.actions.giftChoose(choice.receipt, id);
        } catch (error) {
          message = (error as Error).message;
        } finally {
          ui.economyBusy = false;
        }
        showWindGifts(ui, message,id);
      }),
    );
}
