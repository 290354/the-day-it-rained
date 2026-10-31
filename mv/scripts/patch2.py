import io

P = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
src = io.open(P, encoding="utf-8").read()

CLOUD = r'''export function shotCloudDive() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1920 / 804, 0.1, 3000);
  const upd = [];

  scene.add(createSkyDome({ top: 0x050a14, horizon: 0x16242f, glow: 0x6b4322, glowDir: [0, -0.18, -1], glowAmt: 1.8, size: 900 }));

  // 云层 4 层
  const cloudMat = (seed, speed, scale, op) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uSeed: { value: seed }, uSpeed: { value: speed },
      uScale: { value: scale }, uOp: { value: op },
      uC1: { value: new THREE.Color(0x2a3a48) }, uC2: { value: new THREE.Color(0xa8b6c2) },
      uGlow: { value: new THREE.Color(0xffb371) },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime,uSeed,uSpeed,uScale,uOp; uniform vec3 uC1,uC2,uGlow;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 p = vUv*uScale + vec2(uSeed*31.0, uSeed*17.0) + vec2(uTime*uSpeed*0.02, 0.0);
        float f = fbm(p + fbm(p*1.7 + uTime*0.01)*0.6);
        float f2 = fbm(p*2.9 - uTime*uSpeed*0.03);
        float v = f*0.68 + f2*0.46;
        float a = smoothstep(0.34, 0.78, v);
        float rim = smoothstep(0.26, 0.46, v) * (1.0 - smoothstep(0.46, 0.72, v));
        // 云底被城市灯光打亮
        float under = smoothstep(0.55, 1.0, 1.0 - abs(v - 0.5)*2.0);
        vec3 col = mix(uC1, uC2, clamp(f*0.85 + f2*0.35, 0.0, 1.0));
        col += uGlow * rim * 1.15;
        col += uGlow * under * 0.30;
        col *= 1.05;
        gl_FragColor = vec4(col, a*uOp);
      }`,
  });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), cloudMat(1 + i * 3.7, 1 + i * 0.6, 2.2 + i * 0.8, 0.92 - i * 0.08));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 64 - i * 19;
    m.renderOrder = i;
    scene.add(m);
    upd.push((t) => { m.material.uniforms.uTime.value = t + i * 3; });
  }

  // 地面：城市灯海
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader: `${GLSL_NOISE}
        uniform float uTime; varying vec3 vW;
        void main(){
          vec2 p = vW.xz;
          vec2 gp = abs(fract(p*0.016)-0.5);
          float st = smoothstep(0.492,0.5,gp.x)+smoothstep(0.492,0.5,gp.y);
          float d = hash21(floor(p*0.30));
          float car = step(0.972, d) * (0.55+0.45*sin(uTime*2.0+d*40.0));
          float glow = exp(-length(p)*0.0035);
          vec3 c = vec3(1.0,0.60,0.26)*(st*0.75 + car*2.6)*1.35;
          c += vec3(0.10,0.16,0.26)*glow*1.2;
          c *= 0.55 + 0.75*glow;
          gl_FragColor = vec4(c,1.0);
        }`,
    }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);
  upd.push((t) => { ground.material.uniforms.uTime.value = t; });

  const rain = createRain({ count: 6000, area: [100, 80, 130], speed: [26, 50], len: [2.4, 5.6], width: 0.022, opacity: 0.36, seed: 21, color: 0xaecdf0 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  // 高空一层薄雾
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0x6f8092, opacity: 0.10,
  }));
  mist.position.set(0, 30, -320);
  scene.add(mist);

  // 闪电
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), flashMat);
  flash.position.set(0, 20, -260);
  scene.add(flash);

  return {
    scene, camera, bloom: 1.0, exposure: 1.05,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(-18, 2, e), lerp(152, 7, Math.pow(e, 0.86)), lerp(120, -26, e));
      aim(camera, V3(0, lerp(38, 3.2, Math.pow(e, 0.9)), lerp(-160, -120, e)), lerp(0.05, 0, e));
      camera.position.add(handheld(t, 0.05, 0.35));
      camera.fov = lerp(40, 32, e);
      camera.updateProjectionMatrix();
      const fl = (a, b) => (t > a && t < b ? Math.exp(-(t - a) * 9) : 0);
      const f = Math.max(fl(dur * 0.16, dur * 0.16 + 0.5), fl(dur * 0.56, dur * 0.56 + 0.4) * 0.7);
      flashMat.opacity = f * 0.85;
      flash.position.x = Math.sin(t * 3) * 40;
      mist.material.opacity = 0.06 + 0.10 * (1 - e);
    },
  };
}
'''

