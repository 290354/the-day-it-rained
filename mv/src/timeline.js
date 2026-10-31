/**
 * 《那天下雨了》THE DAY IT RAINED —— 分镜表 / 时间轴
 * 时长 3:43.2 · 1920×804 (2.39:1) · 24fps
 * 所有 t 均为秒，已按音频分析（ASR 时间码）对齐到歌词句首。
 */

export const DURATION = 223.4;

const G = { grain: 0.055, ca: 0.0016, vig: 0.30, sat: 1.0, warm: 0.06, exp: 1.0, weave: 1.0 };

export const TIMELINE = [
  /* ============ 序 · 冷开场（0:00–0:10.2）============ */
  {
    id: 's01', factory: 'shotVoid', t0: 0.0, t1: 1.45,
    opts: { rain: 0.10 }, bloomScale: 0.5, grade: { ...G, grain: 0.10 },
  },
  {
    id: 's02', factory: 'shotVoid', t0: 1.45, t1: 4.90,
    opts: { rain: 0.30 }, bloomScale: 0.7, grade: { ...G, grain: 0.075 },
    cards: [{ kind: 'brand', cn: '深寻呈现', en: 'DeepSeek Presents', t0: 1.85, t1: 4.62 }],
  },
  {
    id: 's03', factory: 'shotCloudDive', t0: 4.90, t1: 10.23,
    bloomScale: 0.95, grade: { ...G, sat: 0.92, exp: 1.02 },
  },

  /* ============ 第一幕 · 雨落 ============ */
  {
    id: 's04', factory: 'shotGlass', t0: 10.23, t1: 13.75,
    bloomScale: 0.85, grade: { ...G, exp: 0.98 },
    cards: [{ kind: 'title', cn: '那天下雨了', en: 'The Day It Rained', t0: 10.55, t1: 13.60, spread: true }],
  },
  {
    id: 's05', factory: 'shotBus', t0: 13.75, t1: 19.10,
    bloomScale: 0.9, grade: { ...G },
  },
  {
    id: 's06', factory: 'shotStation', t0: 19.10, t1: 24.30,
    opts: { figures: 2, lamps: true, variant: 0 }, bloomScale: 0.95,
  },
  {
    id: 's07', factory: 'shotPuddle', t0: 24.30, t1: 28.10,
    bloomScale: 1.0, grade: { ...G, sat: 1.05 },
    cards: [{ kind: 'narr', cn: '雨记得所有我没说出口的话', en: 'The rain remembers everything I never said', t0: 24.45, t1: 27.95 }],
  },
  {
    id: 's08', factory: 'shotStation', t0: 28.10, t1: 33.20,
    opts: { figures: 1, lamps: true, variant: 1 }, bloomScale: 0.95,
  },
  {
    id: 's09', factory: 'shotGlass', t0: 33.20, t1: 38.30,
    bloomScale: 0.8, grade: { ...G, exp: 0.94 },
  },
  {
    id: 's10', factory: 'shotStation', t0: 38.30, t1: 43.10,
    opts: { figures: 2, lamps: false, variant: 3 }, bloomScale: 0.9, grade: { ...G, exp: 0.95 },
  },
  {
    id: 's11', factory: 'shotBus', t0: 43.10, t1: 48.60,
    bloomScale: 0.95,
    cards: [{ kind: 'narr', cn: '那天的雨，下了很多年', en: 'That rain never really stopped', t0: 43.60, t1: 47.40 }],
  },
  {
    id: 's12', factory: 'shotPuddle', t0: 48.60, t1: 52.40, bloomScale: 1.0,
  },
  {
    id: 's13', factory: 'shotClassroom', t0: 52.40, t1: 59.20,
    bloomScale: 1.1, grade: { ...G, exp: 0.94, warm: 0.16 },
  },
  {
    id: 's14', factory: 'shotField', t0: 59.20, t1: 66.30,
    bloomScale: 1.05, grade: { ...G, warm: 0.22, sat: 1.06 },
  },
  {
    id: 's15', factory: 'shotStation', t0: 66.30, t1: 73.10,
    opts: { figures: 2, lamps: true, variant: 2 }, bloomScale: 0.95,
  },
  {
    id: 's16', factory: 'shotField', t0: 73.10, t1: 80.05,
    bloomScale: 1.0, grade: { ...G, warm: 0.24 },
  },

  /* ============ 第二幕 · 雨逆（副歌一 起雨开始倒流）============ */
  {
    id: 's17', factory: 'shotCloudDive', t0: 80.05, t1: 87.00,
    bloomScale: 1.0, grade: { ...G, sat: 0.9, exp: 0.96 },
    cards: [{ kind: 'lyric', cn: '雪白的天空 等待彩虹出现', en: 'A white sky, waiting for the rainbow', t0: 80.30, t1: 84.20 }],
  },
  {
    id: 's18', factory: 'shotRainbow', t0: 87.00, t1: 94.05,
    bloomScale: 1.25, grade: { ...G, exp: 0.94, warm: 0.10 },
  },
  {
    id: 's19', factory: 'shotRainReverse', t0: 94.05, t1: 103.85,
    bloomScale: 1.1, grade: { ...G, sat: 0.95 },
    cards: [{ kind: 'lyric', cn: '黑黑的夜空 繁星变得耀眼', en: 'A black sky, the stars burn brighter', t0: 94.25, t1: 98.10 }],
  },
  {
    id: 's20', factory: 'shotGlass', t0: 103.85, t1: 106.45,
    bloomScale: 0.85, grade: { ...G, exp: 0.9 },
  },

  /* 主歌二 */
  { id: 's21', factory: 'shotField', t0: 106.45, t1: 112.40, bloomScale: 1.0, grade: { ...G, warm: 0.2 } },
  { id: 's22', factory: 'shotClassroom', t0: 112.40, t1: 118.40, bloomScale: 1.1, grade: { ...G, exp: 0.95, warm: 0.15 } },
  { id: 's23', factory: 'shotStation', t0: 118.40, t1: 124.40, opts: { figures: 2, lamps: true, variant: 1 }, bloomScale: 0.95 },
  { id: 's24', factory: 'shotField', t0: 124.40, t1: 130.70, bloomScale: 1.0, grade: { ...G, warm: 0.26 } },

  /* 副歌二 */
  {
    id: 's25', factory: 'shotRainbow', t0: 130.70, t1: 137.40, bloomScale: 1.3, grade: { ...G, exp: 0.92 },
  },
  {
    id: 's26', factory: 'shotRainReverse', t0: 137.40, t1: 147.20, bloomScale: 1.15, grade: { ...G },
    cards: [{ kind: 'narr', cn: '所有倒流的雨，都想回到那一天的天空', en: 'Every drop was trying to get back to that day', t0: 138.0, t1: 142.6 }],
  },
  { id: 's27', factory: 'shotCloudDive', t0: 147.20, t1: 155.70, bloomScale: 1.05, grade: { ...G, sat: 0.88 } },
  {
    id: 's28', factory: 'shotVoid', t0: 155.70, t1: 158.60, opts: { rain: 0.55 }, bloomScale: 0.6,
    grade: { ...G, grain: 0.09 },
  },

  /* ============ 第三幕 · 雨停（桥段：原来她一直都在）============ */
  {
    id: 's29', factory: 'shotClassroom', t0: 158.60, t1: 165.00, bloomScale: 1.15, grade: { ...G, exp: 1.0, warm: 0.12 },
    cards: [{ kind: 'narr', cn: '原来所有的偶然，都是她的等待', en: 'Every coincidence was her waiting', t0: 158.95, t1: 163.20 }],
  },
  { id: 's30', factory: 'shotPuddle', t0: 165.00, t1: 171.95, bloomScale: 1.05, grade: { ...G, exp: 0.97 } },
  { id: 's31', factory: 'shotVoid', t0: 171.95, t1: 177.80, opts: { rain: 0.45 }, bloomScale: 0.55, grade: { ...G, grain: 0.085 } },
  { id: 's32', factory: 'shotClassroom', t0: 177.80, t1: 183.85, bloomScale: 1.2, grade: { ...G, exp: 1.02, warm: 0.14 } },
  {
    id: 's33', factory: 'shotRainReverse', t0: 183.85, t1: 190.10, bloomScale: 1.2, grade: { ...G, exp: 0.98 },
    cards: [{ kind: 'lyric', cn: '消失的下雨天 我想再淋一遍', en: 'That vanished rainy day — let me stand in it once more', t0: 184.10, t1: 188.60 }],
  },
  { id: 's34', factory: 'shotStation', t0: 190.10, t1: 196.90, opts: { figures: 2, lamps: true, variant: 0 }, bloomScale: 1.0, grade: { ...G, exp: 0.93 } },

  /* 高潮：撑伞 */
  {
    id: 's35', factory: 'shotUmbrella', t0: 196.90, t1: 203.60, bloomScale: 1.15, grade: { ...G, exp: 1.0, warm: 0.10 },
    cards: [{ kind: 'narr', cn: '如果回到过去 那一个下雨天', en: 'If I could go back to that one rainy day', t0: 197.30, t1: 200.60 }],
  },
  { id: 's36', factory: 'shotUmbrella', t0: 203.60, t1: 209.60, bloomScale: 1.2, grade: { ...G, exp: 1.0, warm: 0.1 } },
  { id: 's37', factory: 'shotStation', t0: 209.60, t1: 213.20, opts: { figures: 1, lamps: false, variant: 3 }, bloomScale: 1.0, grade: { ...G, exp: 0.92 } },

  /* ============ 尾声 ============ */
  {
    id: 's38', factory: 'shotEmptyStation', t0: 213.20, t1: 217.60, bloomScale: 1.0, grade: { ...G, exp: 0.96 },
    cards: [{ kind: 'narr', cn: '这一次，我没有转身', en: 'This time, I did not turn away', t0: 213.45, t1: 216.60, dy: -170 }],
  },
  {
    id: 's39', factory: 'shotVoid', t0: 217.60, t1: DURATION, opts: { rain: 0.35 },
    bloomScale: 0.5, grade: { ...G, grain: 0.07, exp: 0.9 },
    roll: { t0: 218.2, t1: DURATION - 0.6 },
  },
];

