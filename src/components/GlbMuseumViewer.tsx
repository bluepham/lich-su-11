import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  SunMedium,
} from 'lucide-react';
import type { Model3DItem, ModelHotspot, ModelPhase } from '../types';
import { HistoricalTacticalMap2D } from './HistoricalTacticalMap2D';

const _projVec = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _targetGoal = new THREE.Vector3();

type AtmosphereMode = 'museum_night' | 'daylight_park' | 'golden_sunset';

const ATMOSPHERE_PRESETS: Record<
  AtmosphereMode,
  {
    label: string;
    worldBg: number;
    studioBg: number;
    horizonGround: number;
    fogDensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    keyColor: number;
    keyIntensity: number;
    rimColor: number;
    rimIntensity: number;
    exposure: number;
  }
> = {
  daylight_park: {
    label: 'Ban ngày Non sông',
    worldBg: 0x9dc0de,
    studioBg: 0x162947,
    horizonGround: 0x334d30,
    fogDensity: 0.0075,
    hemiSky: 0xdbeafe,
    hemiGround: 0x3f4e33,
    hemiIntensity: 0.72,
    keyColor: 0xfff5e0,
    keyIntensity: 1.48,
    rimColor: 0x93c5fd,
    rimIntensity: 0.52,
    exposure: 0.98,
  },
  golden_sunset: {
    label: 'Hoàng hôn Sử thi',
    worldBg: 0xd09564,
    studioBg: 0x2a1829,
    horizonGround: 0x3f2e1e,
    fogDensity: 0.0082,
    hemiSky: 0xfde68a,
    hemiGround: 0x352216,
    hemiIntensity: 0.68,
    keyColor: 0xffb869,
    keyIntensity: 1.54,
    rimColor: 0xc084fc,
    rimIntensity: 0.48,
    exposure: 1.0,
  },
  museum_night: {
    label: 'Sa bàn Bảo tàng Đêm',
    worldBg: 0x0e1a33,
    studioBg: 0x0b132b,
    horizonGround: 0x13223d,
    fogDensity: 0.0085,
    hemiSky: 0x9ec5fe,
    hemiGround: 0x2b251c,
    hemiIntensity: 0.66,
    keyColor: 0xfff0d4,
    keyIntensity: 1.42,
    rimColor: 0x6ea8fe,
    rimIntensity: 0.55,
    exposure: 1.0,
  },
};

function detectSoftwareWebGL(): { supported: boolean; isSoftware: boolean } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { supported: false, isSoftware: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftware = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { supported: true, isSoftware };
  } catch {
    return { supported: false, isSoftware: true };
  }
}

interface GlbMuseumViewerProps {
  model: Model3DItem;
  heightClass?: string;
  compact?: boolean;
  autoFitSingleAsset?: boolean;
  activePhaseKey?: string;
  onPhaseChange?: (phase: ModelPhase) => void;
  onHotspotSelect?: (hotspot: ModelHotspot) => void;
  onObjectInspected?: (name: string) => void;
}