CLASSROOM = r'''export function shotClassroom() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1920 / 804, 0.1, 120);
  const upd = [];

  // 窗外：灰白阴雨天光（不曝）
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec3 c = mix(vec3(0.40,0.44,0.46), vec3(0.72,0.73,0.70), smoothstep(0.0,0.85,vUv.y));
        // 远处树影/楼影（缓慢晃动）
        float t = fbm(vec2(vUv.x*3.2 + uTime*0.01, vUv.y*3.0));
        c *= 0.80 + 0.30*smoothstep(0.35,0.75,t);
        // 雨痕
        float rr = 0.0;
        for(int i=0;i<3;i++){
          float fi=float(i);
          float x = fract(vUv.x*(4.0+fi*3.0) + uTime*0.01);
          rr += smoothstep(0.004,0.0,abs(x-0.5));
        }
        c -= rr*0.06;
        gl_FragColor = vec4(c*0.62,1.0);
      }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(46, 22), skyMat);
  bg.position.set(0, 3.4, -12.2);
  scene.add(bg); upd.push((t) => { skyMat.uniforms.uTime.value = t; });

  const dark = new THREE.MeshBasicMaterial({ color: 0x02040a });
  // 窗框（粗、有厚度）
  for (let i = 0; i <= 4; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.6, 0.30), dark);
    v.position.set(-6.2 + i * 3.1, 3.2, -11.8); scene.add(v);
  }
  for (let j = 0; j <= 3; j++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.20, 0.30), dark);
    h.position.set(0.0, 0.2 + j * 2.15, -11.8); scene.add(h);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.42, 0.6), dark);
  sill.position.set(0, 0.02, -11.6); scene.add(sill);
  // 左右墙
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 12), dark); wallL.position.set(-7.6, 4, -6);
  const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 12), dark); wallR.position.set(7.6, 4, -6);
  scene.add(wallL, wallR);

  // 光柱：从窗格射入（斜向拉长）
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 15), new THREE.MeshBasicMaterial({
      map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      color: 0xfff0d2, opacity: 0.085,
    }));
    m.position.set(-4.65 + i * 3.1, 2.4, -5.4);
    m.rotation.set(-0.72, 0, 0.05);
    scene.add(m);
  }

  // 课桌剪影
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.07, 0.66), dark);
      d.position.set(-4.5 + c * 3.05, 0.80, -3.0 + r * 2.1);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.8, 0.10), dark);
      leg.position.set(-4.5 + c * 3.05 + 0.42, 0.40, -3.0 + r * 2.1);
      const leg2 = leg.clone(); leg2.position.x -= 0.84;
      scene.add(d, leg, leg2);
    }
  }
  // 近景椅背
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.15, 0.10), dark);
  back.position.set(2.6, 0.98, 1.0); back.rotation.y = -0.28; back.rotation.x = -0.07;
  scene.add(back);

  const dust = createDust({ count: 1400, box: [16, 8, 14], size: 0.055, color: 0xffeccd, opacity: 0.85, seed: 5, rise: 0.05 });
  dust.position.set(0, 2.8, -5.5);
  scene.add(dust); upd.push((t) => dust.userData.update(t));

  return {
    scene, camera, bloom: 0.85, exposure: 0.95,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(1.0, 0.2, e), lerp(1.60, 1.46, e), lerp(6.8, 3.6, e));
      aim(camera, V3(-1.6, 2.4, -11.5), lerp(-0.012, 0.004, e));
      camera.position.add(handheld(t, 0.010, 0.55));
      camera.fov = lerp(34, 28, e);
      camera.updateProjectionMatrix();
    },
  };
}
'''

