import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// proporción de zoom inicial (más alto = vista más lejana)
const zoom = 3;
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 2; // tamaño base del "alto" del frustum

const camera = new THREE.OrthographicCamera(
  (-frustumSize * aspect) / zoom,
  (frustumSize * aspect) / zoom,
  frustumSize / zoom,
  -frustumSize / zoom,
  0.01,
  100
);

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let mixer;
const clock = new THREE.Clock();

// controles orbitales
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true; // útil en ortográfica
controls.minZoom = 0.5;
controls.maxZoom = 5;

// luz
scene.add(new THREE.AmbientLight(0xffffff, 3));

// cargar modelo
new GLTFLoader().load('./assets/darki006.glb', (gltf) => {
  const model = gltf.scene;
  scene.add(model);

  // Ajuste de materiales para capas con transparencia dura
  model.traverse((o) => {
    if (o.isMesh && o.material) {
      const m = o.material;
      m.transparent = false;    // usamos cutout, no blending
      m.alphaTest   = 0.5;      // ajusta 0.3–0.7 según tu textura
      m.depthWrite  = true;
      m.depthTest   = true;
    }
  });

  // encuadrar modelo en cámara ortográfica
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 1.2;



  // centrar cámara y controles
  controls.target.copy(center);
  camera.position.set(center.x, center.y, center.z + distance);
  camera.updateProjectionMatrix();
  controls.update();

  const clips = gltf.animations || [];
  mixer = new THREE.AnimationMixer(model);

  if (!clips.length) return;

  // 1) Acción base (idle) en modo normal
  const baseClip = clips[0];
  const baseAction = mixer.clipAction(baseClip);
  baseAction.setLoop(THREE.LoopRepeat, Infinity);
  baseAction.enabled = true;
  baseAction.setEffectiveWeight(1.0);
  baseAction.play();

  // 2) Resto como aditivas
  for (let i = 1; i < clips.length; i++) {
    // convierte el clip a aditivo respecto al frame 0 de sí mismo (o usa baseClip como ref si prefieres)
    const additive = THREE.AnimationUtils.makeClipAdditive(clips[i], 0, baseClip);
    const action = mixer.clipAction(additive);
    action.blendMode = THREE.AdditiveAnimationBlendMode; // clave para sumar
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.enabled = true;
    action.setEffectiveWeight(1); // ajusta pesos a gusto (0.1–1.0)
    action.play();
  }
}, undefined, console.error);

// loop
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

// resize adaptado a ortográfica
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = (-frustumSize * aspect) / zoom;
  camera.right = (frustumSize * aspect) / zoom;
  camera.top = frustumSize / zoom;
  camera.bottom = -frustumSize / zoom;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
