import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraView, TurnOwner, AimTarget, AnimationState, GameSettings, SceneContext, PlayerState, GameState, PlayerModelKey } from '../types';

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
    player3?: PlayerState;
    player4?: PlayerState;
    gameState: GameState;
    onCardClick?: (index: number) => void;
    onLowPerformance?: (fps: number) => void;
    isPaused?: boolean;
    onUpdateNameTags?: (tags: { name: string, x: number, y: number, visible: boolean }[]) => void;
    dealerModel?: PlayerModelKey;
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
        mobilePixelScale = settings.ultraPerformance ? 5.5 : (settings.balancedPerformance ? 4.5 : (isLowEndDevice ? 4.5 : 2.8));
    } else if (isTab) {
        mobilePixelScale = settings.ultraPerformance ? 4.0 : (settings.balancedPerformance ? 3.0 : 2.2);
    }
    mobilePixelScale = Math.max(mobilePixelScale, settings.pixelScale || 0);

    const desktopProfileMin = settings.ultraPerformance ? 5.0 : (settings.balancedPerformance ? 4.0 : 0);
    const desktopPixelScale = settings.pixelScale || 3;
    const desktopBaseScale = desktopProfileMin > 0 ? Math.max(desktopProfileMin, desktopPixelScale) : desktopPixelScale;

    const baseScale = (isMob || isTab) ? mobilePixelScale : desktopBaseScale;
    return Math.max(1.0, baseScale * 0.45);
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
    const maxPixelRatio = settings.ultraPerformance || settings.balancedPerformance
        ? 1.0
        : (isMobile ? Math.min(window.devicePixelRatio, 1.5) : (isTablet ? 1.2 : Math.min(window.devicePixelRatio, 2)));
    const customHeadModels = Object.values(scene.userData.multiplayerDebugModels || {}).some((model: any) =>
        ['ASP', 'YUVRAJ', 'AADISH', 'YASH'].includes(model)
    );
    const shouldUseAutoRendering = true;
    renderer.setPixelRatio(maxPixelRatio);
    renderer.setSize(width / pxScale, height / pxScale, false);
    renderer.domElement.style.imageRendering = 'auto';

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
    player3,
    player4,
    gameState,
    onCardClick,
    onLowPerformance,
    isPaused = false,
    onUpdateNameTags,
    dealerModel,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Pre-allocated reusable vectors — avoids GC allocations inside gun-fire effects
    const _recoilFwd = useRef(new THREE.Vector3());
    const _muzzleFlashDir = useRef(new THREE.Vector3());
    const _sparkSpread = useRef(new THREE.Vector3());

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
        player3,
        player4,
        gameState,
        onCardClick,
        onGunClick,
        onLowPerformance,
        isPaused,
        onUpdateNameTags,
        dealerModel,
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
            player3,
            player4,
            gameState,
            onCardClick,
            onGunClick,
            onLowPerformance,
            isPaused,
            onUpdateNameTags,
            dealerModel,
        };
    }, [isSawed, isChokeActive, isPlayerCuffed, aimTarget, cameraView, animState, turnOwner, settings, knownShell, isHardMode, player, dealer, player3, player4, gameState, onCardClick, onGunClick, onLowPerformance, isPaused, onUpdateNameTags, dealerModel]);

    const sceneRef = useRef<SceneContext | null>(null);
    const tagProjectionVec = useRef(new THREE.Vector3());
    const worldPositionVec = useRef(new THREE.Vector3());



    useEffect(() => {
        if (!containerRef.current) return;

        const initThree = () => {
            if (!containerRef.current) return;

            if (sceneRef.current) {
                // Proper cleanup without forcing a context loss, which can leave the
                // next renderer initialization in an invalid state.
                cleanScene(sceneRef.current.scene);
                try {
                    sceneRef.current.renderer.dispose();
                } catch (e) {}
                if (containerRef.current.contains(sceneRef.current.renderer.domElement)) {
                    containerRef.current.removeChild(sceneRef.current.renderer.domElement);
                }
                sceneRef.current = null;
            }

            const context = initThreeScene(containerRef.current, propsRef.current);
            if (context) {
                sceneRef.current = context;
                updateCameraResponsive();

                // Warm up shaders later, after the first frame, so startup feels snappier.
                try {
                    const renderer = context.renderer;
                    const scene = context.scene;
                    const camera = context.camera;
                    const warmup = () => {
                        if (!sceneRef.current || sceneRef.current.renderer !== renderer) return;
                        try {
                            renderer.compile(scene, camera);
                        } catch (e) {
                            console.warn('WebGL warmup deferred:', e);
                        }
                    };
                    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                        (window as Window & typeof globalThis & { requestIdleCallback: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number }).requestIdleCallback(() => warmup(), { timeout: 1000 });
                    } else {
                        window.setTimeout(warmup, 250);
                    }
                } catch (e) {
                    console.error('WebGL Warmup Error:', e);
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
        let lastFrameTime = performance.now();
        let isTabVisible = true;

        let frameCount = 0;
        let fpsTimeStart = performance.now();
        let fpsAverages: number[] = [];
        let hasShownPerfWarning = false;
        let nameTagFrameCounter = 0;
        const nameTagUpdateInterval = 3;

        const handleVisibilityChange = () => {
            if (document.hidden || document.visibilityState !== 'visible') {
                isTabVisible = false;
            } else {
                isTabVisible = true;
                lastTime = performance.now();
                lastFrameTime = performance.now();
                fpsTimeStart = performance.now();
                frameCount = 0;
                fpsAverages = [];
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const animate = (currentTime: number = performance.now()) => {
            frameId = requestAnimationFrame(animate);
            if (!sceneRef.current) return;
            if (propsRef.current.isPaused) {
                lastTime = currentTime; lastFrameTime = currentTime; return;
            }
            if (!isTabVisible || document.hidden || document.visibilityState !== 'visible') {
                lastTime = currentTime; 
                lastFrameTime = currentTime; 
                fpsTimeStart = currentTime;
                frameCount = 0;
                return;
            }

            const phase = propsRef.current.gameState?.phase;
            const isInMenu = phase === 'BOOT' || phase === 'INTRO' || phase === 'LOAD';
            const frameStart = performance.now();

            const isUltra = !!propsRef.current.settings?.ultraPerformance;
            const isBalanced = !!propsRef.current.settings?.balancedPerformance;
            const currentTargetFPS = isInMenu ? 24 : (isUltra ? 30 : (isBalanced ? 45 : (isMobile && (isAndroid || window.devicePixelRatio < 2) ? 40 : 60)));
            const currentFrameInterval = 1000 / currentTargetFPS;
            const shouldLimitFrame = isInMenu || isUltra || isBalanced || (isMobile && (isAndroid || window.devicePixelRatio < 2));

            // Frame Limiting Logic (Enforce based on performance settings to save battery/thermal)
            if (shouldLimitFrame) {
                const elapsed = currentTime - lastFrameTime;
                if (elapsed < currentFrameInterval) return;
                lastFrameTime = currentTime - (elapsed % currentFrameInterval);
            } else {
                lastFrameTime = currentTime;
            }

            // FPS Detection Logic for Performance Warning
            frameCount++;
            const fpsElapsed = currentTime - fpsTimeStart;
            if (fpsElapsed >= 2000) {
                const currentFps = (frameCount * 1000) / fpsElapsed;
                frameCount = 0;
                fpsTimeStart = currentTime;

                fpsAverages.push(currentFps);
                if (fpsAverages.length > 3) {
                    fpsAverages.shift();
                }

                if (fpsAverages.length === 3) {
                    const avgFps = fpsAverages.reduce((a, b) => a + b, 0) / 3;
                    const currentSettings = propsRef.current.settings;
                    
                    const alreadyShownWarning = sessionStorage.getItem('aadish_roulette_perf_warning_shown') === 'true';
                    if (avgFps < 20 && !currentSettings.ultraPerformance && !hasShownPerfWarning && !alreadyShownWarning) {
                        hasShownPerfWarning = true;
                        try {
                            sessionStorage.setItem('aadish_roulette_perf_warning_shown', 'true');
                        } catch (e) {
                            console.warn("sessionStorage failed:", e);
                        }
                        if (propsRef.current.onLowPerformance) {
                            propsRef.current.onLowPerformance(avgFps);
                        }
                    }
                }
            }

            const rawDelta = (currentTime - lastTime) / 1000;
            // Cap delta to prevent huge jumps and negative values
            const delta = Math.max(0.0, Math.min(rawDelta, 0.1));
            lastTime = currentTime;

            time += delta;

            const updateStart = performance.now();
            updateScene(sceneRef.current, propsRef.current, time, delta);
            const frameDuration = performance.now() - updateStart;
            const frameBudgetMs = (currentTargetFPS > 0 ? 1000 / currentTargetFPS : 16.67) * 1.2;
            if (sceneRef.current && frameDuration > frameBudgetMs) {
                sceneRef.current.scene.userData.performanceMode = true;
            } else if (sceneRef.current && frameDuration < frameBudgetMs * 0.6) {
                sceneRef.current.scene.userData.performanceMode = false;
            }

            if (sceneRef.current && propsRef.current.onUpdateNameTags) {
                const shouldReduceNameTags = !!sceneRef.current.scene.userData.performanceMode;
                if (++nameTagFrameCounter % (shouldReduceNameTags ? 4 : nameTagUpdateInterval) !== 0) {
                    return;
                }

                const { scene, camera, dealerGroup } = sceneRef.current;
                const worldPos = worldPositionVec.current;
                const tagsList: { name: string, x: number, y: number, visible: boolean }[] = [];

                const getCachedHead = (cacheKey: string, groupName: string) => {
                    if (scene.userData[cacheKey] === undefined) {
                        const group = scene.getObjectByName(groupName);
                        scene.userData[cacheKey] = group?.getObjectByName('HEAD') || null;
                    }
                    return scene.userData[cacheKey] as THREE.Object3D | null;
                };

                const addHeadTag = (head: THREE.Object3D | null, label: string) => {
                    if (!head) return;

                    const bbox = new THREE.Box3().setFromObject(head);
                    if (bbox.isEmpty()) {
                        head.getWorldPosition(worldPos);
                        worldPos.y += 2.4;
                    } else {
                        const topY = bbox.max.y;
                        const headHeight = bbox.max.y - bbox.min.y;
                        const x = (bbox.min.x + bbox.max.x) * 0.5;
                        const z = (bbox.min.z + bbox.max.z) * 0.5;
                        worldPos.set(x, topY + Math.max(0.08, headHeight * 0.08), z);
                    }

                    worldPos.project(camera);

                    const x = (worldPos.x * 0.5 + 0.5) * 100;
                    const y = Math.min(100, (worldPos.y * -0.5 + 0.5) * 100 + 7);
                    const visible = worldPos.z <= 1.0;

                    tagsList.push({ name: label, x, y, visible });
                };

                const players = propsRef.current.gameState.multiplayerState?.players || [];
                const myId = propsRef.current.gameState.localPlayerId || '';
                const myIndex = players.findIndex((p: any) => p.id === myId);

                const dealerHead = scene.userData.cachedDealerHead || dealerGroup.getObjectByName('HEAD');
                if (!scene.userData.cachedDealerHead) scene.userData.cachedDealerHead = dealerHead;
                addHeadTag(dealerHead, propsRef.current.gameState.opponentName || 'OPPONENT');

                const player3Head = getCachedHead('cachedPlayer3Head', 'PLAYER3');
                let player3Name = 'OPPONENT 2';
                if (myIndex !== -1) {
                    const size = players.length >= 4 ? 4 : 3;
                    const sideOpponent = players[(myIndex + 1) % size];
                    if (sideOpponent) player3Name = sideOpponent.name;
                }
                addHeadTag(player3Head, player3Name);

                if (players.length >= 4) {
                    const player4Head = getCachedHead('cachedPlayer4Head', 'PLAYER4');
                    let player4Name = 'OPPONENT 3';
                    if (myIndex !== -1) {
                        const rightOpponent = players[(myIndex + 3) % 4];
                        if (rightOpponent) player4Name = rightOpponent.name;
                    }
                    addHeadTag(player4Head, player4Name);
                }

                propsRef.current.onUpdateNameTags(tagsList);
            }
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

        const clickLock = { lastTime: 0 };
        const handleClick = (e?: MouseEvent | TouchEvent) => {
            const now = performance.now();
            if (now - clickLock.lastTime < 100) {
                return;
            }
            clickLock.lastTime = now;

            if (!sceneRef.current) return;

            const currentProps = propsRef.current;
            const currentGameState = currentProps.gameState;

            if (currentGameState.phase === 'CARD_SELECT' && currentGameState.turnOwner === 'PLAYER' && currentGameState.selectedCardIndex === null) {
                const itemDeckCards = sceneRef.current.itemDeckCards;
                if (itemDeckCards && itemDeckCards.length > 0) {
                    sceneRef.current.raycaster.setFromCamera(sceneRef.current.mouse, sceneRef.current.camera);
                    const intersects = sceneRef.current.raycaster.intersectObjects(itemDeckCards, true);
                    if (intersects.length > 0) {
                        let parentGroup: THREE.Object3D | null = intersects[0].object;
                        while (parentGroup && !parentGroup.name.startsWith('ITEM_DECK_CARD_')) {
                            parentGroup = parentGroup.parent;
                        }
                        if (parentGroup) {
                            const idx = itemDeckCards.indexOf(parentGroup as THREE.Group);
                            if (idx !== -1 && currentProps.onCardClick) {
                                currentProps.onCardClick(idx);
                            }
                        }
                    }
                }
                return;
            }

            sceneRef.current.raycaster.setFromCamera(sceneRef.current.mouse, sceneRef.current.camera);
            const gunHitTargets = sceneRef.current.gunGroup.children;
            if (gunHitTargets && gunHitTargets.length > 0) {
                const intersects = sceneRef.current.raycaster.intersectObjects(gunHitTargets, true);
                if (intersects.length > 0 && intersects.some(i => i.object.userData.type === 'GUN') && currentProps.onGunClick) {
                    currentProps.onGunClick();
                }
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
                try {
                    const renderer = sceneRef.current.renderer;
                    const webglContext = (renderer.getContext && renderer.getContext()) as WebGLRenderingContext | null;
                    if (webglContext && !webglContext.isContextLost()) {
                        (renderer as THREE.WebGLRenderer & { forceContextLoss?: () => void }).forceContextLoss?.();
                    }
                    renderer.dispose();
                } catch (e) {
                    console.warn('Error disposing renderer during cleanup:', e);
                }
                sceneRef.current = null;
            }
            if (containerRef.current) containerRef.current.innerHTML = '';
        };
    }, [gameState.isMultiplayer, gameState.isThreePlayer, gameState.multiplayerState?.players?.map(p => p.id).join(','), settings.ultraPerformance, settings.balancedPerformance, settings.debugHeadModel, isPaused, dealerModel]); // Rebuild scene when switching SP/MP, toggling perf/head override, or unpausing the game

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
                const spread = _sparkSpread.current;
                const blastBase = dir.clone();
                for (let i = 0; i < count && i < 60; i++) {
                    const idx = i * 3;
                    pos[idx] = muzzleLight.position.x + (Math.random() - 0.5) * 0.3;
                    pos[idx + 1] = muzzleLight.position.y + (Math.random() - 0.5) * 0.3;
                    pos[idx + 2] = muzzleLight.position.z + (Math.random() - 0.5) * 0.3;
                    spread.set(
                        (Math.random() - 0.5) * 1.0,
                        (Math.random() - 0.5) * 1.0,
                        (Math.random() - 0.5) * 1.0,
                    );
                    const blast = blastBase.multiplyScalar(1.0 + Math.random() * 2.0);
                    vel[idx] = blast.x + spread.x;
                    vel[idx + 1] = blast.y + spread.y;
                    vel[idx + 2] = blast.z + spread.z;
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
        // Reuse pre-allocated vector — no GC alloc on every shot
        const forward = _recoilFwd.current.set(0, 0, 1).applyEuler(gunGroup.rotation);
        gunGroup.position.sub(forward.multiplyScalar(1.5 * recoilMult));
        gunGroup.rotation.x -= 0.5 * recoilMult;
        if (animState.isLiveShot) {
            bulletMesh.visible = true;
            bulletMesh.position.copy(gunGroup.position);
            bulletMesh.position.add(forward.normalize().multiplyScalar(isSawed ? 4 : 8));
            bulletMesh.userData.velocity = forward.normalize().clone(); // clone once for velocity
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

    return <div ref={containerRef} className="absolute inset-0 z-0 bg-neutral-950" style={{ display: isPaused ? 'none' : 'block' }} />;
};