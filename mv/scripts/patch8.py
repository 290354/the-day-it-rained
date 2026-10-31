import io

LB = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/lib.js"
SH = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
MJ = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/main.js"

lb = io.open(LB, encoding="utf-8").read()
sh = io.open(SH, encoding="utf-8").read()
mj = io.open(MJ, encoding="utf-8").read()
n = 0
def R(txt, old, new):
    global n
    assert old in txt, "MISS: " + old[:80]
    n += 1
    return txt.replace(old, new, 1)

# ---------- lib：剪影人形改为「轮廓光」材质 ----------
lb = R(lb, """  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });""",
       """  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(0xffb173) },
      uRimAmt: { value: 0.85 },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0);
        vN = normalize(mat3(modelMatrix)*normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol,uRim; uniform float uRimAmt;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 2.4);
        vec3 c = uCol + uRim * rim * uRimAmt;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });""")

lb = R(lb, """    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.52, 0.20, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: umbColor, side: THREE.DoubleSide })
    );""",
       """    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.52, 0.20, 24, 1, true),
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color(umbColor) }, uRim: { value: new THREE.Color(0xffc08a) } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 w = modelMatrix*vec4(position,1.0);
            vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz);
            gl_Position = projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `uniform vec3 uCol,uRim; varying vec3 vN; varying vec3 vV;
          void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            gl_FragColor = vec4(uCol + uRim * pow(f,3.0) * 1.1, 1.0); }`,
      })
    );""")

# ---------- lib：雨点溅射 ----------
lb = R(lb, """/* ---------------------------------------------------------- 剪影人形 */""",
       """/* ---------------------------------------------------------- 雨点溅射 */
export function createSplashes(opts = {}) {
  const { count = 1100, area = [40, 34], color = 0xbcd8ff, speed = 1.9, seed = 9, h = [0.05, 0.20] } = opts;
  const rnd = rng(seed);
  const pos = new Float32Array(count * 3);
  const par = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * area[0];
    pos[i * 3 + 1] = 0.012;
    pos[i * 3 + 2] = (rnd() - 0.5) * area[1] - 5;
    par[i * 2] = rnd();
    par[i * 2 + 1] = lerp(h[0], h[1], Math.pow(rnd(), 1.8));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPar', new THREE.BufferAttribute(par, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSpeed: { value: speed },
      uC: { value: new THREE.Color(color) }, uO: { value: 0.5 },
    },
    vertexShader: `attribute vec2 aPar; uniform float uTime, uSpeed;
      varying float vA;
      void main(){
        float t = fract(uTime * uSpeed * (0.65 + fract(aPar.x*7.3)) + aPar.x);
        vec3 p = position;
        p.y += sin(t * 3.14159) * aPar.y;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = clamp(26.0 / max(d, 0.001), 0.8, 5.0);
        vA = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.55, 1.0, t));
        vA *= smoothstep(38.0, 4.0, d);
      }`,
    fragmentShader: `uniform vec3 uC; uniform float uO; varying float vA;
      void main(){ vec2 q = gl_PointCoord - 0.5;
        gl_FragColor = vec4(uC, smoothstep(0.5, 0.02, length(q)) * vA * uO); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return pts;
}

/* ---------------------------------------------------------- 剪影人形 */""")

