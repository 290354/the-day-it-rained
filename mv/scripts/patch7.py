import io

MJ = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/main.js"
m = io.open(MJ, encoding="utf-8").read()
n = 0
def R(old, new):
    global m, n
    assert old in m, "MISS: " + old[:80]
    m = m.replace(old, new, 1); n += 1

# 1) 最终 Pass 增加：变形镜头横向耀斑（anamorphic streak）
R("""    uSat: { value: 1.0 },""",
  """    uSat: { value: 1.0 },
    uStreak: { value: 0.10 },
    uStreakTint: { value: new THREE.Color(0x7fa8ff) },""")
R("""    uniform vec3 uLift; uniform vec2 uRes;""",
  """    uniform vec3 uLift; uniform vec2 uRes;
    uniform float uStreak; uniform vec3 uStreakTint;""")
R("""      // 高光柔性压缩（防止死白）""",
  """      // 变形镜头横向耀斑（只在极亮处）
      vec3 streak = vec3(0.0);
      for(int i=1;i<=9;i++){
        float fi = float(i);
        vec2 o = vec2(fi*4.6/uRes.x, 0.0);
        vec3 a = texture2D(tDiffuse, uv + o).rgb;
        vec3 b = texture2D(tDiffuse, uv - o).rgb;
        float la = max(max(a.r,a.g),a.b);
        float lb = max(max(b.r,b.g),b.b);
        streak += (a*smoothstep(0.70,1.05,la) + b*smoothstep(0.70,1.05,lb)) * (1.0 - fi/10.5);
      }
      col += streak * uStreakTint * uStreak;

      // 高光柔性压缩（防止死白）""")

# 2) 景深 Pass
R("""/* ---------------- composer ---------------- */""",
  """/* ---------------- 景深（CoC 散景） ---------------- */
const DofShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uNear: { value: 0.1 },
    uFar: { value: 400 },
    uFocus: { value: 10 },
    uAperture: { value: 0.75 },
    uMaxBlur: { value: 11 },
    uRes: { value: new THREE.Vector2(W, H) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float uNear, uFar, uFocus, uAperture, uMaxBlur;
    uniform vec2 uRes;
    varying vec2 vUv;

    float linearDepth(vec2 uv){
      float z = texture2D(tDepth, uv).x;
      float ndc = z * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
    }

    void main(){
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      float dz = linearDepth(uv);
      // 前景更锐利（近焦平面），远景按光圈扩散
      float coc = clamp(abs(dz - uFocus) / max(uFocus, 0.001) * uAperture, 0.0, 1.0);
      float rad = coc * uMaxBlur;
      if (rad > 0.7) {
        vec3 sum = col;
        float wsum = 1.0;
        for (int i = 0; i < 18; i++) {
          float fi = float(i);
          float ang = fi * 2.39996323 + 0.7;
          float rr = sqrt((fi + 0.5) / 18.0) * rad;
          vec2 off = vec2(cos(ang), sin(ang)) * rr / uRes;
          float d2 = linearDepth(uv + off);
          float w = 1.0;
          // 前景不污染后景（简单遮挡判断）
          if (d2 > dz + 0.35) w = 1.0;
          sum += texture2D(tDiffuse, uv + off).rgb * w;
          wsum += w;
        }
        col = sum / wsum;
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* ---------------- composer ---------------- */""")

# 3) setupComposer 换成带深度纹理的版本
R("""function setupComposer(shot) {
  if (composer) { composer.dispose?.(); }
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  const rp = new RenderPass(shot.scene, shot.camera);
  composer.addPass(rp);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), shot.bloom ?? 0.8, 0.62, 0.72);
  composer.addPass(bloomPass);
  finalPass = new ShaderPass(FinalShader);
  finalPass.renderToScreen = true;
  composer.addPass(finalPass);
  composer._rp = rp;
}""",
  """let dofPass = null, sceneRT = null;

function setupComposer(shot) {
  if (composer) { composer.dispose?.(); }
  if (sceneRT) { sceneRT.depthTexture?.dispose(); sceneRT.dispose(); }

  const depthTex = new THREE.DepthTexture(W, H);
  depthTex.type = THREE.UnsignedIntType;
  sceneRT = new THREE.WebGLRenderTarget(W, H, {
    type: THREE.HalfFloatType,
    depthTexture: depthTex,
    depthBuffer: true,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  composer = new EffectComposer(renderer, sceneRT);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  const rp = new RenderPass(shot.scene, shot.camera);
  composer.addPass(rp);

  dofPass = null;
  if (!shot.quad) {
    dofPass = new ShaderPass(DofShader);
    dofPass.uniforms.tDepth.value = depthTex;
    dofPass.uniforms.uNear.value = shot.camera.near ?? 0.1;
    dofPass.uniforms.uFar.value = shot.camera.far ?? 400;
    dofPass.uniforms.uFocus.value = shot.dof?.focus ?? 10;
    dofPass.uniforms.uAperture.value = shot.dof?.aperture ?? 0.80;
    dofPass.uniforms.uMaxBlur.value = shot.dof?.max ?? 10;
    composer.addPass(dofPass);
  }

  bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), shot.bloom ?? 0.8, 0.66, 0.70);
  composer.addPass(bloomPass);
  finalPass = new ShaderPass(FinalShader);
  finalPass.renderToScreen = true;
  composer.addPass(finalPass);
  composer._rp = rp;
}""")

# 4) frame() 里允许按条目微调焦点
R("""    u.uWeave.value = entry.grade?.weave ?? 1.0;
  }""",
  """    u.uWeave.value = entry.grade?.weave ?? 1.0;
    u.uStreak.value = entry.grade?.streak ?? 0.10;
  }
  if (dofPass && entry.dof) {
    if (entry.dof.focus !== undefined) dofPass.uniforms.uFocus.value = entry.dof.focus;
    if (entry.dof.aperture !== undefined) dofPass.uniforms.uAperture.value = entry.dof.aperture;
    if (entry.dof.max !== undefined) dofPass.uniforms.uMaxBlur.value = entry.dof.max;
  }""")

io.open(MJ, "w", encoding="utf-8").write(m)
print("main.js patched", n)
