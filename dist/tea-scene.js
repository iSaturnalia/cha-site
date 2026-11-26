import * as THREE from './vendor/three/three.module.min.js';

const { Vector2, Vector3, MathUtils } = THREE;
const ease = (value, start, end) => MathUtils.smoothstep(value, start, end);

function clayTexture() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  let state = 71237;
  for (let i = 0; i < pixels.length; i += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const gray = 105 + (state >>> 26);
    pixels.set([gray, gray, gray, 255], i);
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.generateMipmaps = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function profileMesh(profile, material) {
  const points = profile.map(([radius, height]) => new Vector3(radius, height, 0));
  const curve = new THREE.CatmullRomCurve3(points);
  const lathe = curve.getPoints(54).map(({ x, y }) => new Vector2(Math.max(0, x), y));
  return new THREE.Mesh(new THREE.LatheGeometry(lathe, 72), material);
}

function curvedTube(curve, radiusAt, segments, sides) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((segments + 1) * (sides + 1) * 3);
  const normals = new Float32Array(positions.length);
  const uvs = new Float32Array((segments + 1) * (sides + 1) * 2);
  const indices = [];
  const cross = new Vector3();
  const forward = new Vector3(0, 0, 1);
  const normal = new Vector3();
  for (let i = 0; i <= segments; i += 1) {
    for (let j = 0; j <= sides; j += 1) {
      const index = i * (sides + 1) + j;
      uvs[index * 2] = j / sides;
      uvs[index * 2 + 1] = i / segments;
      if (i === segments || j === sides) continue;
      const next = index + sides + 1;
      indices.push(index, index + 1, next, index + 1, next + 1, next);
    }
  }
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  function reshape(path, thickness, length = 1) {
    for (let i = 0; i <= segments; i += 1) {
      const along = i / segments;
      const t = along * length;
      const point = path.getPoint(t);
      cross.crossVectors(forward, path.getTangent(t)).normalize();
      const radius = thickness(along);
      for (let j = 0; j <= sides; j += 1) {
        const angle = j / sides * Math.PI * 2;
        normal.copy(cross).multiplyScalar(Math.cos(angle)).addScaledVector(forward, Math.sin(angle));
        const k = (i * (sides + 1) + j) * 3;
        positions.set([point.x + radius * normal.x, point.y + radius * normal.y, point.z + radius * normal.z], k);
        normals.set([normal.x, normal.y, normal.z], k);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
  }

  reshape(curve, radiusAt);
  return { geometry, reshape };
}

function ceramicDetails(texture) {
  const clay = new THREE.MeshPhysicalMaterial({
    color: 0x9d4e37, roughness: 0.55, metalness: 0.0,
    bumpMap: texture, bumpScale: 0.027, clearcoat: 0.19, clearcoatRoughness: 0.51,
    side: THREE.DoubleSide,
  });
  const porcelain = new THREE.MeshPhysicalMaterial({
    color: 0xe1bd88, roughness: 0.32, metalness: 0.0,
    bumpMap: texture, bumpScale: 0.013, clearcoat: 0.38, clearcoatRoughness: 0.27,
    side: THREE.DoubleSide,
  });
  const darkClay = clay.clone();
  darkClay.color.setHex(0x4a271d);
  const unglazed = porcelain.clone();
  unglazed.color.setHex(0x9e6341);
  unglazed.roughness = 0.68;
  return { clay, porcelain, darkClay, unglazed };
}

function teapot({ clay, darkClay }) {
  const group = new THREE.Group();
  group.add(profileMesh([
    [0, 0.05], [0.44, 0.05], [0.57, 0.13], [0.75, 0.26], [0.88, 0.48],
    [0.92, 0.69], [0.87, 0.88], [0.73, 1.03], [0.50, 1.12], [0.46, 1.15],
  ], clay));
  group.add(profileMesh([
    [0.44, 1.125], [0.48, 1.14], [0.49, 1.18], [0.44, 1.22],
    [0.38, 1.29], [0.27, 1.32], [0.07, 1.33], [0, 1.33],
  ], clay));
  group.add(profileMesh([
    [0, 1.32], [0.105, 1.32], [0.105, 1.39], [0.15, 1.44],
    [0.15, 1.485], [0.11, 1.52], [0, 1.54],
  ], clay));

  const bend = new THREE.CatmullRomCurve3([
    new Vector3(-0.68, 0.89, 0), new Vector3(-1.04, 1.03, 0),
    new Vector3(-1.37, 0.96, 0), new Vector3(-1.43, 0.66, 0),
    new Vector3(-1.26, 0.42, 0), new Vector3(-0.75, 0.36, 0),
  ]);
  const handle = curvedTube(bend, (t) => 0.088 + 0.032 * Math.sin(t * Math.PI), 40, 14);
  group.add(new THREE.Mesh(handle.geometry, clay));

  const nozzle = new Vector3(1.58, 1.12, 0);
  const spoutPath = new THREE.CatmullRomCurve3([
    new Vector3(0.73, 0.55, 0), new Vector3(1.04, 0.65, 0),
    new Vector3(1.33, 0.86, 0), nozzle,
  ]);
  const spout = curvedTube(spoutPath, (t) => 0.22 - 0.135 * Math.pow(t, 0.63), 36, 22);
  group.add(new THREE.Mesh(spout.geometry, clay));

  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.075, 28), darkClay);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.077, 0.013, 10, 30), clay);
  const faceOut = spoutPath.getTangent(1);
  for (const part of [mouth, rim]) {
    part.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), faceOut);
    part.position.copy(nozzle);
    group.add(part);
  }
  rim.position.addScaledVector(faceOut, 0.008);

  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.481, 0.012, 8, 70), darkClay);
  seam.rotation.x = Math.PI / 2;
  seam.position.y = 1.141;
  group.add(seam);
  return { group, nozzle };
}

