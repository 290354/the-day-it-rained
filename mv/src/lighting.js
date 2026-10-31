import * as THREE from 'three';

/**
 * 全局「假灯光」系统：最多 4 盏点光，所有材质共享同一组 uniform，
 * 换镜头时调用 setLights() 即可整体改光。
 * 目的：让场景有体积和明暗，而不是一片平涂的 MeshBasic。
 */
export const LIGHTS = {
  uLPos: {
    value: [
      new THREE.Vector4(0, 5, 0, 0),
      new THREE.Vector4(0, 5, 0, 0),
      new THREE.Vector4(0, 5, 0, 0),
      new THREE.Vector4(0, 5, 0, 0),
    ],
  },
  uLCol: {
    value: [
      new THREE.Color(0xffa855),
      new THREE.Color(0xffa855),
      new THREE.Color(0xffa855),
      new THREE.Color(0xffa855),
    ],
  },
  uAmb: { value: new THREE.Color(0x04080d) },
  uFogCol: { value: new THREE.Color(0x060b12) },
  uFogDen: { value: 0.0060 },
};

export function setLights(list, opts = {}) {
  const n = Math.min(4, list.length);
  for (let i = 0; i < 4; i++) {
    const l = list[i];
    if (l) {
      LIGHTS.uLPos.value[i].set(l.pos[0], l.pos[1], l.pos[2], l.intensity ?? 1);
      LIGHTS.uLCol.value[i].set(l.color ?? 0xffa855);
    } else {
      LIGHTS.uLPos.value[i].set(0, -999, 0, 0);
    }
  }
  if (opts.amb !== undefined) LIGHTS.uAmb.value.set(opts.amb);
  if (opts.fogCol !== undefined) LIGHTS.uFogCol.value.set(opts.fogCol);
  if (opts.fogDen !== undefined) LIGHTS.uFogDen.value = opts.fogDen;
}

export const GLSL_LIGHTS = /* glsl */`
uniform vec4 uLPos[4];
uniform vec3 uLCol[4];
uniform vec3 uAmb;
uniform vec3 uFogCol;
uniform float uFogDen;

vec3 shadePoint(vec3 N, vec3 P, vec3 base, float specAmt, float shininess){
  vec3 c = base * uAmb * 6.0;
  vec3 V = normalize(cameraPosition - P);
  for(int i = 0; i < 4; i++){
    vec3 Lv = uLPos[i].xyz - P;
    float d = length(Lv);
    vec3 L = Lv / max(d, 0.001);
    float att = uLPos[i].w * 0.22 / (1.0 + d * d * 0.30);
    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(N, H), 0.0), shininess) * specAmt;
    c += (base * diff * 2.2 + uLCol[i] * sp * att * 0.85) * att;
  }
  return c;
}

vec3 applyFog(vec3 c, vec3 P){
  float d = length(P - cameraPosition);
  float f = 1.0 - exp(-d * uFogDen);
  return mix(c, uFogCol, clamp(f, 0.0, 1.0));
}
`;

/** 受光材质：带轮廓光 + 雾 */
export function litMaterial(color, opt = {}) {
  const {
    spec = 0.25, shininess = 42, rim = 0x000000, rimAmt = 0.0, side = THREE.FrontSide,
    emissive = 0x000000, emissiveAmt = 0.0, fog = 1.0,
  } = opt;
  return new THREE.ShaderMaterial({
    side,
    uniforms: {
      ...LIGHTS,
      uCol: { value: new THREE.Color(color) },
      uSpec: { value: spec },
      uShin: { value: shininess },
      uRim: { value: new THREE.Color(rim) },
      uRimAmt: { value: rimAmt },
      uEmis: { value: new THREE.Color(emissive) },
      uEmisAmt: { value: emissiveAmt },
      uFog: { value: fog },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_LIGHTS}
      uniform vec3 uCol, uRim, uEmis;
      uniform float uSpec, uShin, uRimAmt, uEmisAmt, uFog;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vec3 N = normalize(vN);
        vec3 c = shadePoint(N, vW, uCol, uSpec, uShin);
        float f = 1.0 - abs(dot(N, normalize(vV)));
        c += uRim * pow(f, 3.0) * uRimAmt;
        c += uEmis * uEmisAmt;
        vec3 fogCol = applyFog(c, vW);
        c = mix(c, fogCol, uFog);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}
