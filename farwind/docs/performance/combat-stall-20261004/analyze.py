# 从逐帧原始记录提取攻击窗口、存活恢复窗口与地形冷生成，不把重生回村当作恢复。
from pathlib import Path
import json, statistics
root=Path(__file__).parent

def stats(rows,key):
    # 地形计时只在后两轮安装；其他函数在窗口内没有调用时，其成本确为零。
    if key=='地形烘焙毫秒' and not any(key in r for r in rows):return None
    values=sorted(r.get(key,0) for r in rows)
    if not values:return None
    return {'平均':statistics.mean(values),'九五':values[min(len(values)-1,int(len(values)*.95))],'九九':values[min(len(values)-1,int(len(values)*.99))],'最长':values[-1]}

def summarize(path):
    data=json.loads(path.read_text());rows=data['逐帧']
    respawn=next((r['墙钟'] for a,r in zip(rows,rows[1:]) if abs(r['位置'][0]-a['位置'][0])+abs(r['位置'][1]-a['位置'][1])>1000),None)
    valid=[r for r in rows if r['墙钟']>=1000 and (respawn is None or r['墙钟']<respawn)]
    windows=[]
    for label,lo,hi in [('四至六秒攻击窗口',4000,6000),('六至九秒观察窗口',6000,9000),('十一至十三秒后续窗口',11000,13000)]:
        selected=[r for r in valid if lo<=r['墙钟']<hi]
        if not selected:continue
        windows.append({'阶段':label,'起止毫秒':[lo,hi],'帧数':len(selected),'帧率':1000/statistics.mean(r['间隔'] for r in selected),'最低生命':min(r['生命'] for r in selected),'指标':{k:stats(selected,k) for k in ['间隔','战斗推进毫秒','全部预警毫秒','接触预测毫秒','接触预测次数','伙伴环境毫秒','危险区推演毫秒','寻路批次毫秒','遭遇更新毫秒','出生绘制毫秒','只读观察毫秒','渲染提交毫秒','地形烘焙毫秒']}})
    terrain=[r for r in valid if r.get('地形烘焙毫秒',0)>5]
    return {'文件':path.name,'版本':data['版本'],'重生回村时刻':respawn,'说明':'排除开头一秒的载入冷启动与重生后的帧，采样仍为真实场景的模拟键盘操作。','有效帧':len(valid),'有效平均帧率':1000/statistics.mean(r['间隔'] for r in valid),'剑风峰值':max(r['剑风数'] for r in valid),'失焦帧':sum(not r['焦点'] for r in valid),'窗口':windows,'地形慢帧':[{'时刻':r['墙钟'],'总耗时':r['总毫秒'],'地形耗时':r.get('地形烘焙毫秒',0),'新增地块':[k for k in r.get('新增纹理',[]) if k.startswith('ground-')],'生命':r['生命']} for r in terrain]}

result={'说明':'四份相同输入流程的旧版与当前修复版对照；没有冻结随机数和逐帧时刻，窗口不能视为逐帧重放。空指标表示该轮未测量，不表示成本为零。第十九份存档在六至九秒恢复，第二十份存档旧版在同一时段仍较慢。','记录':[summarize(root/name) for name in ['old-save19-retreat.json','fixed-save19-retreat.json','old-save20-retreat.json','fixed-save20-retreat.json'] if (root/name).exists()]}
(root/'comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
for r in result['记录']:
    print(r['文件'],'存活有效平均帧率',round(r['有效平均帧率'],2),'重生',r['重生回村时刻'],'地形慢帧',len(r['地形慢帧']))
    for w in r['窗口']:print('  ',w['阶段'],round(w['帧率'],2),'最低生命',w['最低生命'],'预测',round(w['指标']['接触预测毫秒']['平均'],3),'伙伴环境',round(w['指标']['伙伴环境毫秒']['平均'],3))
    for t in r['地形慢帧'][:5]:print('  ',t)