function teacup(materials) {
  const group = new THREE.Group();
  group.add(profileMesh([
    [0, 0], [0.35, 0], [0.36, 0.032], [0.32, 0.11], [0.39, 0.14], [0.51, 0.25],
    [0.63, 0.45], [0.67, 0.55], [0.665, 0.575], [0.61, 0.574], [0.60, 0.52],
    [0.55, 0.40], [0.47, 0.29], [0.34, 0.20], [0.20, 0.17], [0, 0.16],
  ], materials.porcelain));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.642, 0.016, 12, 72), materials.unglazed);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.563;
  group.add(rim);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.562, 0.009, 8, 64), materials.unglazed);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.318;
  group.add(band);
  group.position.set(1.24, 0.12, 0.23);
  return group;
}

function ground(scene) {
  const platter = profileMesh([
    [0, -0.16], [2.69, -0.16], [2.78, -0.13], [2.83, -0.05],
    [2.82, 0.02], [2.73, 0.075], [2.53, 0.095], [0, 0.095],
  ], new THREE.MeshStandardMaterial({ color: 0x39241e, roughness: 0.68, side: THREE.DoubleSide }));
  platter.scale.z = 0.58;
  platter.receiveShadow = true;
  scene.add(platter);
  const groove = new THREE.Mesh(
    new THREE.TorusGeometry(2.62, 0.012, 8, 96),
    new THREE.MeshStandardMaterial({ color: 0x654336, roughness: 0.5 }),
  );
  groove.rotation.x = Math.PI / 2;
  groove.scale.y = 0.58;
  groove.position.y = 0.097;
  scene.add(groove);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const context = shadowCanvas.getContext('2d');
  const radial = context.createRadialGradient(32, 32, 9, 32, 32, 32);
  radial.addColorStop(0, 'rgba(8, 4, 2, .66)');
  radial.addColorStop(1, 'rgba(8, 4, 2, 0)');
  context.fillStyle = radial;
  context.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.9), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false,
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.10, -0.19, 0.30);
  scene.add(shadow);
}

