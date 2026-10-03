import type { Interface } from './interface';
import { region } from '../../data/world';

// 方位沿用根目录最初设计图；开放状态以实际场景接入为准。
export const ATLAS_REGIONS = [
  { id: 'snow', name: '雪原之境', detail: '极寒之地，古老文明的遗迹沉睡于冰雪之中。', cell: '6 / 3 / 7 / 8', open: false },
  { id: 'mountains', name: '北风山脉', detail: '高山、矿藏与隐士的居所，北风穿行于群峰之间。', cell: '5 / 10 / 6 / 15', open: false },
  { id: 'fire', name: '赤焰荒原', detail: '火山、熔岩与失落的遗迹，赤红群峰守着远古秘密。', cell: '6 / 17 / 8 / 23', open: false },
  { id: 'forest', name: '翡翠森林', detail: '风铃村坐落在这片森林的边缘。当前可探索村庄、四向荒野与风之遗迹。', cell: '10 / 3 / 12 / 9', open: true },
  { id: 'city', name: '风语城', detail: '大陆的政治与文化中心，旅人和故事在城中交汇。', cell: '9 / 10 / 11 / 15', open: false },
  { id: 'lake', name: '月影湖', detail: '宁静湖泊映照月光，湖畔流传着古老的传说。', cell: '12 / 16 / 14 / 21', open: false },
  { id: 'coast', name: '晨曦海岸', detail: '渔村、港口与海上冒险，沿着晨光寻找新的航路。', cell: '15 / 4 / 17 / 10', open: false },
  { id: 'desert', name: '金沙荒漠', detail: '商队、遗迹与地下城，古老文明埋藏在金色沙海之下。', cell: '18 / 12 / 20 / 18', open: false },
  { id: 'islands', name: '云海群岛', detail: '漂浮的岛屿与天空之城，云海深处仍有未知的领域。', cell: '16 / 19 / 18 / 25', open: false },
] as const;

export function showWorldAtlas(ui: Interface, localMap: () => void) {
  if (!ui.state) return;
  ui.shell('世界地图', `<nav class="atlas-nav" aria-label="地图层级"><button aria-current="page" disabled>大陆全貌</button><button id="atlas-local">风铃村与周边</button><span>当前位置 · ${region(ui.state.player.x, ui.state.player.y)}</span></nav>
    <div class="atlas-layout"><div class="atlas-art" aria-label="远风大陆区域地图">${ATLAS_REGIONS.map(r => `<button type="button" class="atlas-marker${r.open ? ' atlas-marker--open' : ''}" style="grid-area:${r.cell}" data-atlas-region="${r.id}" data-region-name="${r.name}" aria-label="${r.name} · ${r.open ? '当前旅途，可查看区域地图' : '暂未开放'}" aria-pressed="${r.open}"><span>${r.open ? '风铃村 · 当前旅途' : '暂未开放'}</span></button>`).join('')}</div>
    <aside class="atlas-detail" aria-label="区域详情"><small id="atlas-region-eyebrow"></small><h2 id="atlas-region-name"></h2><p id="atlas-region-status" role="status"></p><p id="atlas-region-detail"></p><button id="atlas-enter">查看区域地图</button><p class="atlas-hint">选择地图上的区域，查看开放情况。</p></aside></div>
    <footer class="atlas-footer"><span>远风之地 · 九境图志</span><button id="close">收起地图 <kbd>M / Esc</kbd></button></footer>`);
  ui.modal.querySelector('.panel')!.classList.add('atlas-panel');
  const select = (id: string) => {
    const r = ATLAS_REGIONS.find(r => r.id === id)!;
    ui.modal.querySelector('#atlas-region-eyebrow')!.textContent = r.open ? '旅途从这里开始' : '远方尚待启程';
    ui.modal.querySelector('#atlas-region-name')!.textContent = r.name;
    ui.modal.querySelector('#atlas-region-status')!.textContent = r.open ? '部分开放 · 风铃村与周边' : '暂未开放';
    ui.modal.querySelector('#atlas-region-detail')!.textContent = r.detail;
    const enter = ui.modal.querySelector<HTMLButtonElement>('#atlas-enter')!;
    enter.disabled = !r.open;
    enter.textContent = r.open ? '查看区域地图' : '暂未开放';
    enter.onclick = r.open ? localMap : null;
    ui.modal.querySelectorAll<HTMLButtonElement>('[data-atlas-region]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.atlasRegion === id)));
  };
  ui.modal.querySelectorAll<HTMLButtonElement>('[data-atlas-region]').forEach(b => b.onclick = () => select(b.dataset.atlasRegion!));
  ui.button('atlas-local', localMap);
  select('forest');
}
