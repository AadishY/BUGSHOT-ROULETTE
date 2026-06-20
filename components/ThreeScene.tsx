import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraView, TurnOwner, AimTarget, AnimationState, GameSettings, SceneContext, PlayerState, GameState } from '../types';

import { updateScene } from '../utils/sceneLogic';
import { initThreeScene, cleanScene } from '../utils/three/sceneSetup';

interface ThreeSceneProps {
    isSawed: boolean;
    isChokeActive?: boolean;
    isPlayerCuffed?: boolean;
    onGunClick: () => void;
    aimTarget: AimTarget;
    cameraView: CameraView;
    animState: AnimationState;
    turnOwner: TurnOwner;
    settings: GameSettings;
    knownShell?: any;
    isHardMode?: boolean;
    player: PlayerState;
    dealer: PlayerState;
    gameState: GameState;
    onCardClick?: (index: number) => void;
}

const calculatePixelScale = (settings: GameSettings, width: number) => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isTabletUA = /ipad|tablet|playbook|silk/i.test(ua) || (ua.includes('macintosh') && 'ontouchend' in document);
    const pixelRatio = window.devicePixelRatio || 1;
    const isAndroid = ua.includes('android');

    let isMob = false;
    let isTab = false;

    if (isTabletUA || (width >= 768 && width <= 1024 && ('ontouchstart' in window || navigator.maxTouchPoints > 0))) {
        isTab = true;
    } else if (isMobileUA || (width < 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0))) {
        isMob = true;
    }

    const isLowEndDevice = (isMob && (isAndroid || pixelRatio < 2 || navigator.hardwareConcurrency < 6)) || !!settings.ultraPerformance || !!settings.balancedPerformance;

    let mobilePixelScale = 2;
    if (isMob) {
        mobilePixelScale = settings.ultraPerformance ? 5.5 : (settings.balancedPerformance ? 4.5 : (isLowEndDevice ? 4.5 : 3.5));
    } else if (isTab) {
        mobilePixelScale = settings.ultraPerformance ? 4.0 : (settings.balancedPerformance ? 3.0 : 2.2);
    }

    return (isMob || isTab) ? mobilePixelScale : (settings.ultraPerformance ? 5.0 : (settings.balancedPerformance ? 4.0 : (settings.pixelScale || 3)));
};

const syncResolution = (container: HTMLDivElement, sceneContext: SceneContext, settings: GameSettings) => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const scene = sceneContext.scene;
    const renderer = sceneContext.renderer;
    const camera = sceneContext.camera;

    // Save settings back to scene userData so they are readable in updates
    scene.userData.settings = settings;

    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua) || width < 900;
    const isTablet = /ipad|tablet|playbook|silk/i.test(ua) || (ua.includes('macintosh') && 'ontouchend' in document);

    const pxScale = calculatePixelScale(settings, width);
    const maxPixelRatio = (isMobile || settings.ultraPerformance) ? 1.0 : (isTablet ? 1.2 : Math.min(window.devicePixelRatio, 2));
    renderer.setPixelRatio(maxPixelRatio);
    renderer.setSize(width / pxScale, height / pxScale, false);
    renderer.domElement.style.imageRendering = 'pixelated';

    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
};

