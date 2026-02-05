import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// So, real talk - I borrowed most of this code from other places, not because I am lazy (well that too a bit) but because it's all been done before.
// Built using Three.js (© mrdoob and contributors), including OrbitControls from the official Three.js examples.
// Earth day/night rendering is based on common shader techniques demonstrated in Three.js examples and early WebGL Earth tutorials by Lee Stemkoski and others.
// Latitude/longitude to Cartesian conversion uses standard spherical coordinate formulas widely documented in Three.js references and StackOverflow discussions.
// Sun position is approximated using simplified solar declination and subsolar longitude formulas commonly used in NOAA and educational globe visualizations.
// Glow markers and text sprites use standard Three.js canvas texture and sprite techniques inspired by official examples and community tutorials.
// Earth imagery:
// - Blue Marble & shaded relief: NASA EOSDIS GIBS
// - Night lights: VIIRS City Lights (2012), NASA
// tax dollars at work!

// --- Configuration ---
const TEXTURE_WIDTH = 4096;
const TEXTURE_HEIGHT = 2048;

// NASA GIBS WMS URLs
// Blue Marble (Day)
const DAY_URL = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&LAYERS=BlueMarble_ShadedRelief_Bathymetry&VERSION=1.3.0&FORMAT=image/jpeg&TRANSPARENT=false&WIDTH=${TEXTURE_WIDTH}&HEIGHT=${TEXTURE_HEIGHT}&CRS=EPSG:4326&BBOX=-90,-180,90,180`;

// VIIRS City Lights (Night) - Using 2012 as a stable base, or potentially updated layer if available.
const NIGHT_URL = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&LAYERS=VIIRS_CityLights_2012&VERSION=1.3.0&FORMAT=image/jpeg&TRANSPARENT=false&WIDTH=${TEXTURE_WIDTH}&HEIGHT=${TEXTURE_HEIGHT}&CRS=EPSG:4326&BBOX=-90,-180,90,180`;

// --- Shaders ---
const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
        vUv = uv;
        vNormal = normalize(normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform vec3 sunDirection;

    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
        float dotProd = dot(normalize(vNormal), normalize(sunDirection));
        vec4 dayColor = texture2D(dayTexture, vUv);
        dayColor.rgb *= 2.5;
        vec4 nightColor = texture2D(nightTexture, vUv);
        float blend = smoothstep(-0.2, 0.2, dotProd);
        vec3 finalColor = mix(nightColor.rgb, dayColor.rgb, blend);
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// -------------i borrowed all this stuff - I can't do this kind of math------------------
function lonLatToVector(latDeg, lonDeg) {
  const r = 1;
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function getSunDirection() {
  const now = new Date();
  const hours =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const dayOfYear = getDayOfYear(now);

  // Approximate solar declination (degrees). Around Feb 4 should be negative (southern hemisphere).
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));

  // Subsolar longitude (degrees): 12:00 UTC -> 0°, later UTC -> west (negative)
  const lonDeg = (12 - hours) * 15;

  return lonLatToVector(decl, lonDeg);
}

