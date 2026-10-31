# THE DAY IT RAINED

Three.js 程序化渲染的短片：1920×804 / 24fps / 223.4 秒，全部画面由代码生成，不含实拍素材。
Puppeteer 逐帧驱动 headless Chrome 截图，再交给 ffmpeg 编码成片。

## 结构

```
mv/
├── src/               # Three.js 场景本体（约 4000 行）
│   ├── index.html     # 渲染舞台：画布、遮罩、字幕卡
│   ├── main.js        # 入口与渲染循环
│   ├── timeline.js    # 时间线：DURATION、TIMELINE、STAMPS、TRANSITIONS
│   ├── scenes.js      # 分场调度
│   ├── shots.js       # 分镜（1319 行，全片镜头定义）
│   ├── city.js        # 城市与街景几何
│   ├── props.js       # 道具与物件
│   ├── lighting.js    # 光照与氛围
│   └── lib.js         # 缓动、噪声、工具函数
└── scripts/           # 渲染与后期
    ├── render.mjs     # 逐帧渲染（可指定起止秒 / 单帧）
    ├── encode.mjs     # 帧序列 → mp4
    ├── analyze_audio.py # 音轨分析
    ├── debug.mjs      # 单帧调试
    └── patch*.py      # 制作过程中的批量改写脚本（保留以备追溯）
```

## 运行

```bash
npm install
node scripts/render.mjs 0 30     # 渲染 0–30 秒到 build/frames
node scripts/encode.mjs          # 合成 out/*.mp4
```

`render.mjs` 会优先使用 `mv/bin/` 下的本地 Chrome，找不到时回退到 `~/.cache/puppeteer`。

## 未入库内容

`node_modules/`、`mv/bin/`（Chrome 与 ffmpeg 二进制）、`mv/build/`（帧序列）、`mv/out/`（成片）、`mv/plate/`（贴图素材）体积过大，已由 `.gitignore` 排除。
