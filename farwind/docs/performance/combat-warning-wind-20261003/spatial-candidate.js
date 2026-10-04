// 诊断专用空间索引；复用已有几何修订号，门与石障变化后整体重建。
let diagnosticRevision=-1;
const diagnosticCells=new Map(),diagnosticCellSize=128;
export function diagnosticNearbyProps(a,b,marginX=0,marginY=marginX){
 if(diagnosticRevision!==mapGeometryRevision){diagnosticCells.clear();for(const [index,p] of props.entries()){if(!p.solid)continue;const bounds=propBounds(p);for(let x=Math.floor(bounds.left/diagnosticCellSize);x<=Math.floor(bounds.right/diagnosticCellSize);x++)for(let y=Math.floor(bounds.top/diagnosticCellSize);y<=Math.floor(bounds.bottom/diagnosticCellSize);y++){const key=x+':'+y;if(!diagnosticCells.has(key))diagnosticCells.set(key,[]);diagnosticCells.get(key).push(index);}}diagnosticRevision=mapGeometryRevision;}
 const indices=new Set();for(let x=Math.floor((Math.min(a.x,b.x)-marginX)/diagnosticCellSize);x<=Math.floor((Math.max(a.x,b.x)+marginX)/diagnosticCellSize);x++)for(let y=Math.floor((Math.min(a.y,b.y)-marginY)/diagnosticCellSize);y<=Math.floor((Math.max(a.y,b.y)+marginY)/diagnosticCellSize);y++)for(const index of diagnosticCells.get(x+':'+y)??[])indices.add(index);
 // 保持原物件顺序，避免更改多障碍同时命中时的首个身份。
 return [...indices].sort((a,b)=>a-b).map(i=>props[i]);
}
