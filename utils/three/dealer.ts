import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getPreloadedGLB } from './glbPreloader';

type DebugHeadModel = 'DEFAULT' | 'YASH' | 'YUVRAJ' | 'ASP' | 'AADISH';

const SMOOTH_HEAD_MODELS = new Set<DebugHeadModel>(['ASP', 'YUVRAJ', 'AADISH']);

// ---------------------------------------------------------------------------
// Per-model configuration — adjust scale/position here for each GLB
// ---------------------------------------------------------------------------

interface ModelConfig {
    path: string;
    scale: number;                 // overall scale multiplier
    positionOffset: THREE.Vector3; // applied after bounding-box centering
}

const resolveAssetPath = (assetPath: string) => {
    const normalized = assetPath.replace(/^\/+/, '');
    return `${import.meta.env.BASE_URL}${normalized}`;
};

const MODEL_CONFIGS: Record<DebugHeadModel, ModelConfig> = {
    DEFAULT: {
        path: 'head/dealer.glb',
        scale: 2.4,
        positionOffset: new THREE.Vector3(0, -5., -24.50),
    },
    ASP: {
        path: 'head/aspdealer.glb',
        scale: 2.5 ,
        positionOffset: new THREE.Vector3(0, -2.8, -17.50),
    },
    YUVRAJ: {
        path: 'head/yuvrajdealer.glb',
        scale: 2.4,
        positionOffset: new THREE.Vector3(0, -2.8, -16.9),
    },
    YASH: {
        path: 'head/yashdealer.glb',
        scale: 2.4,
        positionOffset: new THREE.Vector3(0, -2.8, -17.83),
    },
    AADISH: {
        path: 'head/aadishdealer.glb',
        scale: 2.5 ,
        positionOffset: new THREE.Vector3(0, -2.8, -17.70),
    },
};

// ---------------------------------------------------------------------------
// Shared singleton loader — avoids re-allocating GLTFLoader on every call
// ---------------------------------------------------------------------------
// Shared loader removed in favor of glbPreloader caching system

// ---------------------------------------------------------------------------
// Shared smoke canvas texture — generated once, reused across all sprites
// ---------------------------------------------------------------------------
let _sharedSmokeTex: THREE.CanvasTexture | null = null;
const getSmokeTex = (): THREE.CanvasTexture | null => {
    if (_sharedSmokeTex) return _sharedSmokeTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    _sharedSmokeTex = new THREE.CanvasTexture(canvas);
    return _sharedSmokeTex;
};

// ---------------------------------------------------------------------------
// O(1) mesh-name filter using a Set instead of chained .includes() calls
// ---------------------------------------------------------------------------
const HIDDEN_NAME_FRAGMENTS = new Set([
    'smoke','bg','background','wall','floor','room',
    'collider','bbox','helper','camera','light','lamp',
    'stage','backdrop','env','environment','grid','ground',
    'ceil','ceiling',
]);

const shouldHideByName = (name: string): boolean => {
    const lower = name.toLowerCase();
    for (const frag of HIDDEN_NAME_FRAGMENTS) {
        if (lower.includes(frag)) return true;
    }
    return false;
};

const setTextureQuality = (texture: THREE.Texture | null | undefined, isColor = false, useNearest = false) => {
    if (!texture) return;
    const tex = texture as THREE.Texture & { colorSpace?: THREE.ColorSpace; encoding?: THREE.TextureEncoding };
    tex.minFilter = useNearest ? THREE.NearestFilter : THREE.LinearMipMapLinearFilter;
    tex.magFilter = useNearest ? THREE.NearestFilter : THREE.LinearFilter;
    tex.generateMipmaps = !useNearest;
    tex.anisotropy = Math.max(tex.anisotropy || 1, 8);
    tex.needsUpdate = true;
    const texAny = tex as any;
    if (isColor) {
        if ('colorSpace' in tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
        } else {
            texAny.encoding = THREE.sRGBEncoding;
        }
    } else {
        if ('colorSpace' in tex) {
            tex.colorSpace = THREE.LinearSRGBColorSpace;
        } else {
            texAny.encoding = THREE.LinearEncoding;
        }
    }
};

