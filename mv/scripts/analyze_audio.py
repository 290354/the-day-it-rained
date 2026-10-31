"""
音频分析：解码 -> 能量包络 / 频谱通量 / 起音点 / 速度估计 -> build/audio.json
"""
import json, os, subprocess, sys
import numpy as np
import imageio_ffmpeg

SRC = r"E:\周杰伦歌曲全集(无损音质版)\那天下雨了 - 周杰伦.mp3"
OUT = os.path.join(os.path.dirname(__file__), "..", "build", "audio.json")
SR = 22050

def decode(path):
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR),
           "-f", "f32le", "-acodec", "pcm_f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

def main():
    y = decode(SRC)
    n = len(y)
    dur = n / SR
    hop, win = int(0.02 * SR), int(0.046 * SR)      # 20ms hop
    frames = 1 + max(0, (n - win) // hop)

    # --- 帧能量 ---
    idx = np.arange(win)[None, :] + hop * np.arange(frames)[:, None]
    idx = np.clip(idx, 0, n - 1)
    F = y[idx]
    rms = np.sqrt((F ** 2).mean(axis=1) + 1e-12)
    rms_db = 20 * np.log10(rms + 1e-9)

    # --- 频谱通量（起音） ---
    W = np.hanning(win)
    spec = np.abs(np.fft.rfft(F * W, axis=1))
    spec = spec[:, :256]
    logS = np.log1p(spec * 8.0)
    flux = np.maximum(0, np.diff(logS, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    fl = flux / (np.percentile(flux, 99) + 1e-9)
    fl = np.clip(fl, 0, 2)

    # --- 低频能量（贝斯/底鼓） ---
    lowE = 20 * np.log10(np.abs(np.fft.rfft(F * W, axis=1))[:, 1:24].sum(axis=1) + 1e-9)
    lowE = (lowE - lowE.min()) / (lowE.max() - lowE.min() + 1e-9)

    # --- 速度估计：起音自相关 ---
    t = np.arange(len(fl)) * (hop / SR)
    peaks = []
    thr = np.percentile(fl, 82)
    i = 1
    while i < len(fl) - 1:
        if fl[i] > thr and fl[i] >= fl[i - 1] and fl[i] >= fl[i + 1]:
            peaks.append(i)
            i += 6
        else:
            i += 1
    peaks = np.array(peaks)
    best_bpm, best_score = 0, -1
    for bpm in np.arange(60, 160, 0.5):
        lag = 60.0 / bpm / (hop / SR)
        if lag * 4 > len(fl):
            continue
        acc = 0.0
        for k in range(1, 9):
            l = lag * k
            if l >= len(fl) - 1:
                break
            li = int(round(l))
            acc += fl[li]
        if acc > best_score:
            best_score, best_bpm = acc, bpm

    # --- 段落能量（每 1 秒） ---
    sec = int(round(1.0 / (hop / SR)))
    e1 = np.array([rms_db[i:i + sec].mean() for i in range(0, len(rms_db) - sec, sec)])

    # --- 人声/整体活动阈值，用于判断段落 ---
    loud = np.percentile(rms_db, 55)

    out = {
        "duration": round(dur, 3),
        "sr": SR,
        "hop": hop,
        "bpm_estimate": round(float(best_bpm), 1),
        "rms_db": [round(float(v), 2) for v in rms_db[::5]],
        "rms_hop_s": round(hop * 5 / SR, 3),
        "flux": [round(float(v), 3) for v in fl[::5]],
        "low": [round(float(v), 3) for v in lowE[::5]],
        "energy_1s": [round(float(v), 2) for v in e1],
        "loud_db": round(float(loud), 2),
        "onsets_s": [round(float(t[i]), 2) for i in peaks],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(json.dumps({k: v for k, v in out.items() if k in ("duration", "bpm_estimate", "loud_db")}, ensure_ascii=False))
    print("energy_1s:", out["energy_1s"])
    print("onsets(first40):", out["onsets_s"][:40])

if __name__ == "__main__":
    main()
