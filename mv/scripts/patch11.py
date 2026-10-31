import io

SH = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
MJ = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/main.js"
sh = io.open(SH, encoding="utf-8").read()
mj = io.open(MJ, encoding="utf-8").read()
n = 0
def RS(old, new):
    global sh, n
    assert old in sh, "MISS-S: " + old[:70]
    sh = sh.replace(old, new, 1); n += 1
def RM(old, new):
    global mj, n
    assert old in mj, "MISS-M: " + old[:70]
    mj = mj.replace(old, new, 1); n += 1

# 远景城市剪影（填掉黑色的空，给空间一个尺度）
RS("""  // 雨溅
  const splash = createSplashes(""",
   """  // 远景城市剪影 + 稀疏窗灯
  const far = new THREE.MeshBasicMaterial({ color: 0x05080e });
  const rnd = rng(717);
  for (let i = 0; i < 26; i++) {
    const w = 5 + rnd() * 9;
    const h = 7 + rnd() * 20;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), far);
    b.position.set(-70 + i * 5.6 + (rnd() - 0.5) * 3, h / 2 - 1, -64 - rnd() * 22);
    scene.add(b);
  }
  const winMat = new THREE.PointsMaterial({
    color: 0xffc98a, size: 0.5, sizeAttenuation: true,
    transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const wpos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    wpos[i * 3] = -70 + rnd() * 148;
    wpos[i * 3 + 1] = 2 + rnd() * 16;
    wpos[i * 3 + 2] = -62 - rnd() * 20;
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  const wins = new THREE.Points(wg, winMat);
  scene.add(wins);

  // 雨溅
  const splash = createSplashes(""")

# 站台整体提一档曝光
RS("scene, camera, bloom: 1.05, exposure: 1.18,", "scene, camera, bloom: 1.02, exposure: 1.30,")
# 空站台同理
RS("scene, camera, bloom: 1.05, exposure: 1.14,", "scene, camera, bloom: 1.02, exposure: 1.26,")

# 全局：黑位微抬，避免大面积死黑
RM("uLift: { value: new THREE.Vector3(0.004, 0.006, 0.012) },",
   "uLift: { value: new THREE.Vector3(0.011, 0.014, 0.022) },")

io.open(SH, "w", encoding="utf-8").write(sh)
io.open(MJ, "w", encoding="utf-8").write(mj)
print("patched", n)