const configureDealerMaterialEffects = (material: THREE.MeshStandardMaterial, options: { pixelate?: boolean; blur?: boolean; } = {}) => {
    if ((material as any).userData?.__dealerMaterialEffects) return;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.dealerBlurStrength = { value: options.blur ? 0.12 : 0.0 };
        shader.uniforms.pixelationSteps = { value: options.pixelate ? 22.0 : 1.0 };
        shader.uniforms.pixelationAmount = { value: options.pixelate ? 0.18 : 0.0 };
        shader.fragmentShader = `uniform float dealerBlurStrength;\nuniform float pixelationSteps;\nuniform float pixelationAmount;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <output_fragment>',
            `
    vec3 blurredLight = outgoingLight;
    #ifdef USE_MAP
        vec3 mapBlur = texture2D(map, vUv).rgb;
        mapBlur += texture2D(map, vUv + vec2(0.002, 0.0)).rgb;
        mapBlur += texture2D(map, vUv + vec2(-0.002, 0.0)).rgb;
        mapBlur += texture2D(map, vUv + vec2(0.0, 0.002)).rgb;
        mapBlur += texture2D(map, vUv + vec2(0.0, -0.002)).rgb;
        blurredLight = mapBlur * 0.2;
    #endif
    if (dealerBlurStrength > 0.0) {
        outgoingLight = mix(outgoingLight, blurredLight, dealerBlurStrength);
    }
    if (pixelationAmount > 0.0) {
        vec3 pixelated = floor(outgoingLight * pixelationSteps) / pixelationSteps;
        outgoingLight = mix(outgoingLight, pixelated, pixelationAmount);
    }
    #include <output_fragment>`
        );
    };
    material.userData = material.userData || {};
    material.userData.__dealerMaterialEffects = true;
};

