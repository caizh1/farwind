// 浏览器原生导出设计图。只读取本目录图片与样稿DOM，不访问游戏状态或存档。
const tools = document.createElement('section');
tools.id='export-tools';
tools.style.cssText='padding:18px;background:#f5edd8;display:flex;gap:14px;align-items:center;flex-wrap:wrap';
tools.innerHTML='<span>独立样稿工具 · 原生浏览器排版导出</span><button id="export-design">导出当前设计图</button><span id="export-status" role="status"></span>';
document.body.append(tools);
const button=tools.querySelector('button');
const status=tools.querySelector('#export-status');
const cache=new Map();
async function inlineAsset(url) {
  if(cache.has(url))return cache.get(url);
  const response=await fetch(new URL(url,location.href));
  if(!response.ok)throw Error(`设计素材不可读取：${url}`);
  const blob=await response.blob();
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  cache.set(url,data);return data;
}
button.onclick=async()=>{
  button.disabled=true;status.textContent='正在按真实中文字体排版导出……';
  document.querySelector('#export-result')?.remove();
  try {
    const compact=Number(new URLSearchParams(location.search).get('width'))===800;
    const width=compact?800:1440,height=compact?600:900;
    const stage=document.querySelector('.stage').cloneNode(true);
    for(const image of stage.querySelectorAll('img')) image.src=await inlineAsset(image.getAttribute('src'));
    for(const image of stage.querySelectorAll('svg image')) image.setAttribute('href',await inlineAsset(image.getAttribute('href')));
    // 表单序列化保留当前真实查看状态。
    const sourceInputs=document.querySelectorAll('.stage input');
    [...stage.querySelectorAll('input')].forEach((input,index)=>{if(sourceInputs[index].checked)input.setAttribute('checked','');else input.removeAttribute('checked');input.setAttribute('value',sourceInputs[index].value);});
    // SVG图片没有活动滚动容器，导出时以普通流内容平移保留当前阅读位置。
    for(const selector of ['.skill-list','.detail-scroll']) {
      const source=document.querySelector(selector),target=stage.querySelector(selector);
      if(!source||!target||!source.scrollTop)continue;
      const wrapper=document.createElement('div');
      const display=getComputedStyle(source).display;
      wrapper.style.display=display;
      if(display==='grid'){wrapper.style.gridTemplateColumns=getComputedStyle(source).gridTemplateColumns;wrapper.style.gap=getComputedStyle(source).gap;}
      wrapper.style.transform=`translateY(-${source.scrollTop}px)`;
      wrapper.append(...target.childNodes);target.append(wrapper);target.style.overflow='hidden';target.style.display='block';
    }
    let css=await (await fetch('preview.css')).text();
    css+='\n'+[...document.querySelectorAll('head style')].map(style=>style.textContent).join('\n');
    const urls=[...new Set([...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(match=>match[1]))];
    for(const url of urls)css=css.replaceAll(`url('${url}')`,`url('${await inlineAsset(url)}')`);
    const html=document.createElement('div');html.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
    const style=document.createElement('style');style.textContent=css+'\nhtml,body{margin:0;overflow:hidden;} .stage{width:'+width+'px;height:'+height+'px;}';html.append(style,stage);
    const xml=new XMLSerializer().serializeToString(html);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
    const svgData='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
    const image=new Image();image.src=svgData;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0,width,height);
    const png=canvas.toDataURL('image/png');
    document.querySelector('#export-result')?.remove();
    const result=document.createElement('img');result.id='export-result';result.alt=`当前设计图，${width}×${height}，独立样稿，非游戏接入截图`;result.src=png;result.style.cssText='max-width:100%;height:auto';document.body.append(result);
    document.querySelector('#export-svg')?.remove();
    const svgOutput=document.createElement('a');svgOutput.id='export-svg';svgOutput.textContent='可打开的矢量排版副本';svgOutput.href=svgData;svgOutput.download='design.svg';tools.append(svgOutput);
    status.textContent=`已导出 ${width}×${height} PNG，文字来自浏览器字体排版。`;
  } catch(error) {status.textContent=`导出受限：${error.message}。仍可打开独立样稿。`;}
  finally {button.disabled=false;}
};