# ---------- shots：站台细节 ----------
sh = R(sh, """/* ===================================================================
   3. 夜雨站台""",
       """/* 站台结构细节：桁架 / 栏杆 / 长椅 / 站牌 / 时刻表 / 溅射 */
function decorateStation(scene) {
  const truss = new THREE.MeshBasicMaterial({ color: 0x080c12 });
  // 顶棚桁架
  for (let i = 0; i < 8; i++) {
    const x = -15.5 + i * 4.6;
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 15.4), truss);
    v.position.set(x, 4.02, -12.1); scene.add(v);
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.4), truss);
    d1.position.set(x + 2.3, 4.24, -9.4); d1.rotation.x = 0.56; scene.add(d1);
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.4), truss);
    d2.position.set(x + 2.3, 4.24, -14.8); d2.rotation.x = -0.56; scene.add(d2);
  }
  // 站台栏杆
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 6), truss);
    p.position.set(-14.6 + i * 1.95, 0.52, -3.75); scene.add(p);
  }
  for (const y of [1.02, 0.62]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 31, 6), truss);
    r.rotation.z = Math.PI / 2; r.position.set(0, y, -3.75); scene.add(r);
  }
  // 长椅
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 0.42), truss);
  seat.position.y = 0.44;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 0.05), truss);
  back.position.set(0, 0.66, -0.20);
  bench.add(seat, back);
  for (const dx of [-1.1, 1.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.34), truss);
    leg.position.set(dx, 0.22, 0); bench.add(leg);
  }
  bench.position.set(-6.9, 0, -7.4); bench.rotation.y = 0.08;
  scene.add(bench);

  // 站牌（背光板）
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a1116'; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = 'rgba(150,180,205,0.28)'; g.lineWidth = 3; g.strokeRect(9, 9, 1006, 238);
  g.fillStyle = '#e9f0f6';
  g.font = '600 92px "Microsoft YaHei", sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('环城西路', 54, 104);
  g.fillStyle = 'rgba(188,208,224,0.62)';
  g.font = '34px "Bahnschrift", "Segoe UI", sans-serif';
  g.fillText('HUANCHENG WEST RD.', 58, 186);
  g.fillStyle = '#2b7cae'; g.fillRect(776, 58, 196, 58);
  g.fillStyle = '#dfeaf2'; g.font = 'bold 40px "Bahnschrift", sans-serif';
  g.textAlign = 'center'; g.fillText('07', 874, 88);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.82),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 }));
  sign.position.set(-5.4, 2.62, -8.2); sign.rotation.y = 0.16;
  scene.add(sign);
  const sGlow = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.35), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0x8fc4f0, opacity: 0.05, side: THREE.DoubleSide,
  }));
  sGlow.position.set(-5.4, 2.62, -8.16); sGlow.rotation.y = 0.16;
  scene.add(sGlow);

  // 时刻表灯箱
  const cv2 = document.createElement('canvas');
  cv2.width = 256; cv2.height = 512;
  const g2 = cv2.getContext('2d');
  g2.fillStyle = '#0c151b'; g2.fillRect(0, 0, 256, 512);
  g2.fillStyle = 'rgba(200,220,235,0.85)'; g2.font = '18px "Bahnschrift", sans-serif';
  g2.fillText('LAST  TRAIN', 26, 46);
  for (let i = 0; i < 11; i++) {
    g2.fillStyle = `rgba(190,215,232,${0.24 - i * 0.012})`;
    g2.fillRect(26, 76 + i * 36, 120 + (i % 3) * 26, 5);
  }
  g2.fillStyle = 'rgba(120,190,240,0.55)';
  g2.fillRect(26, 470, 90, 3);
  const tex2 = new THREE.CanvasTexture(cv2);
  tex2.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8),
    new THREE.MeshBasicMaterial({ map: tex2, transparent: true, opacity: 0.8 }));
  board.position.set(3.4, 1.55, -7.2); board.rotation.y = -0.5;
  scene.add(board);

  // 雨溅
  const splash = createSplashes({ count: 1400, area: [36, 30], speed: 2.1, seed: 17 });
  scene.add(splash);
  return splash;
}

/* ===================================================================
   3. 夜雨站台""")

# 站台：插入细节 + 机位变体
sh = R(sh, """  const { lamps = true, figures = 2, umbrellaStand = false, mood = 1.0 } = opt;""",
       """  const { lamps = true, figures = 2, umbrellaStand = false, variant = 0 } = opt;""")

sh = R(sh, """  const rain = createRain({ count: 5000, area: [70, 40, 70], speed: [13, 22], len: [0.7, 2.2], width: 0.013, opacity: 0.42, seed: 33 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));""",
       """  const rain = createRain({ count: 5000, area: [70, 40, 70], speed: [13, 22], len: [0.7, 2.2], width: 0.013, opacity: 0.42, seed: 33 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  const splash = decorateStation(scene);
  upd.push((t) => splash.userData.update(t));""")

