import {WILDERNESS_ROADS} from "./wilderness";
// M1道路布置：运行绘制、装饰净空和蓝图共用同一份线段与路宽。
export const ROAD_DEFINITIONS = [
  {
    id: "north-east-spine",
    width: 170,
    service: false,
    points: [
      [820, 120],
      [820, 320],
      [820, 560],
      [800, 600],
      [800, 730],
      [650, 780],
      [900, 780],
      [1120, 750],
      [1390, 860],
      [1600, 860],
      [1760, 900],
      [1870, 920],
      [1870, 1080],
      [2170, 1080],
      [2800, 1100],
      [3160, 1000],
      [3480, 760],
      [3750, 660],
    ],
  },
  {
    id: "village-loop",
    width: 115,
    service: false,
    points: [
      [330, 620],
      [330, 780],
      [470, 850],
      [470, 1030],
      [650, 1100],
      [670, 1440],
      [860, 1470],
      [1040, 1500],
      [1280, 1480],
      [1550, 1400],
      [1680, 1210],
      [1870, 1080],
    ],
  },
  {
    id: "plaza-south",
    width: 115,
    service: false,
    points: [
      [650, 780],
      [650, 1100],
    ],
  },
  {
    id: "west-lane",
    width: 115,
    service: false,
    points: [
      [470, 1030],
      [220, 1030],
      [220, 1450],
      [670, 1440],
    ],
  },
  {
    id: "pharmacy-path",
    width: 80,
    service: false,
    points: [
      [1110, 750],
      [1110, 640],
    ],
  },
  {
    id: "lakeside-bridge",
    width: 115,
    service: false,
    points: [
      [860, 1470],
      [1090, 1450],
      [1090, 900],
      [1090, 820],
      [1120, 750],
    ],
  },
  {
    id: "lake-pier",
    width: 115,
    service: false,
    points: [
      [1280, 1480],
      [1300, 1370],
    ],
  },
  {
    id: "forest-south-spur",
    width: 115,
    service: false,
    points: [
      [2800, 1100],
      [2670, 1430],
      [2600, 1700],
    ],
  },
  {
    id: "ruins-entry",
    width: 115,
    service: false,
    points: [
      [3750, 660],
      [3740, 400],
    ],
  },
  {
    id: "ruins-court",
    width: 115,
    service: false,
    points: [
      [3510, 540],
      [3740, 600],
      [3970, 570],
    ],
  },
  {
    id: "training-path",
    width: 80,
    service: false,
    points: [
      [1640, 860],
      [1640, 710],
    ],
  },
  {
    id: "south-gate-road",
    width: 115,
    service: false,
    points: [
      [860, 1470],
      [900, 1640],
      [900, 2100],
    ],
  },
  {
    id: "general-entrance",
    width: 65,
    service: true,
    points: [
      [650, 1030],
      [900, 1030],
      [900, 1010],
    ],
  },
  {
    id: "south-cottage-entrance",
    width: 65,
    service: true,
    points: [
      [220, 1190],
      [330, 1190],
    ],
  },
  {
    id: "elder-entrance",
    width: 65,
    service: true,
    points: [
      [550, 650],
      [650, 780],
    ],
  },
  {
    id: "inn-entrance",
    width: 65,
    service: true,
    points: [
      [1550, 1400],
      [1480, 1530],
      [1630, 1650],
    ],
  },
  {
    id: "smith-entrance",
    width: 65,
    service: true,
    points: [
      [670, 1440],
      [800, 1490],
      [800, 1440],
    ],
  },
  {
    id: "workshop-entrance",
    width: 65,
    service: true,
    points: [
      [470, 1440],
      [530, 1410],
    ],
  },
  {
    id: "barracks-entrance",
    width: 65,
    service: true,
    points: [
      [1760, 900],
      [1870, 820],
      [2030, 780],
      [2030, 700],
    ],
  },
];
ROAD_DEFINITIONS.push(...WILDERNESS_ROADS);
export const roads = ROAD_DEFINITIONS.map((r) => r.points);
export const roadWidth = (index: number) => ROAD_DEFINITIONS[index].width;
export const serviceRoads = ROAD_DEFINITIONS.filter((r) => r.service).map(
  (r) => r.points,
);
export const villageRoutes = [
  {
    name: "主线出发路线",
    points: [
      [670, 780],
      [900, 780],
      [1120, 750],
      [1390, 860],
      [1600, 860],
      [1760, 900],
      [1870, 920],
      [1870, 1080],
      [2110, 1080],
    ],
  },
  {
    name: "生活探索环线",
    points: [
      [670, 780],
      [470, 850],
      [470, 1030],
      [220, 1030],
      [220, 1450],
      [670, 1440],
      [860, 1470],
      [1280, 1480],
      [1550, 1400],
      [1680, 1210],
      [1870, 1080],
      [1870, 920],
      [1760, 900],
      [1600, 860],
      [1390, 860],
      [1120, 750],
      [900, 780],
      [670, 780],
    ],
  },
  {
    name: "临水小径",
    points: [
      [1280, 1480],
      [1090, 1450],
      [1090, 900],
      [1090, 820],
      [1120, 750],
      [900, 780],
      [670, 780],
    ],
  },
];