export function GlbMuseumViewer({
  model,
  heightClass = 'h-[520px]',
  compact = false,
  autoFitSingleAsset = false,
  activePhaseKey,
  onPhaseChange,
  onHotspotSelect,
  onObjectInspected,
}: GlbMuseumViewerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const hotspotLayerRef = useRef<HTMLDivElement | null>(null);

  const [webglStatus, setWebglStatus] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [availableClips, setAvailableClips] = useState<string[]>([]);
  const [selectedClip, setSelectedClip] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [atmosphere, setAtmosphere] = useState<AtmosphereMode>('daylight_park');
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [lowPowerMode, setLowPowerMode] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedHotspot, setSelectedHotspot] = useState<ModelHotspot | null>(null);
  const [clickedMeshLabel, setClickedMeshLabel] = useState<string>('');
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const [internalPhaseKey, setInternalPhaseKey] = useState<string>(
    activePhaseKey || model.phases[0]?.key || 'all',
  );

  const currentPhaseKey = activePhaseKey ?? internalPhaseKey;

  const callbacksRef = useRef({ onHotspotSelect, onObjectInspected });
  callbacksRef.current = { onHotspotSelect, onObjectInspected };

  const runtimeRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    controls: OrbitControls | null;
    hemiLight: THREE.HemisphereLight | null;
    keyLight: THREE.DirectionalLight | null;
    rimLight: THREE.DirectionalLight | null;
    horizonMesh: THREE.Mesh | null;
    mixer: THREE.AnimationMixer | null;
    clips: THREE.AnimationClip[];
    activeAction: THREE.AnimationAction | null;
    transitioning: boolean;
    goalPos: [number, number, number];
    goalTarget: [number, number, number];
    requestRender: () => void;
    isPlaying: boolean;
    speed: number;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    hemiLight: null,
    keyLight: null,
    rimLight: null,
    horizonMesh: null,
    mixer: null,
    clips: [],
    activeAction: null,
    transitioning: false,
    goalPos: model.cameraSettings?.position || [9.5, 7.2, 11.5],
    goalTarget: model.cameraSettings?.target || [0, 0.2, 0],
    requestRender: () => {},
    isPlaying: false,
    speed: 1,
  });

  const visibleHotspots = model.hotspots.filter(
    (h) => h.phaseKey === 'all' || h.phaseKey === currentPhaseKey || !currentPhaseKey,
  );
  const hotspotsRef = useRef<ModelHotspot[]>(visibleHotspots);
  hotspotsRef.current = visibleHotspots;

  useEffect(() => {
    const probe = detectSoftwareWebGL();
    if (!probe.supported) {
      setWebglStatus('unsupported');
      return;
    }

    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const isSoftwareGl = probe.isSoftware;
    setWebglStatus('loading');
    setErrorMessage('');
    setSelectedHotspot(null);
    setClickedMeshLabel('');

    const preset = ATMOSPHERE_PRESETS[atmosphere];
    const activeBg = autoFitSingleAsset ? preset.studioBg : preset.worldBg;
    const activeFog = autoFitSingleAsset ? 0.016 : preset.fogDensity;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(activeBg);
    scene.fog = new THREE.FogExp2(activeBg, activeFog);

    const rect = mountEl.getBoundingClientRect();
    const initW = Math.max(300, rect.width || 800);
    const initH = Math.max(260, rect.height || 480);

    const camera = new THREE.PerspectiveCamera(autoFitSingleAsset ? 40 : 46, initW / initH, 0.12, 420);
    const defaultPos = model.cameraSettings?.position || [17.5, 11.2, 22.5];
    const defaultTarget = model.cameraSettings?.target || [0, 0.8, 0];
    camera.position.set(defaultPos[0], defaultPos[1], defaultPos[2]);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = preset.exposure;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initW, initH);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Warm key light + sky/earth Hemisphere fill + rim light
    const hemiLight = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(preset.keyColor, preset.keyIntensity);
    keyLight.position.set(22, 32, 18);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.left = -34;
      keyLight.shadow.camera.right = 34;
      keyLight.shadow.camera.top = 34;
      keyLight.shadow.camera.bottom = -34;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 110;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.025;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(preset.rimColor, preset.rimIntensity);
    rimLight.position.set(-18, 14, -22);
    scene.add(rimLight);

    let horizonMesh: THREE.Mesh | null = null;
    if (autoFitSingleAsset) {
      // Studio 360° Museum Pedestal solely for single historical costume / prop inspection
      const stageRadius = 2.15;
      const stageY = -0.06;
      const stageGeo = new THREE.CylinderGeometry(stageRadius, stageRadius + 0.22, 0.12, 48);
      const stageMat = new THREE.MeshStandardMaterial({
        color: 0x24344d,
        roughness: 0.68,
        metalness: 0.18,
      });
      const stageMesh = new THREE.Mesh(stageGeo, stageMat);
      stageMesh.position.y = stageY;
      stageMesh.receiveShadow = !isSoftwareGl;
      scene.add(stageMesh);

      const ringGeo = new THREE.RingGeometry(stageRadius - 0.16, stageRadius + 0.02, 56);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc89b3c,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = stageY + 0.065;
      scene.add(ringMesh);
    } else {
      // Seamless 220m distant horizon ground/sea plane beneath the 64m-68m historical world
      const isMaritimeScene =
        model.slug.includes('bien-dong') || model.slug.includes('dong-nam-a');
      const horizonGeo = new THREE.CircleGeometry(180, 64);
      horizonGeo.rotateX(-Math.PI / 2);
      const horizonMat = new THREE.MeshStandardMaterial({
        color: isMaritimeScene ? 0x0b395c : preset.horizonGround,
        roughness: isMaritimeScene ? 0.28 : 0.92,
        metalness: isMaritimeScene ? 0.24 : 0.03,
      });
      horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
      horizonMesh.position.y = isMaritimeScene ? -0.46 : -1.08;
      horizonMesh.receiveShadow = false;
      scene.add(horizonMesh);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(defaultTarget[0], defaultTarget[1], defaultTarget[2]);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.4;
    controls.maxDistance = 82;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.update();

    const interactableMeshes: THREE.Object3D[] = [];
    const clock = new THREE.Clock();
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let unmounted = false;

    function updateHotspotDomPositions() {
      const layer = hotspotLayerRef.current;
      if (!layer) return;
      const w = mountEl?.clientWidth || initW;
      const h = mountEl?.clientHeight || initH;
      const nodes = layer.querySelectorAll<HTMLElement>('[data-hotspot-idx]');
      nodes.forEach((el) => {
        const idx = Number(el.dataset.hotspotIdx);
        const hs = hotspotsRef.current[idx];
        if (!hs) return;
        _projVec.set(hs.x, hs.y, hs.z).project(camera);
        if (_projVec.z < -1 || _projVec.z > 1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }
        const sx = (_projVec.x * 0.5 + 0.5) * w;
        const sy = (-_projVec.y * 0.5 + 0.5) * h;
        if (sx < -40 || sx > w + 40 || sy < -30 || sy > h + 30) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }
        const halfW = Math.min(120, (el.offsetWidth || 180) * 0.5 + 10);
        const clampedX = Math.max(halfW, Math.min(w - halfW, sx));
        const clampedY = Math.max(52, Math.min(h - 22, sy));
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = `translate3d(${Math.round(clampedX)}px, ${Math.round(clampedY)}px, 0) translate(-50%, -50%)`;
      });
    }

    function afterDraw(cb: () => void) {
      frameId = window.setTimeout(cb, 45);
    }

    function stepScene() {
      const dt = Math.min(clock.getDelta(), 0.05);
      const rt = runtimeRef.current;
      let keepAnimating = false;

      if (rt.transitioning) {
        _camGoal.set(rt.goalPos[0], rt.goalPos[1], rt.goalPos[2]);
        _targetGoal.set(rt.goalTarget[0], rt.goalTarget[1], rt.goalTarget[2]);
        if (isSoftwareGl) {
          camera.position.copy(_camGoal);
          controls.target.copy(_targetGoal);
          rt.transitioning = false;
        } else {
          const alpha = 1 - Math.exp(-5.5 * dt);
          camera.position.lerp(_camGoal, alpha);
          controls.target.lerp(_targetGoal, alpha);
          if (camera.position.distanceToSquared(_camGoal) < 0.01 && controls.target.distanceToSquared(_targetGoal) < 0.01) {
            camera.position.copy(_camGoal);
            controls.target.copy(_targetGoal);
            rt.transitioning = false;
          } else {
            keepAnimating = true;
          }
        }
      }

      if (rt.mixer && rt.isPlaying) {
        rt.mixer.update(dt * rt.speed);
        keepAnimating = true;
      }

      const moved = controls.update();
      if (moved && !isSoftwareGl) {
        keepAnimating = true;
      }

      renderer.render(scene, camera);
      updateHotspotDomPositions();
      return keepAnimating;
    }

    function requestRender() {
      if (unmounted) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (unmounted) return;
        renderDirty = false;
        const shouldContinue = stepScene();
        const done = () => {
          renderBusy = false;
          if (!unmounted && (renderDirty || shouldContinue || runtimeRef.current.isPlaying || runtimeRef.current.transitioning)) {
            requestRender();
          }
        };
        if (isSoftwareGl && (runtimeRef.current.isPlaying || runtimeRef.current.transitioning)) {
          afterDraw(done);
        } else {
          done();
        }
      });
    }

    controls.addEventListener('start', () => {
      runtimeRef.current.transitioning = false;
    });
    controls.addEventListener('change', () => {
      requestRender();
    });

    runtimeRef.current = {
      renderer,
      scene,
      camera,
      controls,
      hemiLight,
      keyLight,
      rimLight,
      horizonMesh,
      mixer: null,
      clips: [],
      activeAction: null,
      transitioning: false,
      goalPos: defaultPos,
      goalTarget: defaultTarget,
      requestRender,
      isPlaying: false,
      speed: 1,
    };

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // Load genuine .glb file via GLTFLoader (with automatic 1x retry on transient network glitch)
    const loader = new GLTFLoader();
    let retriedOnce = false;
    const loadGlbAttempt = (urlToLoad: string) => {
      loader.load(
        urlToLoad,
        (gltf) => {
          if (unmounted) return;
          const root = gltf.scene;
          root.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              mesh.castShadow = !isSoftwareGl;
              mesh.receiveShadow = !isSoftwareGl;
              if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
                mesh.frustumCulled = false;
              }
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              for (const mat of mats) {
                if (!mat) continue;
                const std = mat as THREE.MeshStandardMaterial;
                if (std.map) {
                  std.map.colorSpace = THREE.SRGBColorSpace;
                  std.map.anisotropy = maxAnisotropy;
                  std.map.needsUpdate = true;
                }
                if (std.emissiveMap) {
                  std.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                  std.emissiveMap.anisotropy = maxAnisotropy;
                }
                if ('envMapIntensity' in std) {
                  std.envMapIntensity = 0.82;
                }
              }
              interactableMeshes.push(mesh);
            }
          });

          if (autoFitSingleAsset) {
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const fitScale = 2.55 / maxDim;
            const wrapper = new THREE.Group();
            root.scale.multiplyScalar(fitScale);
            root.position.set(-center.x * fitScale, -box.min.y * fitScale, -center.z * fitScale);
            wrapper.add(root);
            scene.add(wrapper);

            const fitHeight = size.y * fitScale;
            const camPos: [number, number, number] = [2.45, Math.max(1.45, fitHeight * 0.64), 3.65];
            const camTarget: [number, number, number] = [0, Math.max(0.55, fitHeight * 0.48), 0];
            camera.position.set(camPos[0], camPos[1], camPos[2]);
            controls.target.set(camTarget[0], camTarget[1], camTarget[2]);
            controls.minDistance = 1.1;
            controls.maxDistance = 14;
            controls.update();
            runtimeRef.current.goalPos = camPos;
            runtimeRef.current.goalTarget = camTarget;
          } else {
            scene.add(root);
          }

          if (!isSoftwareGl) {
            renderer.compile(scene, camera);
          }

          const clips = gltf.animations || [];
          const clipNames = clips.map((c, idx) => c.name || `Hoat_Anh_${idx + 1}`);
          setAvailableClips(clipNames);

          if (clips.length > 0) {
            const mixer = new THREE.AnimationMixer(root);
            const action = mixer.clipAction(clips[0]);
            action.play();
            runtimeRef.current.mixer = mixer;
            runtimeRef.current.clips = clips;
            runtimeRef.current.activeAction = action;
            setSelectedClip(clipNames[0]);
            const autoPlay = !isSoftwareGl;
            runtimeRef.current.isPlaying = autoPlay;
            setIsPlaying(autoPlay);
          } else {
            setSelectedClip('');
            setIsPlaying(false);
          }

          setWebglStatus('ready');
          requestRender();
        },
        undefined,
        (err) => {
          if (unmounted) return;
          if (!retriedOnce) {
            retriedOnce = true;
            const sep = model.fileUrl.includes('?') ? '&' : '?';
            loadGlbAttempt(`${model.fileUrl}${sep}retry=${Date.now()}`);
            return;
          }
          console.error('GLTFLoader error:', err);
          setErrorMessage('Không thể tải tệp mô hình GLB. Đã kích hoạt Sa bàn Bản đồ Chiến lược 2D trực quan.');
          setWebglStatus('error');
        },
      );
    };
    const initialUrl =
      retryNonce > 0
        ? `${model.fileUrl}${model.fileUrl.includes('?') ? '&' : '?'}reload=${retryNonce}`
        : model.fileUrl;
    loadGlbAttempt(initialUrl);

    // Click raycasting on 3D objects
    const raycaster = new THREE.Raycaster();
    const pointerDownPos = new THREE.Vector2();
    const mouseNdc = new THREE.Vector2();

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos.set(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 6) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      mouseNdc.x = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
      mouseNdc.y = -((e.clientY - bounds.top) / bounds.height) * 2 + 1;

      raycaster.setFromCamera(mouseNdc, camera);
      const hits = raycaster.intersectObjects(interactableMeshes, false);
      if (hits.length > 0) {
        const rawName = hits[0].object.name || 'Chi tiết mô hình lịch sử';
        const readableName = rawName.replace(/_/g, ' ');
        setClickedMeshLabel(readableName);
        callbacksRef.current.onObjectInspected?.(readableName);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const resizeObserver = new ResizeObserver(() => {
      if (!mountEl || unmounted) return;
      const w = Math.max(280, mountEl.clientWidth);
      const h = Math.max(240, mountEl.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(mountEl);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglStatus('error');
      setErrorMessage('Ngữ cảnh đồ họa WebGL tạm gián đoạn trên thiết bị.');
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
      renderer.dispose();
    };
  }, [model.id, model.fileUrl, retryNonce]);

  // Sync play/pause & speed changes without remounting WebGL
  useEffect(() => {
    runtimeRef.current.isPlaying = isPlaying;
    runtimeRef.current.speed = speed;
    if (isPlaying) {
      runtimeRef.current.requestRender();
    }
  }, [isPlaying, speed]);

  // Project 2D hotspot pins immediately once React commits hotspotLayerRef
  useEffect(() => {
    if (webglStatus === 'ready') {
      const id = requestAnimationFrame(() => {
        runtimeRef.current.requestRender();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [webglStatus, showHotspots, currentPhaseKey]);

  // Sync low-power mobile mode
  useEffect(() => {
    const renderer = runtimeRef.current.renderer;
    if (!renderer) return;
    renderer.setPixelRatio(lowPowerMode ? 0.85 : Math.min(window.devicePixelRatio, 2));
    runtimeRef.current.requestRender();
  }, [lowPowerMode]);

  // Sync studio / open-world atmosphere lighting preset without remounting WebGL
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt.scene || !rt.renderer || !rt.hemiLight || !rt.keyLight || !rt.rimLight) return;
    const preset = ATMOSPHERE_PRESETS[atmosphere];
    const activeBg = autoFitSingleAsset ? preset.studioBg : preset.worldBg;
    const activeFog = autoFitSingleAsset ? 0.016 : preset.fogDensity;
    rt.scene.background = new THREE.Color(activeBg);
    rt.scene.fog = new THREE.FogExp2(activeBg, activeFog);
    rt.hemiLight.color.setHex(preset.hemiSky);
    rt.hemiLight.groundColor.setHex(preset.hemiGround);
    rt.hemiLight.intensity = preset.hemiIntensity;
    rt.keyLight.color.setHex(preset.keyColor);
    rt.keyLight.intensity = preset.keyIntensity;
    rt.rimLight.color.setHex(preset.rimColor);
    rt.rimLight.intensity = preset.rimIntensity;
    if (rt.horizonMesh && !model.slug.includes('bien-dong') && !model.slug.includes('dong-nam-a')) {
      (rt.horizonMesh.material as THREE.MeshStandardMaterial).color.setHex(preset.horizonGround);
    }
    rt.renderer.toneMappingExposure = preset.exposure;
    rt.requestRender();
  }, [atmosphere, autoFitSingleAsset, model.slug]);

  // Sync external activePhaseKey changes
  useEffect(() => {
    if (!activePhaseKey) return;
    setInternalPhaseKey(activePhaseKey);
    const phase = model.phases.find((p) => p.key === activePhaseKey);
    if (phase) {
      runtimeRef.current.goalPos = phase.cameraPosition;
      runtimeRef.current.goalTarget = phase.cameraTarget;
      runtimeRef.current.transitioning = true;
      if (phase.animationName && runtimeRef.current.mixer) {
        const clip = runtimeRef.current.clips.find((c) => c.name === phase.animationName);
        if (clip) {
          runtimeRef.current.activeAction?.stop();
          const act = runtimeRef.current.mixer.clipAction(clip);
          act.reset().play();
          runtimeRef.current.activeAction = act;
          setSelectedClip(clip.name);
        }
      }
      runtimeRef.current.requestRender();
    }
  }, [activePhaseKey, model.phases]);

  const handleSelectPhase = (phase: ModelPhase) => {
    setInternalPhaseKey(phase.key);
    setSelectedHotspot(null);
    runtimeRef.current.goalPos = phase.cameraPosition;
    runtimeRef.current.goalTarget = phase.cameraTarget;
    runtimeRef.current.transitioning = true;

    if (phase.animationName && runtimeRef.current.mixer) {
      const clip = runtimeRef.current.clips.find((c) => c.name === phase.animationName);
      if (clip) {
        runtimeRef.current.activeAction?.stop();
        const nextAct = runtimeRef.current.mixer.clipAction(clip);
        nextAct.reset().play();
        runtimeRef.current.activeAction = nextAct;
        setSelectedClip(clip.name);
      }
    }

    onPhaseChange?.(phase);
    runtimeRef.current.requestRender();
  };

  const handleClipChange = (clipName: string) => {
    setSelectedClip(clipName);
    const rt = runtimeRef.current;
    if (!rt.mixer) return;
    const clip = rt.clips.find((c) => c.name === clipName);
    if (!clip) return;
    rt.activeAction?.stop();
    const nextAction = rt.mixer.clipAction(clip);
    nextAction.reset().play();
    rt.activeAction = nextAction;
    setIsPlaying(true);
    rt.isPlaying = true;
    rt.requestRender();
  };

  const handleReplayFromStart = () => {
    const rt = runtimeRef.current;
    if (rt.activeAction && rt.mixer) {
      rt.activeAction.reset().play();
      rt.mixer.update(0);
      setIsPlaying(true);
      rt.isPlaying = true;
      rt.requestRender();
    }
  };

  const handleResetCamera = () => {
    const defaultPos = model.cameraSettings?.position || [17.5, 11.2, 22.5];
    const defaultTarget = model.cameraSettings?.target || [0, 0.8, 0];
    runtimeRef.current.goalPos = defaultPos;
    runtimeRef.current.goalTarget = defaultTarget;
    runtimeRef.current.transitioning = true;
    runtimeRef.current.requestRender();
  };

  const handleOverviewCamera = () => {
    runtimeRef.current.goalPos = [0, 24.5, 34.0];
    runtimeRef.current.goalTarget = [0, 0.6, 0];
    runtimeRef.current.transitioning = true;
    runtimeRef.current.requestRender();
  };

  const handleToggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={wrapperRef}
      data-testid="glb-museum-viewer"
      data-webgl-status={webglStatus}
      className={`flex flex-col w-full ${isFullscreen ? 'h-screen' : ''} bg-[#0B132B] rounded-xl overflow-hidden border border-[#C89B3C]/30 select-none`}
    >
      {/* Unobstructed 3D WebGL Viewport */}
      <div className={`relative w-full ${isFullscreen ? 'flex-1 min-h-0' : heightClass}`}>
        {/* Dedicated isolated WebGL mount container */}
        <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* 2D Projected Hotspot Pins */}
        {showHotspots && webglStatus === 'ready' && (
          <div ref={hotspotLayerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
            {visibleHotspots.map((hs, idx) => (
              <button
                key={hs.id}
                type="button"
                data-hotspot-idx={idx}
                onClick={() => {
                  setSelectedHotspot(hs);
                  onHotspotSelect?.(hs);
                }}
                aria-label={`Điểm chú thích: ${hs.title}`}
                style={{ opacity: 0 }}
                className="absolute top-0 left-0 max-w-[230px] truncate px-2.5 py-1 rounded bg-[#0B132B]/92 text-[#FAF7F0] border border-[#C89B3C] text-xs font-medium shadow-md hover:bg-[#C89B3C] hover:text-[#0B132B] transition-colors whitespace-nowrap"
              >
                <span className="font-mono-num mr-1 text-[#E6BE68]">{idx + 1}.</span>
                {hs.title}
              </button>
            ))}
          </div>
        )}

        {/* Top-Left Minimal Museum Label */}
        <div className="absolute top-2.5 left-2.5 max-w-[72%] pointer-events-none">
          <div className="px-2.5 py-1 rounded bg-[#0B132B]/88 border border-white/15 text-[#FAF7F0]">
            <p className="text-[11px] text-[#E6BE68] font-medium truncate">{model.modelName}</p>
            <p className="text-[10px] text-slate-300 truncate">
              Kéo chuột xoay 360° · Cuộn thu phóng · Nhấn vật thể xem tên
            </p>
          </div>
        </div>

        {/* Selected Hotspot or Clicked 3D Object Callout */}
        {(selectedHotspot || clickedMeshLabel) && (
          <div className="absolute top-2.5 right-2.5 max-w-xs bg-[#0B132B]/95 border border-[#C89B3C]/60 text-[#FAF7F0] rounded-lg p-3 shadow-lg z-20">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-xs font-semibold text-[#E6BE68]">
                {selectedHotspot ? selectedHotspot.title : `Đối tượng 3D: ${clickedMeshLabel}`}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSelectedHotspot(null);
                  setClickedMeshLabel('');
                }}
                aria-label="Đóng chú thích đối tượng"
                className="text-xs text-slate-400 hover:text-white px-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-relaxed">
              {selectedHotspot
                ? selectedHotspot.description
                : 'Chi tiết thuộc mô hình GLB tái hiện phục vụ quan sát trực quan không gian lịch sử. Nhấn vào các nhãn số trên cảnh 3D để đọc tư liệu thẩm định.'}
            </p>
          </div>
        )}

        {/* Top-Right Quick Switch to Illustrated 2D Tactical Map (on 3D Worlds) */}
        {!autoFitSingleAsset && webglStatus === 'ready' && viewMode === '3d' && !(selectedHotspot || clickedMeshLabel) && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <button
              type="button"
              data-testid="toggle-2d-3d-map"
              onClick={() => setViewMode('2d')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B132B]/90 border border-[#C89B3C]/60 text-xs font-semibold text-[#E6BE68] hover:bg-[#C89B3C] hover:text-[#0B132B] transition-colors shadow-md"
            >
              <MapIcon className="w-3.5 h-3.5" /> Sa bàn Bản đồ 2D
            </button>
          </div>
        )}

        {/* Loading State */}
        {webglStatus === 'loading' && viewMode === '3d' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B132B]/90 text-[#FAF7F0] z-20">
            <Sparkles className="w-7 h-7 text-[#C89B3C] mb-2" />
            <p className="text-sm font-medium">Đang nạp mô hình GLB 3D từ máy chủ...</p>
            <p className="text-xs text-slate-400 mt-1">{model.fileUrl}</p>
          </div>
        )}

        {/* Interactive 2D Historical Tactical Map (Voluntary Toggle OR Graceful Fallback) */}
        {(viewMode === '2d' || webglStatus === 'error' || webglStatus === 'unsupported') && (
          <div className="absolute inset-0 z-20">
            <HistoricalTacticalMap2D
              model={model}
              currentPhaseKey={currentPhaseKey}
              selectedHotspot={selectedHotspot}
              fallbackError={webglStatus === 'error' || webglStatus === 'unsupported' ? errorMessage || 'Chế độ Sa bàn 2D' : undefined}
              onSelectPhase={handleSelectPhase}
              onSelectHotspot={(hs) => {
                setSelectedHotspot(hs);
                onHotspotSelect?.(hs);
              }}
              onSwitchTo3D={
                webglStatus === 'ready'
                  ? () => {
                      setViewMode('3d');
                      requestAnimationFrame(() => runtimeRef.current.requestRender());
                    }
                  : undefined
              }
              onRetry3D={
                webglStatus === 'error'
                  ? () => {
                      setViewMode('3d');
                      setRetryNonce((n) => n + 1);
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Dedicated Museum Control Console Below 3D Viewport (Zero 3D Occlusion!) */}
      {webglStatus === 'ready' && (
        <div className="border-t border-[#C89B3C]/25 bg-[#091024] px-3 py-2 text-[#FAF7F0]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-medium text-[#E6BE68]">
              Bảng điều khiển Không gian 3D (.glb) &amp; Sa bàn 2D
            </span>
            <div className="flex items-center gap-1.5">
              {!autoFitSingleAsset && (
                <button
                  type="button"
                  onClick={() => {
                    const next = viewMode === '3d' ? '2d' : '3d';
                    setViewMode(next);
                    if (next === '3d') {
                      requestAnimationFrame(() => runtimeRef.current.requestRender());
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[11px] font-semibold transition-colors ${
                    viewMode === '2d'
                      ? 'bg-[#C89B3C] text-[#0B132B] border-[#C89B3C]'
                      : 'bg-[#162447] text-[#E6BE68] border-[#C89B3C]/40 hover:border-[#C89B3C]'
                  }`}
                >
                  {viewMode === '2d' ? (
                    <>
                      <Box className="w-3.5 h-3.5" /> Mở Đại cảnh 3D (.glb)
                    </>
                  ) : (
                    <>
                      <MapIcon className="w-3.5 h-3.5" /> Sa bàn Bản đồ 2D
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDockCollapsed((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#162447] border border-white/15 text-[11px] font-medium text-slate-200 hover:text-[#E6BE68]"
              >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Mở điều khiển
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Thu gọn điều khiển
                </>
              )}
              </button>
            </div>
          </div>

          {!dockCollapsed && (
            <div className="space-y-2">
              {/* Historical Phases Row */}
              {!compact && model.phases.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-white/10">
                  {model.phases.map((ph) => (
                    <button
                      key={ph.key}
                      type="button"
                      onClick={() => handleSelectPhase(ph)}
                      className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                        currentPhaseKey === ph.key
                          ? 'bg-[#C89B3C] text-[#0B132B] font-semibold'
                          : 'bg-[#162447] text-slate-200 hover:bg-[#1F315C]'
                      }`}
                    >
                      {ph.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Playback & Camera Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {availableClips.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsPlaying((p) => !p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#C89B3C] text-[#0B132B] text-xs font-semibold hover:bg-[#d8ab4c] whitespace-nowrap"
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isPlaying ? 'Tạm dừng' : 'Phát chuyển động'}
                      </button>
                      <button
                        type="button"
                        onClick={handleReplayFromStart}
                        className="px-2.5 py-1.5 rounded bg-[#162447] hover:bg-[#1F315C] text-xs text-slate-200 whitespace-nowrap"
                      >
                        Xem lại từ đầu
                      </button>
                      <label className="inline-flex items-center gap-1 text-xs text-slate-300">
                        <span className="sr-only">Tốc độ hoạt ảnh</span>
                        <select
                          aria-label="Tốc độ chuyển động"
                          value={speed}
                          onChange={(e) => setSpeed(Number(e.target.value))}
                          className="bg-[#162447] border border-white/15 rounded px-2 py-1 text-xs text-white"
                        >
                          <option value={0.5}>0.5x</option>
                          <option value={1}>1.0x</option>
                          <option value={1.5}>1.5x</option>
                        </select>
                      </label>
                      {availableClips.length > 1 && (
                        <select
                          aria-label="Chọn hoạt ảnh GLB"
                          value={selectedClip}
                          onChange={(e) => handleClipChange(e.target.value)}
                          className="bg-[#162447] border border-white/15 rounded px-2 py-1 text-xs text-white max-w-[190px] truncate"
                        >
                          {availableClips.map((c) => (
                            <option key={c} value={c}>
                              {c.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#162447] border border-white/15 text-xs text-slate-200">
                    <SunMedium className="w-3.5 h-3.5 text-[#E6BE68]" />
                    <select
                      aria-label="Chế độ ánh sáng không gian"
                      value={atmosphere}
                      onChange={(e) => setAtmosphere(e.target.value as AtmosphereMode)}
                      className="bg-transparent text-xs text-white focus:outline-none"
                    >
                      {(Object.keys(ATMOSPHERE_PRESETS) as AtmosphereMode[]).map((modeKey) => (
                        <option key={modeKey} value={modeKey} className="bg-[#0B132B] text-white">
                          {ATMOSPHERE_PRESETS[modeKey].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleResetCamera}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#162447] hover:bg-[#1F315C] text-xs text-slate-200 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Đặt lại camera
                  </button>
                  {!autoFitSingleAsset && (
                    <button
                      type="button"
                      onClick={handleOverviewCamera}
                      className="px-2.5 py-1.5 rounded bg-[#162447] hover:bg-[#1F315C] text-xs text-slate-200 whitespace-nowrap"
                    >
                      Xem tổng thể
                    </button>
                  )}
                  {!autoFitSingleAsset && (
                    <button
                      type="button"
                      onClick={() => setShowHotspots((s) => !s)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#162447] hover:bg-[#1F315C] text-xs text-slate-200 whitespace-nowrap"
                    >
                      {showHotspots ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showHotspots ? 'Ẩn chú thích' : 'Hiện chú thích'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLowPowerMode((v) => !v)}
                    className={`px-2.5 py-1.5 rounded text-xs whitespace-nowrap ${
                      lowPowerMode ? 'bg-[#8B1E24] text-white' : 'bg-[#162447] text-slate-200 hover:bg-[#1F315C]'
                    }`}
                  >
                    Đồ họa nhẹ {lowPowerMode ? '(Bật)' : ''}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    aria-label="Phóng to toàn màn hình"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#162447] hover:bg-[#1F315C] text-xs text-slate-200 whitespace-nowrap"
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    Toàn màn hình
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