sh = R(sh, """    scene, camera, bloom: 1.05, exposure: 1.18,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      // 横移 dolly
      camera.position.set(lerp(-4.6, -1.2, e), 1.62 + Math.sin(t * 0.4) * 0.02, lerp(3.2, 1.4, e));
      aim(camera, V3(lerp(-1.5, -1.3, e), 1.30, -6.4), lerp(-0.012, 0, e));
      camera.position.add(handheld(t, 0.014, 0.9));
      camera.fov = lerp(34, 30, e);
      camera.updateProjectionMatrix();
    },""",
       """    scene, camera, bloom: 1.05, exposure: 1.18,
    dof: { focus: 7.2, aperture: 0.62, max: 14 },
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      if (variant === 1) {
        // 低机位仰角：雨的重量压下来
        camera.position.set(lerp(-3.0, -2.2, e), lerp(0.52, 0.72, e), lerp(2.0, 0.6, e));
        aim(camera, V3(-2.6, lerp(2.6, 3.1, e), -6.2), lerp(-0.03, -0.01, e));
        camera.fov = lerp(40, 34, e);
      } else if (variant === 2) {
        // 贴地平视：看积水与灯影
        camera.position.set(lerp(3.6, 2.4, e), lerp(0.30, 0.42, e), lerp(1.6, 0.2, e));
        aim(camera, V3(lerp(0.6, 0.2, e), lerp(1.1, 1.35, e), -6.6), lerp(0.05, 0.02, e));
        camera.fov = lerp(46, 38, e);
      } else if (variant === 3) {
        // 人物背面过肩
        camera.position.set(lerp(-3.4, -3.0, e), lerp(1.56, 1.50, e), lerp(-3.9, -4.5, e));
        aim(camera, V3(-0.6, 1.42, -9.5), lerp(0.01, 0, e));
        camera.fov = lerp(38, 32, e);
      } else {
        // 横移 dolly
        camera.position.set(lerp(-4.6, -1.2, e), 1.62 + Math.sin(t * 0.4) * 0.02, lerp(3.2, 1.4, e));
        aim(camera, V3(lerp(-1.5, -1.3, e), 1.30, -6.4), lerp(-0.012, 0, e));
        camera.fov = lerp(34, 30, e);
      }
      camera.position.add(handheld(t, 0.014, 0.9));
      camera.updateProjectionMatrix();
    },""")

# ---------- 各场景景深参数 ----------
# 主程序里按工厂名兜底
mj = R(mj, """let dofPass = null, sceneRT = null;""",
       """const DOF_DEFAULT = {
  shotCloudDive: { focus: 95, aperture: 0.32, max: 9 },
  shotStation: { focus: 7.2, aperture: 0.62, max: 14 },
  shotBus: { focus: 4.2, aperture: 0.55, max: 13 },
  shotPuddle: { focus: 8.5, aperture: 0.60, max: 15 },
  shotRainReverse: { focus: 13, aperture: 0.50, max: 12 },
  shotClassroom: { focus: 11, aperture: 0.55, max: 13 },
  shotField: { focus: 16, aperture: 0.45, max: 12 },
  shotRainbow: { focus: 320, aperture: 0.18, max: 7 },
  shotUmbrella: { focus: 3.4, aperture: 0.32, max: 11 },
  shotEmptyStation: { focus: 6.0, aperture: 0.58, max: 14 },
  shotVoid: { focus: 10, aperture: 0.20, max: 6 },
};

let dofPass = null, sceneRT = null;""")

mj = R(mj, """    dofPass.uniforms.uFocus.value = shot.dof?.focus ?? 10;
    dofPass.uniforms.uAperture.value = shot.dof?.aperture ?? 0.80;
    dofPass.uniforms.uMaxBlur.value = shot.dof?.max ?? 10;""",
       """    const dp = shot.dof ?? DOF_DEFAULT[shot._factory] ?? { focus: 10, aperture: 0.6, max: 10 };
    dofPass.uniforms.uFocus.value = dp.focus;
    dofPass.uniforms.uAperture.value = dp.aperture;
    dofPass.uniforms.uMaxBlur.value = dp.max;""")

mj = R(mj, """  const s = f(entry.opts || {});
  cache.set(entry.id, s);""",
       """  const s = f(entry.opts || {});
  s._factory = entry.factory;
  cache.set(entry.id, s);""")

io.open(LB, "w", encoding="utf-8").write(lb)
io.open(SH, "w", encoding="utf-8").write(sh)
io.open(MJ, "w", encoding="utf-8").write(mj)
print("patched", n)