function getDayOfYear(date) {
  const start = new Date(Date.UTC(date.getFullYear(), 0, 0));
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

// --- Changeset Viz ---
const GLOW_STOPS = [
  { at: 0, color: "rgba(120, 255, 160, 1)" },
  { at: 0.2, color: "rgba(80, 255, 120, 1)" },
  { at: 0.5, color: "rgba(40, 220, 100, 0.5)" },
  { at: 1, color: "rgba(0, 180, 60, 0)" },
];

const glowMap = (() => {
  const size = 64;
  const radius = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  const grad = ctx.createRadialGradient(
    radius,
    radius,
    0,
    radius,
    radius,
    radius,
  );
  GLOW_STOPS.forEach(({ at, color }) => grad.addColorStop(at, color));

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
})();
const spriteMaterial = new THREE.SpriteMaterial({
  map: glowMap,
  color: 0xffffff,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
});

export function initGlobe({ containerId = "canvas-container", onReady } = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Missing globe container: #${containerId}`);
    return {
      addPoint: () => {},
      addTagSprite: () => {},
      focusOn: () => {},
      isReady: () => false,
    };
  }

  let scene;
  let camera;
  let renderer;
  let globe;
  let controls;
  let globeReady = false;

  const points = new Map(); // id -> { sprite, data }
  const tagSprites = new Set(); // { obj, ts, base, dir }
  const maxAgeMs = 30 * 60 * 1000; // 30 minutes
  const tagMaxAgeMs = 6000;

  function focusGlobeOn(lat, lon) {
    if (!globe) return;
    const lonRad = (lon * Math.PI) / 180;
    globe.rotation.set(0, Math.PI / 2 - lonRad + Math.PI, 0);
  }

  function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.z = 2.5; // Enough to see the full globe

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // Tone mapping for better look?
    // renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 4;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    document.fonts?.load('16px "WebPlus IBM VGA 8x16"').catch(() => {});

    // --- Create Globe ---
    const textureLoader = new THREE.TextureLoader();

    Promise.all([
      textureLoader.loadAsync(DAY_URL),
      textureLoader.loadAsync(NIGHT_URL),
    ])
      .then(([dayTex, nightTex]) => {
        dayTex.colorSpace = THREE.SRGBColorSpace;
        nightTex.colorSpace = THREE.SRGBColorSpace;

        const geometry = new THREE.SphereGeometry(1, 64, 64);

        const material = new THREE.ShaderMaterial({
          uniforms: {
            dayTexture: { value: dayTex },
            nightTexture: { value: nightTex },
            sunDirection: { value: new THREE.Vector3(1, 0, 0) },
          },
          vertexShader: vertexShader,
          fragmentShader: fragmentShader,
        });

        globe = new THREE.Mesh(geometry, material);
        scene.add(globe);
        globeReady = true;
        onReady?.();
      })
      .catch((err) => console.error("Texture load error", err));

    // Handle Resize
    window.addEventListener("resize", onWindowResize, false);

    // Start Loop
    animate();
  }

  function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function addPoint(id, lat, lon) {
    if (points.has(id)) return;
    if (!globe) return;
    const r = 1.01;

    // Math from debug.html (Validated by User)
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -r * Math.sin(phi) * Math.cos(theta);
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);

    const position = new THREE.Vector3(x, y, z);

    const sprite = new THREE.Sprite(spriteMaterial.clone());
    sprite.position.copy(position);
    sprite.scale.set(0, 0, 1);

    globe.add(sprite);

    points.set(id, {
      obj: sprite,
      ts: Date.now(),
      lat: lat,
      lon: lon,
    });
  }

  function createTextSprite(text, color = "#2aff5c") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x2aff5c }));
    }
    const fontSize = 10;
    const padding = 2;
    ctx.font = `${fontSize}px "WebPlus IBM VGA 8x16", monospace`;
    const metrics = ctx.measureText(text);
    canvas.width = Math.ceil(metrics.width) + padding * 2;
    canvas.height = fontSize + padding * 2;
    ctx.font = `${fontSize}px "WebPlus IBM VGA 8x16", monospace`;
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    ctx.fillText(text, padding, padding);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    const scale = Math.min(0.08, canvas.width / 800);
    sprite.scale.set(scale, scale * (canvas.height / canvas.width), 1);
    return sprite;
  }

  function addTagSprite(text, lat, lon, color = "#2aff5c") {
    if (!globe) return;
    const r = 1.02;
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -r * Math.sin(phi) * Math.cos(theta);
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);
    const base = new THREE.Vector3(x, y, z);
    const dir = base.clone().normalize();
    const sprite = createTextSprite(text, color);
    sprite.position.copy(base);
    globe.add(sprite);
    tagSprites.add({ obj: sprite, ts: Date.now(), base, dir });
  }

  function updatePoints() {
    const now = Date.now();
    const toRemove = [];

    for (const [id, p] of points.entries()) {
      const age = now - p.ts;
      if (age > maxAgeMs) {
        toRemove.push(id);
        continue;
      }

      const fade = Math.max(0, 1 - age / maxAgeMs);
      let scale;
      let opacity;

      if (age < 450) {
        // Single pulse
        const burstIn = Math.min(1, age / 120);
        const pulse = (Math.sin(age * 0.014) + 1) / 2;
        scale = (0.05 + pulse * 0.02) * burstIn;
        opacity = burstIn;
      } else {
        scale = 0.03 * fade;
        opacity = fade;
      }

      p.obj.scale.set(scale, scale, 1);
      p.obj.material.opacity = opacity;
    }

    toRemove.forEach((id) => {
      const p = points.get(id);
      if (globe) globe.remove(p.obj);
      points.delete(id);
    });
  }

  function updateTagSprites() {
    const now = Date.now();
    const toRemove = [];
    for (const t of tagSprites) {
      const age = now - t.ts;
      if (age > tagMaxAgeMs) {
        toRemove.push(t);
        continue;
      }
      const k = age / tagMaxAgeMs;
      const offset = 0.02 + k * 0.18;
      t.obj.position.copy(
        t.base.clone().add(t.dir.clone().multiplyScalar(offset)),
      );
      t.obj.material.opacity = 1 - k;
    }
    toRemove.forEach((t) => {
      if (globe) globe.remove(t.obj);
      tagSprites.delete(t);
    });
  }

  function animate() {
    requestAnimationFrame(animate);

    controls.update();
    updatePoints();
    updateTagSprites();

    if (globe && globe.material.uniforms) {
      const sunWorld = getSunDirection();
      globe.material.uniforms.sunDirection.value.copy(sunWorld);
    }

    renderer.render(scene, camera);
  }

  init();

  return {
    addPoint,
    addTagSprite,
    focusOn: focusGlobeOn,
    isReady: () => globeReady,
    getControls: () => controls,
  };
}
