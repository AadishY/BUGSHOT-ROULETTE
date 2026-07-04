import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getPreloadedGLB } from './glbPreloader';

type PlayerModelKey = 'DEFAULT' | 'AADISH' | 'ASP' | 'YASH' | 'YUVRAJ';

const SMOOTH_HEAD_MODELS = new Set<PlayerModelKey>(['ASP', 'YUVRAJ', 'AADISH']);

interface PlayerModelConfig {
    path: string;
    scale: number;
    positionOffset: THREE.Vector3;
}

const resolveAssetPath = (assetPath: string) => {
    const normalized = assetPath.replace(/^\/+/, '');
    return `${import.meta.env.BASE_URL}${normalized}`;
};

const PLAYER_MODEL_CONFIGS: Record<PlayerModelKey, PlayerModelConfig> = {
    DEFAULT: {
        path: 'head/dealer.glb',
        scale: 2.2,
        positionOffset: new THREE.Vector3(0, 0.5, -7.03),
    },
    ASP: {
        path: 'head/aspdealer.glb',
        scale: 2.25,
        positionOffset: new THREE.Vector3(0, 3.5, 0.03),  // dealer: -7.4 + 4.5 offset
    },
    YUVRAJ: {
        path: 'head/yuvrajdealer.glb',
        scale: 2,
        positionOffset: new THREE.Vector3(0, 3.5, 0.3),  // dealer: -6.0 + 4.5 offset
    },
    YASH: {
        path: 'head/yashdealer.glb',
        scale: 2.1,
        positionOffset: new THREE.Vector3(0, 3.5, 0.1), // dealer: -7.5 + 4.5 offset
    },
    AADISH: {
        path: 'head/aadishdealer.glb',
        scale: 2.1,
        positionOffset: new THREE.Vector3(0, 3.8, 0.019), // dealer: -5.65 + 4.5 offset
    },
};


const HIDDEN_NAME_FRAGMENTS = new Set([
    'smoke','bg','background','wall','floor','room',
    'collider','bbox','helper','camera','light','lamp',
    'stage','backdrop','env','environment','grid','ground','ceil','ceiling',
    // NOTE: 'plane' intentionally excluded — body mesh nodes are often named Plane001/Plane002
]);

const shouldHideByName = (name: string): boolean => {
    const lower = name.toLowerCase();
    for (const frag of HIDDEN_NAME_FRAGMENTS) {
        if (lower.includes(frag)) return true;
    }
    return false;
};

