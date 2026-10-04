import {CITY_BUILDINGS} from '../../data/cityLayout';
export type CityMapArt=Record<string,{image:HTMLCanvasElement;width:number;height:number}>;
let prepared:Promise<CityMapArt>|undefined;
// 原生大图先生成有界地图图标，供主画布直接绘制；楼址与长宽比仍来自同一登记。
export function loadCityMapArt():Promise<CityMapArt>{
 if(prepared)return prepared;
 const names=[...new Set(CITY_BUILDINGS.map(b=>b.art))];
 prepared=Promise.all(names.map(name=>new Promise<[string,CityMapArt[string]]>((resolve,reject)=>{const image=new Image();image.onload=()=>{void image.decode().then(()=>{
  const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const c=canvas.getContext('2d')!;c.imageSmoothingQuality='high';c.drawImage(image,0,0,canvas.width,canvas.height);resolve([name,{image:canvas,width:canvas.width,height:canvas.height}]);
 },reject);};image.onerror=()=>reject(Error('风语城地图建筑素材未能加载'));image.src=`/assets/windwhisper-city/completion/${name}.webp`;}))).then(Object.fromEntries);
 return prepared;
}