// ---------------------------------------------------------------------------
// Main export
// By default 'DEFAULT' (dealer.glb) is used.
// Pass a different DebugHeadModel via the debug settings to switch models.
// ---------------------------------------------------------------------------
export const createDealerModel = (scene: THREE.Scene, debugHeadModel: DebugHeadModel = 'DEFAULT') => {
    // Check if dealer already exists
    const existingDealer = scene.getObjectByName('DEALER');
    if (existingDealer) return existingDealer as THREE.Group;

    const dealerGroup = new THREE.Group();
    dealerGroup.name = 'DEALER';

    const settings = scene.userData.settings || {};
    const ultraPerformance = !!settings.ultraPerformance;
    const balancedPerformance = !!settings.balancedPerformance;
    const lowPerf = ultraPerformance || balancedPerformance;
    const isCustomModel = debugHeadModel !== 'DEFAULT';
    const isSmoothHead = SMOOTH_HEAD_MODELS.has(debugHeadModel);

    // Resolve per-model config (fallback to DEFAULT if key is unknown)
    const config: ModelConfig = MODEL_CONFIGS[debugHeadModel] ?? MODEL_CONFIGS.DEFAULT;

    // Placeholder so look-at code never crashes before load completes
    const dummyHead = new THREE.Group();
    dummyHead.name = 'HEAD';
    dealerGroup.add(dummyHead);

    // Load the selected GLB from cache asynchronously
    getPreloadedGLB(resolveAssetPath(config.path))
        .then((gltf) => {
            const model = clone(gltf.scene) as THREE.Group;

            dealerGroup.remove(dummyHead);

            model.traverse((obj: THREE.Object3D) => {
                // Suppress embedded lights / cameras / helpers
                if (obj instanceof THREE.Light || obj instanceof THREE.Camera || (obj as any).isHelper) {
                    obj.visible = false;
                    if ('intensity' in obj) (obj as any).intensity = 0;
                    return;
                }

                if (shouldHideByName(obj.name)) {
                    obj.visible = false;
                    return;
                }

                // Only hide clearly background-like meshes. The dealer body can be
                // large, so keep the threshold high enough to avoid removing the main model.
                if (obj instanceof THREE.Mesh && obj.geometry) {
                    try {
                        const bbox = new THREE.Box3().setFromObject(obj);
                        const size = new THREE.Vector3();
                        bbox.getSize(size);
                        const isVeryLarge = size.x > 16 || size.y > 16 || size.z > 16;
                        const isFlatPlane = (size.x > 12 && size.y < 1.5) || (size.z > 12 && size.y < 1.5);
                        if ((isVeryLarge || isFlatPlane) && /bg|background|wall|floor|room|stage|backdrop|env|environment|plane/i.test(obj.name)) {
                            console.warn(`[GLB-HIDE] Dealer GLB "${config.path}" hiding mesh`, obj.name || '(unnamed)', `size=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`);
                            obj.visible = false;
                            return;
                        }
                    } catch (e) {
                        // If bounding calc fails, continue without hiding
                    }
                }

                if (obj instanceof THREE.Mesh) {
                    // Shadows disabled in low-perf modes; dealer never needs receiveShadow
                    obj.castShadow = !lowPerf;
                    obj.receiveShadow = false;

                    if (obj.material) {
                        const mats: THREE.Material[] = Array.isArray(obj.material)
                            ? obj.material
                            : [obj.material];

                        for (const mat of mats) {
                            const m = mat as THREE.MeshStandardMaterial;
                            const isDefaultHead = !isCustomModel;

                            // Keep default dealer head textures smooth here; the small pixelation
                            // effect is implemented in the material shader instead of using nearest filtering.
                            setTextureQuality(m.map, true, false);
                            setTextureQuality(m.normalMap, false, false);
                            setTextureQuality(m.roughnessMap, false, false);
                            setTextureQuality((m as any).aoMap, false, false);
                            setTextureQuality((m as any).emissiveMap, true, false);
                            setTextureQuality((m as any).metalnessMap, false, false);
                            setTextureQuality((m as any).bumpMap, false, false);
                            setTextureQuality((m as any).displacementMap, false, false);

                            if (m.transparent || m.opacity < 0.9) {
                                m.depthWrite = false;
                            }

                            if (m instanceof THREE.MeshStandardMaterial) {
                                // Apply the same quality tuning to default and custom heads.
                                m.roughness = m.roughnessMap ? Math.min(m.roughness, 0.72) : 0.62;
                                m.metalness = 0.0;
                                m.envMapIntensity = lowPerf ? 0.35 : 1.1;
                                if (m.emissive) m.emissive.setHex(0x0a0704);
                                m.emissiveIntensity = 0.18;
                                m.fog = false;
                                if (m.color) {
                                    m.color.setHex(0xffffff);
                                }
                                if (isDefaultHead) {
                                    configureDealerMaterialEffects(m, { pixelate: true, blur: true });
                                }

                                if (ultraPerformance) {
                                    m.normalMap = null;
                                    m.bumpMap = null;
                                    m.roughnessMap = null;
                                    m.metalnessMap = null;
                                    m.aoMap = null;
                                    m.lightMap = null;
                                    m.emissiveMap = null;
                                } else if (balancedPerformance) {
                                    m.normalMap = null;
                                    m.bumpMap = null;
                                }

                                m.needsUpdate = true;
                            }
                        }
                    }
                }
            });

            // Name as HEAD so look-at animations target it
            model.name = 'HEAD';
            dealerGroup.add(model);

            // Bust the stale HEAD cache — sceneLogic caches dealerGroup.getObjectByName('HEAD')
            // on the first frame, which at that point is still the dummy placeholder. Clearing it
            // here forces a fresh lookup now that the real model is in the scene.
            delete scene.userData.cachedHeadGroup;

            // Face lighting rig — differs by model type
            if (isCustomModel) {
                // 3-point lighting rig tuned for ACESFilmic @ ~1.8x exposure
                // Warm key light from upper-left — main skin illumination
                const keyLight = new THREE.PointLight(0xfff5e0, lowPerf ? 1.2 : 3.2, 10);
                keyLight.position.set(-1.2, 3.2, 2.2);
                keyLight.name = 'KEY_LIGHT';
                model.add(keyLight);

                // Cool blue-grey fill from the right — opens shadows without flattening
                const fillLight = new THREE.PointLight(0xc8d8ff, lowPerf ? 0.4 : 0.9, 9);
                fillLight.position.set(1.8, 1.5, 1.6);
                fillLight.name = 'FILL_LIGHT';
                model.add(fillLight);

                // Under-chin warm fill — eliminates harsh dark jaw shadow at camera angle
                const chinLight = new THREE.PointLight(0xffeedd, lowPerf ? 0.2 : 0.5, 5);
                chinLight.position.set(0, 0.2, 2.5);
                chinLight.name = 'CHIN_LIGHT';
                model.add(chinLight);

                // Warm rim from behind — edge separation on hair / shoulders
                if (!lowPerf) {
                    const rimLight = new THREE.PointLight(0xffe8b0, 0.8, 7);
                    rimLight.position.set(0, 2.5, -2.5);
                    rimLight.name = 'RIM_LIGHT';
                    model.add(rimLight);
                }
            } else {
                // Default dealer: original pulsed red face light
                const faceLight = new THREE.PointLight(0xff0000, lowPerf ? 0 : 2.0, 5);
                faceLight.position.set(0, 2.2, 1.25);
                faceLight.name = 'FACE_LIGHT';
                model.add(faceLight);
            }

            // Apply per-model scale.
            model.scale.setScalar(config.scale);

            // Center the GLB using its bounding box so the dealer stays visible in the scene.
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.x = -center.x + config.positionOffset.x;
            model.position.y = -box.min.y + config.positionOffset.y;
            model.position.z = -center.z + config.positionOffset.z;

            // Keep the loaded model fully visible by avoiding any large group-level offset.
            dealerGroup.position.set(0, 0, 0);
        })
        .catch((error) => {
            console.warn(`[Dealer] Failed to load GLB "${config.path}":`, error);
        });

    // Group-level transform (identical for all models)
    dealerGroup.position.set(0, 3.0, -8);
    dealerGroup.scale.set(0.9, 0.9, 0.9);

    // ---------------------------------------------------------------------------
    // Atmospheric smoke sprites
    // Skipped entirely in ultra-performance; reduced count in balanced mode
    // ---------------------------------------------------------------------------
    if (!ultraPerformance) {
        const smokeTex = getSmokeTex();

        const createHandSprite = (): THREE.Sprite => {
            const mat = new THREE.SpriteMaterial({
                map: smokeTex || undefined,
                color: 0x030303,
                transparent: true,
                // Non-default heads: fully transparent hand smoke — no dark blobs over skin
                opacity: isCustomModel ? 0 : 0,
                blending: THREE.NormalBlending,
                depthWrite: false,
            });
            const spr = new THREE.Sprite(mat);
            spr.scale.set(2.4, 1.8, 1);
            return spr;
        };

        const smokeCount = balancedPerformance ? 2 : 4; // fewer sprites in balanced mode

        // Left hand area
        for (let i = 0; i < smokeCount; i++) {
            const spr = createHandSprite();
            spr.position.set(
                -3.5 + (Math.random() - 0.5) * 1.5,
                -4.15 + 0.1 + (Math.random() - 0.5) * 0.3,
                2.7 + (Math.random() - 0.5) * 1.8
            );
            spr.scale.setScalar(2.0 + Math.random() * 0.8);
            dealerGroup.add(spr);
        }

        // Right hand area
        for (let i = 0; i < smokeCount; i++) {
            const spr = createHandSprite();
            spr.position.set(
                3.5 + (Math.random() - 0.5) * 1.5,
                -4.15 + 0.1 + (Math.random() - 0.5) * 0.3,
                2.7 + (Math.random() - 0.5) * 1.8
            );
            spr.scale.setScalar(2.0 + Math.random() * 0.8);
            dealerGroup.add(spr);
        }

        // Torso fog — only in full-quality mode AND only for the default dealer model
        // Non-default heads: skip entirely — dark fog sprites grey out realistic skin tone
        // if (!balancedPerformance && !isCustomModel) {
        //     const dealerFogGroup = new THREE.Group();
        //     dealerFogGroup.name = 'DEALER_TORSO_FOG';
        //
        //     const createFogSprite = (): THREE.Sprite => {
        //         const mat = new THREE.SpriteMaterial({
        //             map: smokeTex || undefined,
        //             color: 0x010101,
        //             transparent: true,
        //             opacity: 0.14,
        //             blending: THREE.NormalBlending,
        //             depthWrite: false,
        //         });
        //         const spr = new THREE.Sprite(mat);
        //         spr.scale.set(7.0, 5.5, 1.0);
        //         return spr;
        //     };
        //
        //     for (let i = 0; i < 6; i++) {
        //         const spr = createFogSprite();
        //         spr.position.set(
        //             (Math.random() - 0.5) * 6.5,
        //             -2.5 + (Math.random() - 0.5) * 3.5,
        //             -2.0 + (Math.random() - 0.5) * 3.5
        //         );
        //         spr.scale.setScalar(5.5 + Math.random() * 2.5);
        //         dealerFogGroup.add(spr);
        //     }
        //     dealerGroup.add(dealerFogGroup);
        // }
    }

    scene.add(dealerGroup);
    return dealerGroup;
};
