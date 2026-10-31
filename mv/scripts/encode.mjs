import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FF = path.join(ROOT, 'bin', 'ffmpeg.exe');
const FRAMES = path.join(ROOT, 'build', 'frames');
const OUT = path.join(ROOT, 'out');
const AUDIO = 'E:/周杰伦歌曲全集(无损音质版)/那天下雨了 - 周杰伦.mp3';

fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(FRAMES).filter((f) => /^f\d{5}\.jpg$/.test(f)).sort();
console.log('frames:', files.length);
if (!files.length) process.exit(1);

const last = files[files.length - 1];
const lastIdx = parseInt(last.slice(1, 6), 10);
console.log('last frame index:', lastIdx, '→', (lastIdx / 24).toFixed(2), 's');

const target = path.join(OUT, 'THE_DAY_IT_RAINED_1080p.mp4');
const args = [
  '-y',
  '-framerate', '24',
  '-start_number', '0',
  '-i', path.join(FRAMES, 'f%05d.jpg'),
  '-i', AUDIO,
  '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '22',
  '-tune', 'film',
  '-pix_fmt', 'yuv420p',
  '-profile:v', 'high',
  '-level', '4.2',
  '-x264-params', 'keyint=48:min-keyint=24:ref=4:bframes=3',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
  '-shortest',
  '-movflags', '+faststart',
  target,
];
console.log('encoding →', target);
const t0 = Date.now();
execFileSync(FF, args, { stdio: 'inherit' });
console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
const st = fs.statSync(target);
console.log('size', (st.size / 1024 / 1024).toFixed(1), 'MB');
