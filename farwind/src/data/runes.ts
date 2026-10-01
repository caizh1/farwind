// A 始终由当前武器加成后的第一段近战解析，配置只保存比例与毫秒。
export type Ability = 'thunder'|'tide'|'chill'|'doom'|'poison'|'hunter'|'weakness'|'mirror'|'mist'|'vortex'|'seeking_projectile'|'jolt'|'phoenix';
export type RuneTier = 'low'|'mid'|'high'|'legend';
export type RuneDefinition = {id:string;name:string;tier:RuneTier;abilities:Ability[];description:string;trigger:string;config:Record<string,number>;visual:string;color:string;sound:string;acquisition:{kind:'explore'|'commission'|'shop'|'encounter'|'ruins'|'boss'|'allBosses'|'training';key:string;hint:string;price?:number}};
export const TIER_NAMES:Record<RuneTier,string>={low:'低阶 · 一叶',mid:'中阶 · 双纹',high:'高阶 · 三芒',legend:'绝世 · 金冠'};
export const ABILITY_NAMES:Record<Ability,string>={thunder:'雷击',tide:'潮汐',chill:'寒冷',doom:'厄印',poison:'酿毒',hunter:'猎星',weakness:'虚弱',mirror:'镜光',mist:'雾场',vortex:'刃涡',seeking_projectile:'追踪箭剑',jolt:'感电',phoenix:'凰心'};
export const RUNES:RuneDefinition[]=[
 {id:'r01',name:'雷触',tier:'low',abilities:['thunder'],trigger:'原生命中',description:'原生命中追加 25%A 雷击，同一目标间隔 0.45 秒。',config:{damage:.25,interval:450},visual:'fork',color:'#9bdded',sound:'thunder',acquisition:{kind:'explore',key:'wood-v1',hint:'首次在村内采集木材后，在符文页领取。'}},
 {id:'r02',name:'逐浪',tier:'low',abilities:['tide'],trigger:'近战命中',description:'近战追加 15%A 潮伤，尝试击退 24 像素；撞障额外 20%A。',config:{damage:.15,push:24,wall:.2,interval:250},visual:'wave',color:'#73cecf',sound:'tide',acquisition:{kind:'explore',key:'stone-v1',hint:'首次采集村口溪石后领取。'}},
 {id:'r03',name:'霜籽',tier:'low',abilities:['chill'],trigger:'原生命中',description:'施加寒冷，最多五层，持续 3 秒；每层减速 7%，首领总减速最多 20%。',config:{duration:3000,slow:.07,max:5},visual:'seed',color:'#b7e4ed',sound:'chill',acquisition:{kind:'explore',key:'herb-v1',hint:'在药师小院首次采药后领取。'}},
 {id:'r04',name:'厄印',tier:'low',abilities:['doom'],trigger:'原生命中',description:'挂上唯一厄印，0.9 秒后爆发 80%A；再次命中不延长倒计时。',config:{damage:.8,delay:900},visual:'seal',color:'#d86b75',sound:'doom',acquisition:{kind:'explore',key:'village-chest',hint:'打开村内宝箱后领取。'}},
 {id:'r05',name:'酿毒',tier:'low',abilities:['poison'],trigger:'原生命中',description:'每次施加一层酿毒，最多五层，持续 3 秒；每 0.5 秒每层造成 6%A。',config:{damage:.06,interval:500,duration:3000,max:5},visual:'brew',color:'#b68cd3',sound:'poison',acquisition:{kind:'explore',key:'berry-v1',hint:'首次采集村内浆果后领取。'}},
 {id:'r06',name:'月猎',tier:'low',abilities:['hunter'],trigger:'合格攻击暴击',description:'原生攻击暴击率增加 12 个百分点，基础暴击倍率 175%。',config:{crit:.12},visual:'moon',color:'#b4d8b6',sound:'hunter',acquisition:{kind:'commission',key:'side',hint:'完成木匠的普通采集委托后领取。'}},
 {id:'r07',name:'绯誓',tier:'low',abilities:['weakness'],trigger:'原生命中',description:'施加持续 3 秒的虚弱，目标战斗攻击伤害降低 20%。',config:{duration:3000,reduction:.2},visual:'ribbon',color:'#e999ac',sound:'weakness',acquisition:{kind:'shop',key:'general',price:18,hint:'风铃杂货铺出售，18 铜币。'}},
 {id:'r08',name:'镜步',tier:'low',abilities:['mirror'],trigger:'风步路径／飞弹接触',description:'风步路径形成 35%A 镜弧；前 0.2 秒偏转可反射飞弹，不延长风步无敌。',config:{damage:.35,radius:36,window:200},visual:'mirror-step',color:'#eddeb0',sound:'mirror',acquisition:{kind:'shop',key:'general',price:20,hint:'风铃杂货铺出售，20 铜币。'}},
 {id:'r09',name:'轻羽',tier:'low',abilities:[],trigger:'攻击收招／风步与移动',description:'普攻与剑风一进入后摇，按招架或风步即可立即取消剩余后摇。风步体力消耗降低 20%，风步后 1.2 秒移速增加 15%。',config:{cost:.8,speed:.15,duration:1200},visual:'feather',color:'#c3e7bf',sound:'wind',acquisition:{kind:'explore',key:'hidden-chest',hint:'打开森林藤蔓下的探索宝箱后领取。'}},
 {id:'r10',name:'镜甲',tier:'low',abilities:['mirror'],trigger:'受击／完美格挡',description:'常驻战斗减伤 8%，完美格挡产生 50%A 镜闪。',config:{reduction:.08,damage:.5,radius:100},visual:'armor',color:'#e6d5a7',sound:'mirror',acquisition:{kind:'shop',key:'general',price:24,hint:'风铃杂货铺出售，24 铜币。'}},
 {id:'r11',name:'感电',tier:'mid',abilities:['thunder','jolt'],trigger:'三次原生攻击／雷击／敌人出手',description:'每三次原生攻击命中落下 55%A 雷击；雷击挂 4 秒感电，敌人出手放电 40%A。',config:{count:3,damage:.55,jolt:.4,duration:4000,interval:750},visual:'jolt',color:'#acd9ff',sound:'thunder',acquisition:{kind:'encounter',key:'north-rock-arena',hint:'击败北路回声石坪裂岩林豕后领取。'}},
 {id:'r12',name:'破岸',tier:'mid',abilities:['tide'],trigger:'近战终结段（三连／学会后四连）',description:'近战终结段（三连／学会后四连）释放 65%A 潮浪；潮伤撞障额外 45%A，位移免疫目标额外 40%A。',config:{damage:.65,wall:.45,immune:.4,push:50,width:64,distance:240,speed:420},visual:'breaker',color:'#60c3da',sound:'tide',acquisition:{kind:'encounter',key:'east-spring-boar',hint:'击败东路石泉林豕，或在练习场完成四连终结训练后领取。'}},
 {id:'r13',name:'冰爆',tier:'mid',abilities:['chill'],trigger:'近战终结段（三连／学会后四连）／五层寒冷',description:'末段施寒；自己施加的寒冷达五层，消耗并冰爆 120%A，半径 95，每目标冷却 3 秒。',config:{damage:1.2,radius:95,cooldown:3000},visual:'ice-bloom',color:'#c7ecf6',sound:'chill',acquisition:{kind:'encounter',key:'north-stone-watch',hint:'清除北路石甲守望挑战后领取。'}},
 {id:'r14',name:'蓄厄',tier:'mid',abilities:['doom'],trigger:'末段挂印／原生蓄积',description:'末段挂 80%A 厄印；原生命中已有厄印，每次蓄 20%A，最多五次；不延时。',config:{damage:.8,delay:900,add:.2,max:5},visual:'needles',color:'#e88180',sound:'doom',acquisition:{kind:'encounter',key:'west-track-pack',hint:'清除西路狼群足迹后领取。'}},
 {id:'r15',name:'猎矢',tier:'mid',abilities:['hunter','seeking_projectile'],trigger:'原生暴击',description:'暴击率增加 15 个百分点；原生暴击发射一枚 35%A 追踪箭，冷却 0.35 秒。',config:{crit:.15,damage:.35,interval:350,speed:540},visual:'arrow',color:'#cde4b1',sound:'hunter',acquisition:{kind:'encounter',key:'south-orchard-burrows',hint:'清除南路果林伏土后领取。'}},
 {id:'r16',name:'灵酿雾',tier:'mid',abilities:['mist','poison'],trigger:'近战终结段（三连／学会后四连）',description:'末段生成半径 110、持续 4 秒的酿雾，冷却 5 秒；每 0.5 秒 12%A 并施毒。',config:{radius:110,duration:4000,cooldown:5000,damage:.12,interval:500},visual:'mist',color:'#b294d0',sound:'poison',acquisition:{kind:'commission',key:'south-supply',hint:'完成药师的南路补给支线后领取。'}},
 {id:'r17',name:'返照',tier:'mid',abilities:['mirror'],trigger:'完美格挡',description:'完美格挡释放 90%A 镜弧，半径 120，并额外恢复 12 体力。',config:{damage:.9,radius:120,stamina:12},visual:'return-light',color:'#fff0bb',sound:'mirror',acquisition:{kind:'encounter',key:'east-spore-ring',hint:'击败东路孢环空地灰冠母孢后领取。'}},
 {id:'r18',name:'御风',tier:'mid',abilities:[],trigger:'移动／原生攻击',description:'移速增加 12%；正向符文移速加成的 80% 转为原生增伤，转换上限 25%。',config:{speed:.12,convert:.8,cap:.25},visual:'wind-band',color:'#b6dcc5',sound:'wind',acquisition:{kind:'commission',key:'main',hint:'交付失落的风主线后领取。'}},
 {id:'r19',name:'雷云冠',tier:'high',abilities:['thunder'],trigger:'五次原生命中',description:'五次原生命中生成雷云，半径 125，三轮 55%A 落雷，冷却 7 秒。',config:{count:5,damage:.55,radius:125,rounds:3,interval:600,cooldown:7000},visual:'cloud-crown',color:'#bdc7fa',sound:'thunder',acquisition:{kind:'encounter',key:'ruins-gate-watch',hint:'击败遗迹门庭石甲后领取。'}},
 {id:'r20',name:'怒潮回澜',tier:'high',abilities:['tide'],trigger:'正式剑风释放',description:'正式剑风带出一去一返的 90%A 潮浪，各程独立命中去重；依赖已正式学习的剑风。',config:{damage:.9,width:72,speed:500,push:36},visual:'return-wave',color:'#82d8d9',sound:'tide',acquisition:{kind:'ruins',key:'0',hint:'按顺序回应遗迹晨风石后领取。'}},
 {id:'r21',name:'永冬之核',tier:'high',abilities:['chill'],trigger:'正式剑风释放',description:'正式剑风生成寒晶，持续 4 秒，每 0.6 秒锁定 420 内可见敌人造成 20%A 并施寒，冷却 5 秒。',config:{damage:.2,duration:4000,interval:600,radius:420,cooldown:5000},visual:'winter-core',color:'#c3e8ff',sound:'chill',acquisition:{kind:'ruins',key:'1',hint:'按顺序回应遗迹林风石后领取。'}},
 {id:'r22',name:'裂空刃涡',tier:'high',abilities:['vortex'],trigger:'近战终结段（三连／学会后四连）',description:'末段释放移动刃涡，持续 2 秒，半径 58，每目标间隔 0.25 秒切割 28%A，冷却 3 秒。',config:{damage:.28,radius:58,duration:2000,interval:250,speed:160,cooldown:3000},visual:'vortex',color:'#d69090',sound:'doom',acquisition:{kind:'encounter',key:'west-pack-clearing',hint:'击败西路荆棘头狼精英后领取。'}},
 {id:'r23',name:'蔷薇缚心',tier:'high',abilities:['weakness'],trigger:'原生命中',description:'原生命中施加虚弱；自己对虚弱目标的伤害提高 20%。',config:{duration:3000,reduction:.2,bonus:.2},visual:'rose',color:'#f0acbb',sound:'weakness',acquisition:{kind:'encounter',key:'ruins-court-front',hint:'清除遗迹前庭守阵后领取。'}},
 {id:'r24',name:'千刃追星',tier:'high',abilities:['hunter','seeking_projectile'],trigger:'原生暴击',description:'暴击率增加 20 个百分点，原生暴击召出两柄 45%A 追踪刃，冷却 0.5 秒。',config:{crit:.2,damage:.45,interval:500,speed:620},visual:'twin-swords',color:'#dcdfb5',sound:'hunter',acquisition:{kind:'encounter',key:'ruins-hall-watch',hint:'清除遗迹回音厅守望后领取。'}},
 {id:'r25',name:'夜宴长歌',tier:'high',abilities:['poison'],trigger:'酿毒／近战终结段（三连／学会后四连）',description:'酿毒每跳每层提高至 9%A，基础上限八层；近战终结段（三连／学会后四连）施毒。',config:{damage:.09,max:8},visual:'banquet',color:'#cea5dd',sound:'poison',acquisition:{kind:'ruins',key:'2',hint:'按顺序回应暮风石后领取。'}},
 {id:'r26',name:'万剑归宗',tier:'legend',abilities:['hunter','seeking_projectile'],trigger:'十次原生命中',description:'常驻暴击率 +25 个百分点；十次原生命中开启六秒剑域，十二剑各 60%A 可暴击，期间原生增伤 30%，冷却 20 秒。',config:{crit:.25,count:10,duration:6000,swords:12,damage:.6,bonus:.3,cooldown:20000,speed:650},visual:'sword-domain',color:'#dce7ba',sound:'swords',acquisition:{kind:'boss',key:'west-wolf-den',hint:'首次击败荆冠猎王必得。'}},
 {id:'r27',name:'九霄雷诏',tier:'legend',abilities:['thunder'],trigger:'原生命中／八次蓄积',description:'常驻原生命中追加 35%A 雷击，每目标间隔 0.4 秒；八次命中锁定最多五敌，三轮各 120%A，最终 240%A 雷柱，冷却 24 秒。',config:{passive:.35,interval:400,count:8,damage:1.2,final:2.4,radius:130,cooldown:24000},visual:'thunder-edict',color:'#eadab1',sound:'thunder',acquisition:{kind:'boss',key:'east-thorn-camp',hint:'首次击败缚枝祭主必得。'}},
 {id:'r28',name:'太虚归墟',tier:'legend',abilities:['tide'],trigger:'近战终结段（三连／学会后四连）／三次末段',description:'常驻末段 65%A 潮震；三次末段开启三秒归墟，六次 80%A 潮汐牵引脉冲，终结 320%A 塌缩，冷却 26 秒；首领不受牵引。',config:{passive:.65,count:3,duration:3000,interval:500,damage:.8,final:3.2,radius:165,pull:18,cooldown:26000},visual:'void',color:'#b3ccd1',sound:'void',acquisition:{kind:'boss',key:'south-spore-camp',hint:'首次击败孢心巢母必得。'}},
 {id:'r29',name:'刹那永恒',tier:'legend',abilities:['mirror'],trigger:'成功格挡／完美格挡',description:'格挡释放 75%A 镜弧；完美格挡开启三秒时隙，普通敌人及飞弹减速 60%、首领最多 20%，结束回放原生实际伤害的 60%，总上限 600%A，冷却 30 秒。',config:{passive:.75,radius:220,duration:3000,slow:.6,bossSlow:.2,replay:.6,cap:6,cooldown:30000},visual:'time',color:'#e9e3cb',sound:'time',acquisition:{kind:'boss',key:'north-boar-camp',hint:'首次击败崩岩獠王必得。'}},
 {id:'r30',name:'不灭凰心',tier:'legend',abilities:['phoenix'],trigger:'实际战斗受伤／致死战斗伤害',description:'受伤后以 80%A 凰焰反击，冷却 4 秒；致死战斗伤害恢复 50%生命，免疫战斗伤害 1.5 秒，400%A 火环，六秒每秒恢复 3%，重生冷却 180 秒。',config:{passive:.8,interval:4000,heal:.5,immune:1500,damage:4,radius:180,regen:.03,duration:6000,cooldown:180000},visual:'phoenix',color:'#efb284',sound:'phoenix',acquisition:{kind:'allBosses',key:'four',hint:'首次完成四据点首领清剿的高难奖励，必得。'}},
 {id:'r31',name:'回风',tier:'low',abilities:[],trigger:'原生剑风终点',description:'原生剑风抵达有效终点后沿原路折返一次；回程为原生基础伤害的60%，每目标各程最多一次，分束共享去重。保留已学阶段，障碍截断。',config:{damage:.6},visual:'return-wind',color:'#8be0ce',sound:'wind',acquisition:{kind:'training',key:'sword-wind',hint:'正式学会临水送风后领取，旧档可补领一次。'}},
 {id:'r32',name:'留痕',tier:'low',abilities:[],trigger:'原生去程命中／原生剑风经过',description:'原生去程命中留下4秒风痕，最多8个；后续去程或回程经过消耗一次，半径60扰流造成40%A。自身去程不消费，扰流不留痕、不复制。',config:{damage:.4,radius:60,duration:4000,max:8},visual:'wind-trace',color:'#d3e9a1',sound:'wind',acquisition:{kind:'training',key:'sword-wind',hint:'正式学会临水送风后领取。单独装备可由后续剑风利用。'}},
 {id:'r33',name:'续势',tier:'low',abilities:[],trigger:'完成有效挥击后的合法风步',description:'风步后700毫秒内接回下一段，不跳段；同连段只保留一次，连续风步、受击、死亡或超时清除。',config:{window:700,chase:32},visual:'wind-band',color:'#edd5a1',sound:'wind',acquisition:{kind:'training',key:'melee',hint:'村庄练习场教本：完成一组真实三连命中，学习四连并取得续势。'}},
];
export const RETURN_RUNE={id:'return-wind',name:'归风',description:'永久绑定。脱战 8 秒，长按 G 引导 1.2 秒回到最近激活且有效的安全风之路标；无路标回初始安全点。冷却 60 秒，不治疗、不无敌。移动、攻击、受击、模态界面及失焦中断。',config:{peace:8000,channel:1200,cooldown:60000},visual:'return-wind',color:'#9ddbd0'};
export const RUNE_CODEX=[RETURN_RUNE,...RUNES];
export const runeById=(id:string)=>RUNES.find(r=>r.id===id);
export const RUNE_BALANCE={critMultiplier:1.75,weakCritMultiplier:2.25,critCap:.75,poisonCritPerLayer:.02,poisonCritCap:.2,poisonDuration:3000,poisonInterval:500,fastPoisonInterval:350,weakDuration:3000,chillDuration:3000,chillSlow:.07,chillCap:5,bossSlowCap:.2,poisonDamage:.06,joltDamage:.4,joltDuration:4000,joltInterval:750,lightningLead:160,featherGrace:120};
export type DuoDefinition={id:string;name:string;requires:Ability[];wind?:boolean;description:string;visual:string;config:Record<string,number>};
export const DUOS:DuoDefinition[]=[
 {id:'d01',name:'海啸雷狱',requires:['tide','thunder'],description:'潮汐命中追加 40%A 雷击，每目标 0.35 秒一次；无需实际击退。',visual:'storm-wave',config:{damage:.4,interval:350}},
 {id:'d02',name:'镜返厄裁',requires:['doom','mirror'],description:'镜光命中消费已有厄印，立即引爆并追加 30%A，取消原倒计时。',visual:'mirror-doom',config:{damage:.3}},
 {id:'d03',name:'猎风绞阵',requires:['vortex','hunter'],description:'刃涡追踪可见合法目标，不能穿墙，使用猎系暴击率。',visual:'hunter-vortex',config:{radius:480}},
 {id:'d04',name:'冰酿迷庭',requires:['mist','chill'],description:'雾场保留伤害与施毒，每 0.75 秒额外施寒。',visual:'ice-mist',config:{interval:750}},
 {id:'d05',name:'雷酿风暴',requires:['mist','thunder'],description:'雾场每 0.75 秒给最多三敌落下 45%A 雷击；感电可承接。',visual:'storm-mist',config:{interval:750,damage:.45,max:3}},
 {id:'d06',name:'寒雷长劫',requires:['jolt','chill'],description:'感电在四秒内可随敌人后续出手反复放电，每目标至少间隔 0.75 秒。',visual:'frozen-jolt',config:{interval:750}},
 {id:'d07',name:'腐厄狂宴',requires:['poison','doom'],description:'仅酿毒跳伤间隔变成 0.35 秒，每跳伤害保持。',visual:'doom-brew',config:{interval:350}},
 {id:'d08',name:'绯毒沉酿',requires:['weakness','poison'],description:'虚弱目标酿毒上限额外 +3；虚弱结束立刻裁回基础上限，保留原到期和跳伤时刻。',visual:'rose-brew',config:{extra:3}},
 {id:'d09',name:'心猎破绽',requires:['weakness','hunter'],description:'对虚弱目标的合格暴击倍率从 175% 提高到 225%。',visual:'heart-star',config:{multiplier:2.25}},
 {id:'d10',name:'醉月追凶',requires:['poison','hunter'],description:'每层酿毒令合格攻击暴击率 +2 个百分点，额外上限 20 个百分点。',visual:'brew-stars',config:{perLayer:.02,cap:.2}},
 {id:'d11',name:'潮影双斩',requires:['tide','hunter'],wind:true,description:'正式学会剑风后，原生剑风延迟 0.12 秒追加一组 40%伤害潮影，继承几何；不再复制。',visual:'phantom-wave',config:{delay:120,damage:.4}},
 {id:'d12',name:'寒刃风狱',requires:['vortex','chill'],description:'刃涡命中施寒，半径缩小 15%；与追踪、暴击改造共存。',visual:'ice-vortex',config:{radius:.85}},
 {id:'d13',name:'镇海镜域',requires:['tide','mirror'],description:'成功格挡释放 100%A 潮环，三秒内来自首领的战斗伤害再降低 20%；潮环可引雷。',visual:'mirror-sea',config:{damage:1,radius:120,reduction:.2,duration:3000}},
 {id:'d14',name:'雷矢贯星',requires:['thunder','seeking_projectile'],description:'追踪箭剑命中留雷针，0.3 秒后追加 30%A 雷击，每目标 0.35 秒一次；刃涡不适用。',visual:'thunder-arrow',config:{damage:.3,delay:300,interval:350}},
 {id:'d15',name:'凰镜涅槃',requires:['phoenix','mirror'],description:'凰心重生得到三片镜羽，抵挡后三次战斗命中并反击；无敌拒绝的命中不消耗，同帧伤害不连耗。',visual:'mirror-phoenix',config:{feathers:3,damage:.6,grace:120}},
];
export const duoById=(id:string)=>DUOS.find(d=>d.id===id)!;
export function resolveDuos(slots:readonly (string|null)[],learnedWind:boolean){
 const providers=new Map<Ability,string[]>();
 for(const id of new Set(slots)){const r=id&&runeById(id);if(r)for(const a of r.abilities)providers.set(a,[...(providers.get(a)??[]),r.id]);}
 return DUOS.map(d=>({...d,providers:Object.fromEntries(d.requires.map(a=>[a,providers.get(a)??[]])),missing:d.requires.filter(a=>!providers.has(a)),active:d.requires.every(a=>providers.has(a))&&(!d.wind||learnedWind)}));
}
export const RUNE_LOADOUTS=[
 {name:'雷潮冲阵',slots:['r02','r11','r12','r08','r09']},
 {name:'镜返速爆',slots:['r04','r08','r14','r17','r29']},
 {name:'追踪冰刃',slots:['r22','r06','r03','r24','r26']},
 {name:'冰雷酿域',slots:['r16','r11','r03','r04','r25']},
 {name:'绯毒猎杀',slots:['r05','r23','r24','r25','r26']},
 {name:'五绝共鸣',slots:['r26','r27','r28','r29','r30']},
];