export function createTeaScene(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
  if (!gl) throw new Error('WebGL 2 is unavailable');
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3.0, 3.0, 2.0, -2.0, 0.1, 35);
  scene.add(new THREE.HemisphereLight(0xffe1bd, 0x40201a, 1.3));
  const key = new THREE.DirectionalLight(0xffd2a0, 3.1);
  key.position.set(-4, 6, 5);
  const rim = new THREE.DirectionalLight(0xffa35c, 2.45);
  rim.position.set(2, 3, -4);
  const fill = new THREE.DirectionalLight(0xf4e8d6, 0.62);
  fill.position.set(4, 1, 5);
  scene.add(key, rim, fill);

  ground(scene);
  const materials = ceramicDetails(clayTexture());
  const pot = teapot(materials);
  const cup = teacup(materials);
  scene.add(pot.group, cup);

  const tea = new THREE.MeshPhysicalMaterial({
    color: 0xa8420a, roughness: 0.18, metalness: 0.1, clearcoat: 0.9,
    clearcoatRoughness: 0.15, side: THREE.DoubleSide, emissive: 0x371000,
    emissiveIntensity: 0.25,
  });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1, 72), tea);
  surface.rotation.x = -Math.PI / 2;
  cup.add(surface);
  const rings = Array.from({ length: 3 }, () => {
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(1, 0.017, 8, 54), new THREE.MeshBasicMaterial({
      color: 0xffbf62, transparent: true, opacity: 0, depthWrite: false,
    }));
    ripple.rotation.x = Math.PI / 2;
    cup.add(ripple);
    return ripple;
  });

  const start = new Vector3();
  const middle = new Vector3(0.7, 1.57, 0.1);
  const end = cup.position.clone().add(new Vector3(0, 0.3, 0));
  const trajectory = new THREE.QuadraticBezierCurve3(start, middle, end);
  start.set(-0.22, 1.55, -0.03);
  const radius = (t) => 0.041 * (1 - 0.52 * t);
  const shape = curvedTube(trajectory, radius, 34, 12);
  const stream = new THREE.Mesh(shape.geometry, tea);
  stream.frustumCulled = false;
  scene.add(stream);

  return {
    resize(width, height) {
      const aspect = width / height;
      const halfWidth = Math.max(3.2, 1.82 * aspect);
      const halfHeight = halfWidth / aspect;
      Object.assign(camera, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight });
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    },
    render(progress) {
      const lifted = ease(progress, 0.02, 0.34) * (1 - ease(progress, 0.78, 1));
      const tipped = ease(progress, 0.19, 0.4) * (1 - ease(progress, 0.72, 0.94));
      pot.group.position.set(-1.29 - 0.20 * lifted, 0.045 + 1.01 * lifted, -0.16);
      pot.group.rotation.z = -0.54 * tipped;
      pot.group.rotation.y = -0.06 + 0.2 * tipped;
      pot.group.updateMatrixWorld(true);
      start.copy(pot.nozzle).applyMatrix4(pot.group.matrixWorld);

      const fillLevel = ease(progress, 0.41, 0.82);
      const liquidHeight = 0.184 + fillLevel * 0.281;
      const liquidRadius = 0.19 + fillLevel * 0.376;
      surface.position.y = liquidHeight;
      surface.scale.setScalar(liquidRadius);
      surface.visible = progress > 0.405;
      end.copy(cup.position).add(new Vector3(0, liquidHeight, 0));
      middle.copy(start);
      middle.x += (end.x - start.x) * 0.56;
      middle.y += 0.08;
      middle.z += (end.z - start.z) * 0.62;
      const reach = ease(progress, 0.31, 0.455);
      const cutoff = 1 - ease(progress, 0.715, 0.81);
      stream.visible = reach > 0.012 && cutoff > 0.012;
      if (stream.visible) shape.reshape(trajectory, (t) => radius(t) * cutoff, reach);

      const strength = ease(progress, 0.415, 0.5) * (1 - ease(progress, 0.83, 0.995));
      for (const [index, ripple] of rings.entries()) {
        const phase = ((progress - 0.405) * 7 + index / 3 + 1) % 1;
        ripple.visible = strength > 0.005;
        ripple.position.y = liquidHeight + 0.006 + index * 0.001;
        ripple.scale.setScalar(Math.max(0.006, phase * liquidRadius * 0.98));
        ripple.material.opacity = (1 - phase) * strength * 0.64;
      }

      camera.position.set(MathUtils.lerp(2.05, 2.80, progress), 3.55 + 0.85 * progress, 8.8);
      camera.lookAt(-0.10, 1.00 + lifted * 0.29, 0);
      renderer.render(scene, camera);
    },
  };
}