/* 场景内署名（渐次出现，不一次给完） */
export const STAMPS = [
  { t0: 31.0, t1: 35.4 },
  { t0: 107.6, t1: 112.2 },
  { t0: 205.2, t1: 209.4 },
];

/* 黑场/淡入淡出 */
export const TRANSITIONS = [
  { t0: 0.0, t1: 1.45, max: 1.0 },
  { t0: 4.30, t1: 5.10, max: 0.92 },
  { t0: 171.95, t1: 173.40, max: 0.85 },
  { t0: 213.15, t1: 214.30, max: 0.95 },
  { t0: 221.90, t1: 223.2, max: 1.0 },
];

/* 片尾字幕 */
export const ROLL = [
  { sign: '那天下雨了', sub: 'THE DAY IT RAINED' },
  { label: '演唱 / 作词 / 作曲', cn: '周杰伦', en: 'Jay Chou' },
  { label: '编曲', cn: '林迈可', en: 'Michael Lin' },
  { label: '收录专辑', cn: '《太阳之子》', en: 'Children of the Sun' },
  { label: '导演 / 编剧', cn: 'DEEPSEEK', en: 'Directed & Written by DeepSeek' },
  { label: '分镜 / 摄影', cn: 'DEEPSEEK', en: 'Storyboard & Cinematography by DeepSeek' },
  { label: '三维场景 / 粒子 / 灯光', cn: 'DEEPSEEK', en: '3D Scenes · Particles · Lighting — DeepSeek' },
  { label: '剪辑 / 调色', cn: 'DEEPSEEK', en: 'Editorial & Color Grade by DeepSeek' },
  { label: '字幕设计', cn: 'DEEPSEEK', en: 'Title & Subtitle Design by DeepSeek' },
  { label: '技术', cn: 'WebGL · Three.js · 逐帧程序化生成', en: 'Rendered frame by frame in WebGL' },
  { label: '特别鸣谢', cn: '每一个在雨里等过的人', en: 'For everyone who ever waited in the rain' },
  { sign: 'DEEPSEEK', sub: '由 DeepSeek 制作与设计 · DESIGNED BY DEEPSEEK' },
];