UMBRELLA = r'''export function shotUmbrella() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1920 / 804, 0.05, 60);
  const upd = [];

  // 背景：极暗，几团柔光
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec3 c = vec3(0.010,0.014,0.022);
        for(int i=0;i<8;i++){
          float fi=float(i);
          vec2 cp = vec2(hash21(vec2(fi*3.7,1.1)), hash21(vec2(fi*6.1,9.3)));
          vec2 d = (vUv-cp)*vec2(1.0,0.72);
          float r = 0.05 + hash21(vec2(fi,4.7))*0.10;
          float g = exp(-pow(length(d)/r, 2.4));
          vec3 lc = mix(vec3(1.0,0.56,0.24), vec3(0.30,0.55,0.85), step(0.60, hash21(vec2(fi,7.7))));
          c += lc*g*0.34;
        }
        c += vec3(0.35,0.24,0.12) * exp(-pow((vUv.y-0.30)*3.0,2.0)) * 0.35;
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(36, 22), bgMat);
  bg.position.set(0, 0.5, -9);
  scene.add(bg); upd.push((t) => { bgMat.uniforms.uTime.value = t; });

  // 伞（逆光轮廓 + 边缘光）
  const umb = new THREE.Group();
  const canopyMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
      void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz;
        vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz);
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime,uOpen; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
      void main(){
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec3 base = vec3(0.022,0.026,0.036);
        // 伞面肋条
        float rib = pow(abs(sin(vUv.x*3.14159*8.0)), 10.0);
        vec3 col = base + vec3(1.0,0.80,0.55)*fres*1.9;
        col += vec3(0.55,0.62,0.75)*rib*fres*0.5;
        // 伞顶透光
        col += vec3(1.0,0.72,0.40)*pow(1.0-abs(vUv.y-0.15), 8.0)*0.10;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.44),
    canopyMat
  );
  canopy.rotation.x = Math.PI;
  const ribMat = new THREE.MeshBasicMaterial({ color: 0x14181f });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 1.0, 4), ribMat);
    rib.position.set(Math.cos(a) * 0.5, -0.45, Math.sin(a) * 0.5);
    rib.rotation.z = Math.cos(a) * 0.5;
    rib.rotation.x = -Math.sin(a) * 0.5;
    umb.add(rib);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0x0d1016 }));
  pole.position.y = -1.15;
  umb.add(canopy, pole);
  umb.position.set(0, 0.95, 0);
  umb.rotation.set(-0.20, 0.28, 0.05);
  scene.add(umb);

  // 伞后的暖光（把伞托起来）
  const backlight = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 5.0), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa661, opacity: 0.55,
  }));
  backlight.position.set(0.3, 1.05, -2.2);
  scene.add(backlight);

  // 水珠飞散
  const N = 800;
  const pos = new Float32Array(N * 3);
  const dir = new Float32Array(N * 3);
  const siz = new Float32Array(N);
  const rnd = rng(404);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.5);
    pos[i * 3] = Math.cos(a) * r * 0.98;
    pos[i * 3 + 1] = 0.02 * (rnd() - 0.5);
    pos[i * 3 + 2] = Math.sin(a) * r * 0.98;
    dir[i * 3] = Math.cos(a) * (0.7 + rnd() * 1.0);
    dir[i * 3 + 1] = 0.45 + rnd() * 0.95;
    dir[i * 3 + 2] = Math.sin(a) * (0.7 + rnd() * 1.0);
    siz[i] = 1.6 + rnd() * 4.4;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  pg.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  const pmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 } },
    vertexShader: `attribute vec3 aDir; attribute float aSize;
      uniform float uT; varying float vA;
      void main(){
        float t = uT;
        vec3 p = position + aDir * (t*1.9) + vec3(0.0,-2.6*t*t,0.0);
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = clamp(aSize * 26.0 / max(d,0.001), 1.0, 26.0);
        vA = smoothstep(0.0,0.15,t) * (1.0 - smoothstep(0.7,1.6,t));
      }`,
    fragmentShader: `varying float vA;
      void main(){ vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.05,length(q));
        gl_FragColor=vec4(vec3(0.82,0.90,1.0), a*vA*0.9); }`,
  });
  const pts = new THREE.Points(pg, pmat);
  pts.frustumCulled = false;
  umb.add(pts);

  const rain = createRain({ count: 2600, area: [22, 22, 22], speed: [10, 16], len: [0.5, 1.5], width: 0.010, opacity: 0.32, seed: 77, color: 0xcfe2ff });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  return {
    scene, camera, bloom: 1.0, exposure: 1.05,
    update(t, dur) {
      upd.forEach((f) => f(t));
      canopyMat.uniforms.uTime.value = t;
      pmat.uniforms.uT.value = Math.max(0, t - 0.22);
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      const open = smooth(clamp((t - 0.10) / 0.50, 0, 1));
      umb.scale.set(lerp(0.42, 1.0, open), lerp(0.60, 1.0, open), lerp(0.42, 1.0, open));
      umb.rotation.y = lerp(0.85, 0.26, open);
      umb.position.y = lerp(0.62, 0.95, open);
      backlight.material.opacity = 0.25 + 0.45 * open;
      camera.position.set(lerp(0.15, -0.30, e), lerp(0.95, 1.10, e), lerp(3.3, 1.95, e));
      aim(camera, V3(lerp(0, -0.06, e), lerp(0.98, 1.02, e), 0), 0.03);
      camera.position.add(handheld(t, 0.012, 0.8));
      camera.fov = lerp(32, 26, e);
      camera.updateProjectionMatrix();
    },
  };
}
'''

def replace_block(src, start_key, end_key, new):
    i = src.index(start_key)
    j = src.index(end_key)
    k = src.rfind("/* =", 0, j)
    return src[:i] + new + "\n" + src[k:]

src = replace_block(src, "export function shotCloudDive()", "   2. 车窗雨滴微距", CLOUD)
src = replace_block(src, "export function shotClassroom()", "   8. 麦田", CLASSROOM)
src = replace_block(src, "export function shotUmbrella()", "   11. 雨停", UMBRELLA)

io.open(P, "w", encoding="utf-8").write(src)
print("ok", len(src))