const setTextureQuality = (texture: THREE.Texture | null | undefined, isColor = false) => {
    if (!texture) return;
    const tex = texture as THREE.Texture & { colorSpace?: THREE.ColorSpace; encoding?: THREE.TextureEncoding };
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
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

// Shared loader removed in favor of glbPreloader caching system

export const createPlayerAvatar = (scene: THREE.Scene, position: THREE.Vector3, rotationY: number, name: string, hp: number = 4, maxHp: number = 4, modelKey: PlayerModelKey = 'DEFAULT') => {
    const avatarGroup = new THREE.Group();
    avatarGroup.name = 'PLAYER_' + name;
    avatarGroup.position.copy(position);

    // Match the dealer-facing orientation used by the singleplayer model.
    // The multiplayer seats pass in a world-space rotation, but the GLB itself
    // needs an extra 180° correction so it faces the table correctly.
    avatarGroup.rotation.y = rotationY + Math.PI;

    const settings = scene.userData.settings || {};
    const ultraPerformance = !!settings.ultraPerformance;
    const balancedPerformance = !!settings.balancedPerformance;
    const lowPerf = ultraPerformance || balancedPerformance;
    const isSmoothHead = SMOOTH_HEAD_MODELS.has(modelKey);
    const config = PLAYER_MODEL_CONFIGS[modelKey] ?? PLAYER_MODEL_CONFIGS.DEFAULT;

    const placeholderGroup = new THREE.Group();
    placeholderGroup.name = 'BODY_PLACEHOLDER';
    avatarGroup.add(placeholderGroup);

    getPreloadedGLB(resolveAssetPath(config.path))
        .then((gltf) => {
            const model = clone(gltf.scene as THREE.Group);
            model.traverse((obj: THREE.Object3D) => {
                if (obj instanceof THREE.Light || obj instanceof THREE.Camera || (obj as any).isHelper) {
                    obj.visible = false;
                    if ('intensity' in obj) (obj as any).intensity = 0;
                    return;
                }

                if (shouldHideByName(obj.name)) {
                    obj.visible = false;
                    return;
                }

                // Only hide obviously background-like meshes. The default dealer model
                // can have a large body mesh, so keep the threshold high enough to avoid
                // hiding the main head geometry.
                if (obj instanceof THREE.Mesh && obj.geometry) {
                    try {
                        const bbox = new THREE.Box3().setFromObject(obj);
                        const size = new THREE.Vector3();
                        bbox.getSize(size);
                        const isVeryLarge = size.x > 16 || size.y > 16 || size.z > 16;
                        const isFlatPlane = (size.x > 12 && size.y < 1.5) || (size.z > 12 && size.y < 1.5);
                        if ((isVeryLarge || isFlatPlane) && /bg|background|wall|floor|room|stage|backdrop|env|environment|plane/i.test(obj.name)) {
                            console.warn(`[GLB-HIDE] Player GLB "${config.path}" hiding mesh`, obj.name || '(unnamed)', `size=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`);
                            obj.visible = false;
                            return;
                        }
                    } catch (e) {
                        // ignore errors computing bounds
                    }
                }

                if (obj instanceof THREE.Mesh) {
                    obj.castShadow = !lowPerf;
                    obj.receiveShadow = false;

                    if (obj.material) {
                        const mats: THREE.Material[] = Array.isArray(obj.material)
                            ? obj.material
                            : [obj.material];

                        for (const mat of mats) {
                            const m = mat as THREE.MeshStandardMaterial;

                            setTextureQuality(m.map, true);
                            setTextureQuality(m.normalMap, false);
                            setTextureQuality(m.roughnessMap, false);
                            setTextureQuality((m as any).aoMap, false);
                            setTextureQuality((m as any).emissiveMap, true);
                            setTextureQuality((m as any).metalnessMap, false);
                            setTextureQuality((m as any).bumpMap, false);
                            setTextureQuality((m as any).displacementMap, false);

                            if (m.transparent || m.opacity < 0.9) {
                                m.depthWrite = false;
                            }

                            if (m instanceof THREE.MeshStandardMaterial) {
                                m.roughness = m.roughnessMap ? Math.min(m.roughness, 0.68) : 0.58;
                                m.metalness = 0.0;
                                m.envMapIntensity = lowPerf ? 0.45 : 1.4;
                                if (m.emissive) m.emissive.setHex(0x120a08); // subtle warm lift
                                m.emissiveIntensity = 0.22;
                                m.fog = false;
                                if (m.color) {
                                    m.color.setHex(0xffffff);
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

            // Name the loaded player model 'HEAD' so the shared name-tag
            // projection logic can find it (ThreeScene expects a 'HEAD' node).
            model.name = 'HEAD';
            model.scale.setScalar(config.scale);

            // Match the dealer path: position the model from its bounding box and
            // leave its authored orientation intact. The parent avatar group handles
            // the seat-facing rotation.
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.set(-center.x + config.positionOffset.x, -box.min.y + config.positionOffset.y, -center.z + config.positionOffset.z);
            model.updateMatrixWorld(true);

            avatarGroup.remove(placeholderGroup);
            avatarGroup.add(model);
        })
        .catch((error) => {
            console.warn(`[PlayerAvatar] Failed to load GLB "${config.path}":`, error);
        });

    // === HEALTH BAR REMOVED AT USER REQUEST ===
    /*
    const hpGroup = new THREE.Group();
    hpGroup.position.set(0, 10.5, 0);

    const hpBgGeo = new THREE.PlaneGeometry(4, 0.5);
    const hpBg = new THREE.Mesh(hpBgGeo, new THREE.MeshBasicMaterial({ color: 0x331111, side: THREE.DoubleSide }));
    hpGroup.add(hpBg);

    const hpWidth = (hp / maxHp) * 3.8;
    const hpFillGeo = new THREE.PlaneGeometry(hpWidth, 0.4);
    const hpFill = new THREE.Mesh(hpFillGeo, new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
    hpFill.position.x = (hpWidth - 3.8) / 2;
    hpFill.position.z = 0.01;
    hpGroup.add(hpFill);

    avatarGroup.add(hpGroup);
    avatarGroup.userData.hpGroup = hpGroup;
    avatarGroup.userData.hpFill = hpFill;
    avatarGroup.userData.maxHp = maxHp;
    */

    // === NAME TAG ===
    // Removed 3D name tag to use clean, crisp native HTML name tag overlay.

    // === CHAT BUBBLE ===
    const chatGroup = new THREE.Group();
    chatGroup.position.set(0, 13, 0);
    avatarGroup.add(chatGroup);
    avatarGroup.userData.chatGroup = chatGroup;
    avatarGroup.userData.playerName = name;

    scene.add(avatarGroup);
    return avatarGroup;
};

// Helper to update player health bar
export const updatePlayerHealth = (avatarGroup: THREE.Group, hp: number) => {
    const hpFill = avatarGroup.userData.hpFill as THREE.Mesh;
    const maxHp = avatarGroup.userData.maxHp || 4;
    if (hpFill) {
        const hpWidth = Math.max(0.1, (hp / maxHp) * 3.8);
        hpFill.scale.x = hp / maxHp;
        hpFill.position.x = (hpWidth - 3.8) / 2;
    }
};

// Helper to show chat bubble
export const showChatBubble = (avatarGroup: THREE.Group, message: string) => {
    const chatGroup = avatarGroup.userData.chatGroup as THREE.Group;
    if (!chatGroup) return;

    // Clear existing
    while (chatGroup.children.length) chatGroup.remove(chatGroup.children[0]);

    // Create bubble
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 512, 100, 20);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxLen = 30;
        const text = message.length > maxLen ? message.substring(0, maxLen) + '...' : message;
        ctx.fillText(text, 256, 50);
    }
    const bubbleTex = new THREE.CanvasTexture(canvas);
    const bubbleSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true }));
    bubbleSprite.scale.set(6, 1.5, 1);
    chatGroup.add(bubbleSprite);

    // Auto-remove after delay
    setTimeout(() => {
        if (chatGroup.children.length) chatGroup.remove(bubbleSprite);
    }, 4000);
};