export const ThreeScene: React.FC<ThreeSceneProps> = ({
    isSawed,
    isChokeActive,
    isPlayerCuffed,
    onGunClick,
    aimTarget,
    cameraView,
    animState,
    turnOwner,
    settings,
    knownShell,
    isHardMode,
    player,
    dealer,
    gameState,
    onCardClick
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const propsRef = useRef({
        isSawed,
        isChokeActive,
        isPlayerCuffed,
        aimTarget,
        cameraView,
        animState,
        turnOwner,
        settings,
        knownShell,
        isHardMode: isHardMode || false,
        player,
        dealer,
        gameState,
        onCardClick,
        onGunClick
    });

    useEffect(() => {
        propsRef.current = {
            isSawed,
            isChokeActive,
            isPlayerCuffed,
            aimTarget,
            cameraView,
            animState,
            turnOwner,
            settings,
            knownShell,
            isHardMode: isHardMode || false,
            player,
            dealer,
            gameState,
            onCardClick,
            onGunClick
        };
    }, [isSawed, isChokeActive, isPlayerCuffed, aimTarget, cameraView, animState, turnOwner, settings, knownShell, isHardMode, player, dealer, gameState, onCardClick, onGunClick]);

    const sceneRef = useRef<SceneContext | null>(null);



    useEffect(() => {
        if (!containerRef.current) return;

        const initThree = () => {
            if (!containerRef.current) return;

            if (sceneRef.current) {
                // Proper cleanup
                cleanScene(sceneRef.current.scene);
                sceneRef.current.renderer.dispose();
                if (containerRef.current.contains(sceneRef.current.renderer.domElement)) {
                    containerRef.current.removeChild(sceneRef.current.renderer.domElement);
                }
            }

            const context = initThreeScene(containerRef.current, propsRef.current);
            if (context) {
                sceneRef.current = context;
                updateCameraResponsive();

                // Warm up all shaders dynamically to prevent freezes when items/gun/effects first appear
                try {
                    const renderer = context.renderer;
                    const scene = context.scene;
                    const camera = context.camera;

                    const invisibleObjects: THREE.Object3D[] = [];
                    scene.traverse((obj) => {
                        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Group) {
                            if (!obj.visible) {
                                obj.visible = true;
                                invisibleObjects.push(obj);
                            }
                        }
                    });

                    // Force compilation of all WebGL programs in the scene graph
                    renderer.compile(scene, camera);

                    // Restore initial visibility state
                    invisibleObjects.forEach((obj) => {
                        obj.visible = false;
                    });
                } catch (e) {
                    console.error("WebGL Warmup Error:", e);
                }
            }
        };

        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 900;
        const isAndroid = userAgent.includes('android');

        let frameId = 0;
        let time = 0;
        let lastTime = performance.now();
        const isLowEndMobile = isMobile && (isAndroid || window.devicePixelRatio < 2);
        const targetFPS = isLowEndMobile ? 30 : 60; // Unlock 60FPS for high-end mobile
        const frameInterval = 1000 / targetFPS;
        let lastFrameTime = performance.now();
        let isTabVisible = true;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                isTabVisible = false;
            } else {
                isTabVisible = true;
                lastTime = performance.now();
                lastFrameTime = performance.now();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const animate = (currentTime: number = performance.now()) => {
            frameId = requestAnimationFrame(animate);
            if (!sceneRef.current) return;
            if (!isTabVisible) {
                lastTime = currentTime; lastFrameTime = currentTime; return;
            }

            // Frame Limiting Logic (Only strictly enforce on low-end to save battery/thermal)
            if (isLowEndMobile) {
                const elapsed = currentTime - lastFrameTime;
                if (elapsed < frameInterval) return;
                lastFrameTime = currentTime - (elapsed % frameInterval);
            } else {
                lastFrameTime = currentTime;
            }

            const rawDelta = (currentTime - lastTime) / 1000;
            // Cap delta to prevent huge jumps and negative values
            const delta = Math.max(0.0, Math.min(rawDelta, 0.1));
            lastTime = currentTime;

            time += delta;

            updateScene(sceneRef.current, propsRef.current, time, delta);
        };

        const updateCameraResponsive = () => {
            if (!containerRef.current || !sceneRef.current) return;
            syncResolution(containerRef.current, sceneRef.current, propsRef.current.settings);
        };

        // Initialize immediately if possible to avoid flash
        if (containerRef.current && containerRef.current.clientWidth > 0) {
            initThree();
            animate();
        } else {
            // Fallback for edge cases
            const checkInterval = setInterval(() => {
                if (containerRef.current && containerRef.current.clientWidth > 0) {
                    initThree();
                    animate();
                    clearInterval(checkInterval);
                }
            }, 16);
            return () => clearInterval(checkInterval);
        }

        const resizeObserver = new ResizeObserver(() => {
            if (sceneRef.current) {
                updateCameraResponsive();
            } else if (containerRef.current && containerRef.current.clientWidth > 0) {
                initThree();
                animate();
            }
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);

        // INPUT HANDLING - Prevent Double Firing
        let isTouchInteraction = false;

        const updateHoverIndex = () => {
            if (!sceneRef.current) return;
            const currentGameState = propsRef.current.gameState;
            if (currentGameState.phase === 'CARD_SELECT' && currentGameState.turnOwner === 'PLAYER' && currentGameState.selectedCardIndex === null) {
                if (sceneRef.current.itemDeckCards) {
                    sceneRef.current.raycaster.setFromCamera(sceneRef.current.mouse, sceneRef.current.camera);
                    const intersects = sceneRef.current.raycaster.intersectObjects(sceneRef.current.itemDeckCards, true);
                    let hoveredIdx: number | null = null;
                    if (intersects.length > 0) {
                        let parentGroup: THREE.Object3D | null = intersects[0].object;
                        while (parentGroup && !parentGroup.name.startsWith('ITEM_DECK_CARD_')) {
                            parentGroup = parentGroup.parent;
                        }
                        if (parentGroup) {
                            hoveredIdx = sceneRef.current.itemDeckCards.indexOf(parentGroup as THREE.Group);
                        }
                    }
                    sceneRef.current.scene.userData.hoveredCardIndex = hoveredIdx;
                }
            } else {
                if (sceneRef.current.scene?.userData) {
                    sceneRef.current.scene.userData.hoveredCardIndex = null;
                }
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current || !sceneRef.current || isTouchInteraction) return;
            const rect = containerRef.current.getBoundingClientRect();
            sceneRef.current.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            sceneRef.current.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            updateHoverIndex();
        };

        const handleClick = (e?: MouseEvent | TouchEvent) => {
            if (!sceneRef.current) return;

            const currentProps = propsRef.current;
            const currentGameState = currentProps.gameState;

            if (currentGameState.phase === 'CARD_SELECT' && currentGameState.turnOwner === 'PLAYER' && currentGameState.selectedCardIndex === null) {
                if (sceneRef.current.itemDeckCards) {
                    sceneRef.current.raycaster.setFromCamera(sceneRef.current.mouse, sceneRef.current.camera);
                    const intersects = sceneRef.current.raycaster.intersectObjects(sceneRef.current.itemDeckCards, true);
                    if (intersects.length > 0) {
                        let parentGroup: THREE.Object3D | null = intersects[0].object;
                        while (parentGroup && !parentGroup.name.startsWith('ITEM_DECK_CARD_')) {
                            parentGroup = parentGroup.parent;
                        }
                        if (parentGroup) {
                            const idx = sceneRef.current.itemDeckCards.indexOf(parentGroup as THREE.Group);
                            if (idx !== -1 && currentProps.onCardClick) {
                                currentProps.onCardClick(idx);
                            }
                        }
                    }
                }
                return;
            }

            // Raycast from current mouse pos
            sceneRef.current.raycaster.setFromCamera(sceneRef.current.mouse, sceneRef.current.camera);
            const intersects = sceneRef.current.raycaster.intersectObjects(sceneRef.current.gunGroup.children);
            if (intersects.find(i => i.object.userData.type === 'GUN') && currentProps.onGunClick) {
                currentProps.onGunClick();
            }
        };

        const handleTouchStart = (e: TouchEvent) => {
            isTouchInteraction = true; // Flag to ignore mouse events for a bit
            if (!containerRef.current || !sceneRef.current || e.changedTouches.length === 0) return;
            const touch = e.changedTouches[0];
            const rect = containerRef.current.getBoundingClientRect();
            sceneRef.current.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
            sceneRef.current.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
            updateHoverIndex();
        };

        const handleTouchEnd = (e: TouchEvent) => {
            // Prevent default browser click generation if we handle it here
            if (e.cancelable) e.preventDefault();
            handleClick(e);

            // Reset flag after a delay to allow mouse usage again later if needed (hybrid devices)
            setTimeout(() => isTouchInteraction = false, 500);
        };

        const el = containerRef.current;
        if (!el) return;

        window.addEventListener('mousemove', handleMouseMove); // Keep mouse move on window for smoother tracking
        el.addEventListener('click', handleClick);

        // Passive false so we can preventDefault
        const touchOpt = { passive: false };
        el.addEventListener('touchstart', handleTouchStart, touchOpt);
        el.addEventListener('touchend', handleTouchEnd, touchOpt);

        return () => {
            cancelAnimationFrame(frameId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('mousemove', handleMouseMove);
            el.removeEventListener('click', handleClick);
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchend', handleTouchEnd);
            resizeObserver.disconnect();
            if (sceneRef.current) {
                cleanScene(sceneRef.current.scene);
                sceneRef.current.renderer.dispose();
            }
            if (containerRef.current) containerRef.current.innerHTML = '';
        };
    }, [gameState.isMultiplayer, settings.ultraPerformance]); // Rebuild scene when switching SP/MP or toggling Ultra Performance

    // Separate effect for Pixel Scale / Resolution updates (No Rebuild)
    useEffect(() => {
        if (!containerRef.current || !sceneRef.current) return;
        syncResolution(containerRef.current, sceneRef.current, settings);
    }, [settings.pixelScale, settings.ultraPerformance, settings.balancedPerformance]);

    // --- SYNC EFFECTS ---
    useEffect(() => {
        if (!sceneRef.current) return;
        const { sparkParticles, gunGroup } = sceneRef.current;
        gunGroup.userData.isSawing = propsRef.current.animState.isSawing;

        if (animState.triggerSparks > 0) {
            sceneRef.current.scene.userData.cameraShake = 0.6;
            const pos = sparkParticles.geometry.attributes.position.array as Float32Array;
            const vel = sparkParticles.geometry.attributes.velocity.array as Float32Array;
            const isPlayer = propsRef.current.turnOwner === 'PLAYER';
            const sparkZOffset = isPlayer ? 4.5 : -4.5; // Offset towards the side using it

            for (let i = 0; i < pos.length / 3; i++) {
                const idx = i * 3;
                pos[idx] = gunGroup.position.x + (Math.random() - 0.5) * 0.5;
                pos[idx + 1] = gunGroup.position.y + 0.3;
                pos[idx + 2] = gunGroup.position.z + (Math.random() - 0.5) * 1.5 + sparkZOffset;
                vel[idx] = (Math.random() - 0.5) * 0.8;
                vel[idx + 1] = Math.random() * 0.5;
                vel[idx + 2] = (Math.random() - 0.5) * 0.4;
            }
            sparkParticles.geometry.attributes.position.needsUpdate = true;
        }
    }, [animState.triggerSparks, animState.isSawing]);

    useEffect(() => {
        if (sceneRef.current) sceneRef.current.dealerGroup.userData.targetY = animState.dealerDropping ? -15 : null;
    }, [animState.dealerDropping]);

    useEffect(() => {
        if (animState.dealerHit && sceneRef.current) {
            const { bloodParticles } = sceneRef.current;
            const positions = bloodParticles.geometry.attributes.position.array as Float32Array;
            const velocities = bloodParticles.geometry.attributes.velocity.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                const idx = i * 3;
                positions[idx] = 0 + (Math.random() - 0.5) * 2.0;
                positions[idx + 1] = 5.5 + (Math.random() - 0.5) * 1.5;
                positions[idx + 2] = -12 + (Math.random() - 0.5) * 1.0;
                velocities[idx] = (Math.random() - 0.5) * 0.6;
                velocities[idx + 1] = (Math.random() * 0.4) + 0.1;
                velocities[idx + 2] = (Math.random() * 0.8) + 0.4;
            }
            bloodParticles.geometry.attributes.position.needsUpdate = true;
        }
    }, [animState.dealerHit]);

    useEffect(() => {
        if (animState.triggerCuff > 0 && sceneRef.current) {
            sceneRef.current.scene.userData.cameraShake = 0.8;
        }
    }, [animState.triggerCuff]);

    useEffect(() => {
        if (!sceneRef.current) return;
        if (animState.triggerDrink > 0) sceneRef.current.scene.userData.cameraShake = 0.5;
        if (animState.triggerHeal > 0) sceneRef.current.scene.userData.cameraShake = 0.3;
        if (animState.triggerRemote > 0) sceneRef.current.scene.userData.cameraShake = 0.7; // Shake on remote use
    }, [animState.triggerDrink, animState.triggerHeal, animState.triggerRemote]);

    // Variant transformations are now handled dynamically in sceneLogic.ts

    // CHOKE ATTACHMENT SYNC
    useEffect(() => {
        if (!sceneRef.current || !sceneRef.current.chokeMesh) return;
        const { chokeMesh } = sceneRef.current;

        // Show if active (Animation handles temporary visibility during attach)
        const isVisible = propsRef.current.isChokeActive;
        // Note: animations.ts forces visibility during the attach sequence (chokeTime < 2.2)
        // This effect ensures it stays visible AFTER animation if active, and hides after shot.

        // However, if we only rely on isChokeActive, there is a gap:
        // 0.0s: Click -> Trigger++ -> isChokeActive=False. Effect sets Visible=False. Anim sets Visible=True. (OK)
        // 1.5s: isChokeActive=True. Effect sets Visible=True. (OK)
        // Shot: isChokeActive=False. Effect sets Visible=False. Anim skipped. (OK)

        // Wait, does React Effect override Animation Loop?
        // React Effect runs ONCE per change. Animation Loop runs 60 times/sec.
        // Animation Loop WINS during animation.
        // This Effect WINS when state changes (like shooting).
        // Since Animation Loop stops touching it after 2.2s, the Effect's last state must be correct.
        // When isChokeActive becomes True (at 1.5s), Effect sets True. It stays True.
        // When Shot (at X s), isChokeActive becomes False. Effect sets False. It stays False.
        // This logic is sound.

        // One caveat: If Effect sets it to False at 0.0s, does it flicker?
        // Anim loop sets it True immediately. Should be fine.

        if (!animState.triggerChoke) {
            // Initial load safety
            chokeMesh.visible = !!isVisible;
        } else {
            // Let animation loop handle it if animating, but ensure state consistency
            if (isVisible) chokeMesh.visible = true;
            else if (animState.triggerChoke > 0 && !isVisible) {
                // It's false. But is it animating?
                // We don't know time here.
                // But we know isChokeActive is false.
                // If we set visible = false here, the anim loop will set it back to true next frame if animating.
                // So "fighting" is okay because Anim Loop is per-frame.
                // Just setting it here is fine.
                chokeMesh.visible = false;
            }
        }

        if (isVisible) {
            // If sawed, move choke back
            if (isSawed) {
                chokeMesh.position.z = 8.4;
            } else {
                chokeMesh.position.z = 10.9;
            }
        }
    }, [propsRef.current.isChokeActive, animState.triggerChoke, isSawed]);

    useEffect(() => {
        if (!sceneRef.current) return;
        const { muzzleLight, muzzleFlash, gunGroup, roomRedLight, sparkParticles } = sceneRef.current;
        muzzleLight.intensity = animState.muzzleFlashIntensity;
        muzzleLight.position.copy(gunGroup.position);
        muzzleLight.position.y += 0.5;
        const dir = new THREE.Vector3(0, 0, 1).applyEuler(gunGroup.rotation);
        muzzleLight.position.add(dir.multiplyScalar(8));
        if (animState.muzzleFlashIntensity > 0) {
            if (animState.isLiveShot) {
                muzzleFlash.visible = true;
                muzzleFlash.children.forEach((child) => {
                    const mesh = child as THREE.Mesh;
                    const mat = mesh.material as THREE.MeshBasicMaterial;
                    if (mat) {
                        mat.opacity = 1;
                        if (mat.color) mat.color.setHex(0xff5500);
                    }
                });

                muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
                muzzleLight.color.setHex(0xffaa00);
                roomRedLight.intensity = 20 * (propsRef.current.settings.brightness || 1.0);

                const pos = sparkParticles.geometry.attributes.position.array as Float32Array;
                const vel = sparkParticles.geometry.attributes.velocity.array as Float32Array;
                const count = pos.length / 3;
                for (let i = 0; i < count; i++) {
                    if (i < 60) {
                        const idx = i * 3;
                        pos[idx] = muzzleLight.position.x + (Math.random() - 0.5) * 0.3;
                        pos[idx + 1] = muzzleLight.position.y + (Math.random() - 0.5) * 0.3;
                        pos[idx + 2] = muzzleLight.position.z + (Math.random() - 0.5) * 0.3;
                        const spread = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).multiplyScalar(0.5);
                        const blast = dir.clone().multiplyScalar(1.0 + Math.random() * 2.0);
                        vel[idx] = blast.x + spread.x;
                        vel[idx + 1] = blast.y + spread.y;
                        vel[idx + 2] = blast.z + spread.z;
                    }
                }
                sparkParticles.geometry.attributes.position.needsUpdate = true;
            } else {
                muzzleFlash.children.forEach((child) => {
                    const mesh = child as THREE.Mesh;
                    if (mesh.material) (mesh.material as THREE.Material).opacity = 0;
                });
                muzzleFlash.visible = false;
                muzzleLight.intensity = 0;
                // Maintain ambient red glow
                roomRedLight.intensity = 3.0 * (propsRef.current.settings.brightness || 1.0);
            }
        } else {
            let isVis = false;
            muzzleFlash.children.forEach((child) => {
                const mesh = child as THREE.Mesh;
                const mat = mesh.material as THREE.Material;
                if (mat && mat.opacity > 0) {
                    mat.opacity -= 0.15;
                    isVis = true;
                }
            });

            if (animState.muzzleFlashIntensity === 0) {
                isVis = false;
                muzzleFlash.visible = false;
            } else {
                muzzleFlash.visible = isVis;
            }

            // Return to ambient red glow
            const targetRed = 3.0 * (propsRef.current.settings.brightness || 1.0);
            roomRedLight.intensity = THREE.MathUtils.lerp(roomRedLight.intensity, targetRed, 0.2);
            if (!isVis && muzzleFlash.visible) muzzleFlash.visible = false;
        }
    }, [animState.muzzleFlashIntensity, animState.isLiveShot]);

    useEffect(() => {
        if (animState.triggerRecoil === 0 || !sceneRef.current) return;
        const { gunGroup, bulletMesh, scene } = sceneRef.current;
        const recoilMult = animState.isLiveShot ? 1.0 : 0.3;
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(gunGroup.rotation);
        gunGroup.position.sub(forward.multiplyScalar(1.5 * recoilMult));
        gunGroup.rotation.x -= 0.5 * recoilMult;
        if (animState.isLiveShot) {
            bulletMesh.visible = true;
            bulletMesh.position.copy(gunGroup.position);
            bulletMesh.position.add(forward.normalize().multiplyScalar(isSawed ? 4 : 8));
            bulletMesh.userData.velocity = forward.normalize();
        }
        scene.userData.cameraShake = animState.isLiveShot ? 1.5 : 0.2;
    }, [animState.triggerRecoil, isSawed, animState.isLiveShot]);

    useEffect(() => {
        if (animState.triggerRack === 0 || !sceneRef.current) return;
        const { shellCasings, shellVelocities, gunGroup } = sceneRef.current;
        if (!shellCasings || !shellVelocities) return;

        let colors = [animState.ejectedShellColor];
        if (animState.ejectedShellColor.includes('+')) {
            colors = animState.ejectedShellColor.split('+') as any; // 'red', 'red' etc.
        }

        colors.forEach((color, i) => {
            // Eject Shell Logic
            const nextIdx = sceneRef.current!.nextShellIndex ?? 0;
            const shell = shellCasings[nextIdx];
            const vel = shellVelocities[nextIdx];
            sceneRef.current!.nextShellIndex = (nextIdx + 1) % shellCasings.length;
            const mat = shell.material as THREE.MeshStandardMaterial;

            if (color === 'blue') {
                mat.color.setHex(0x3b82f6);
                mat.emissive.setHex(0x1e40af);
                mat.emissiveIntensity = 0.5;
            } else {
                mat.color.setHex(0xef4444);
                mat.emissive.setHex(0x991b1b);
                mat.emissiveIntensity = 0.4;
            }

            shell.scale.setScalar(2.0);
            shell.visible = true;
            const basePos = shell.userData.basePosition || { x: 0, z: 0 };

            // Offset second shell slightly if double drop
            const offsetDelay = i * 0.2;

            // Immediate position set? No, shells update in loop. 
            // Just set initial pos.
            shell.position.set(
                basePos.x + (Math.random() - 0.5) * 0.3 + i * 0.1,
                3 + i * 0.5, // Second one higher
                basePos.z + (Math.random() - 0.5) * 0.3
            );

            shell.userData.landedAt = null;
            vel.set(
                (Math.random() - 0.5) * 0.04 + (i * 0.02), // Spread x
                0.05 + Math.random() * 0.02,
                (Math.random() - 0.5) * 0.03
            );
        });

        gunGroup.rotation.x -= 0.4;

    }, [animState.triggerRack, animState.ejectedShellColor]);

    return <div ref={containerRef} className="absolute inset-0 z-0 bg-neutral-950" />;
};