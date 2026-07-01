import * as THREE from 'three';
import { SceneContext, SceneProps } from '../types';
import { audioManager } from './audioManager';
import { updateItemAnimations, updateBlood, updateSparks, updateBullet, updateShell } from './scene/animations';
import { performanceMonitor } from './performanceMonitor';

// Pre-allocated scratch vectors — reused across frames to avoid GC pressure
const _vKick = new THREE.Vector3();

export function updateScene(context: SceneContext, props: SceneProps, time: number, delta?: number) {
    const { gunGroup, camera, dealerGroup, shellCasings, shellVelocities, scene, bulletMesh, bloodParticles, sparkParticles, dustParticles, bulbLight, mouse, renderer, muzzleFlash, baseLights, gunLight, underLight } = context;
    const { turnOwner, aimTarget, cameraView, settings, animState, gameState, player, dealer } = props;
    const { phase } = gameState;
    const isMobile = scene.userData.isMobile;
    const reduceEffects = !!scene.userData.performanceMode;
    const hasActiveVisualEffects = !!(
        animState.triggerGlass ||
        animState.triggerDrink ||
        animState.triggerPhone ||
        animState.triggerInverter ||
        animState.triggerRemote ||
        animState.triggerAdrenaline ||
        animState.triggerLuckycharm ||
        animState.triggerDeckCard ||
        animState.triggerTotem ||
        animState.triggerMirror ||
        animState.triggerCuff ||
        animState.triggerSparks ||
        animState.playerHit ||
        animState.dealerHit ||
        animState.player3Hit ||
        animState.isSawing
    );
    const shouldUpdateHeavyEffects = !reduceEffects || hasActiveVisualEffects;

    const MAX_DT = 0.05;
    const dt = Math.max(0.0, Math.min(delta || 0.016, MAX_DT)); // Clamp DT to prevent huge jumps/skips and negative values

    // --- BRIGHTNESS & FOV ---
    const brightnessMult = settings.brightness || 1.0;
    const targetFov = settings.fov || 85;
    if (camera.fov !== targetFov) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-6.3 * dt));
        camera.updateProjectionMatrix();
    }

    // Smoothly update toneMapping exposure based on brightness setting
    renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, 1.8 * brightnessMult, 1 - Math.exp(-6.3 * dt));

    // Apply brightness to all static lights - Optimization: use cached array length
    const lenLights = baseLights.length;
    for (let i = 0; i < lenLights; i++) {
        const bl = baseLights[i];
        if (bl.light && bl.baseIntensity !== undefined) {
            bl.light.intensity = bl.baseIntensity * brightnessMult;
        }
    }



    // PERFORMANCE: Cache bulbBase lookup (only compute once)
    if (scene.userData.cachedBulbBase === undefined) {
        // Safe check in case bulbLight isn't in baseLights for some reason
        const found = baseLights.find(b => b.light === bulbLight);
        scene.userData.cachedBulbBase = found ? found.baseIntensity : 45.0;
    }
    const bulbBase = scene.userData.cachedBulbBase;

    // Bulb Flicker - Electrical Instability (throttled randomness)
    let target = bulbBase;
    if (Math.random() > 0.96) target = bulbBase * (0.5 + Math.random() * 0.8); // Drop or spike

    // Smooth flickering + brightness scaling
    // We treat 'currentBase' as the intensity WITHOUT brightness for lerping logic
    const flickerBase = THREE.MathUtils.lerp(bulbLight.userData.flickerBase || bulbBase, target, 1 - Math.exp(-13.0 * dt));
    bulbLight.userData.flickerBase = flickerBase; // Store state
    bulbLight.intensity = flickerBase * brightnessMult;

    // SWAY LOGIC - PERFORMANCE: Cache bulbGroup lookup
    if (!scene.userData.cachedBulbGroup) {
        scene.userData.cachedBulbGroup = scene.getObjectByName('HANGING_LIGHT');
    }
    const bulbGroup = scene.userData.cachedBulbGroup;
    if (bulbGroup) {
        // Pendulum Swing
        bulbGroup.rotation.z = Math.sin(time * 0.8) * 0.05;
        bulbGroup.rotation.x = Math.sin(time * 0.6) * 0.03;

        // Sync Light Source Position to Mesh (Approximation for shadows)
        const len = 6;
        bulbLight.position.x = bulbGroup.position.x + (len * Math.sin(bulbGroup.rotation.z));
        bulbLight.position.z = bulbGroup.position.z - (len * Math.sin(bulbGroup.rotation.x));
    }

    // FOV & Heartbeat Handling
    let targetCameraFOV = settings.fov || 70;
    
    // Heartbeat pulse calculation for self-aim (150 BPM)
    let heartbeatPulse = 0;
    if (turnOwner === 'PLAYER' && aimTarget === 'SELF') {
        const beatTime = (time * 2.5) % 1.0;
        heartbeatPulse = (beatTime < 0.15 ? Math.sin((beatTime / 0.15) * Math.PI) : (beatTime < 0.45 ? 0.5 * Math.sin(((beatTime - 0.15) / 0.3) * Math.PI) : 0));
    }

    // Zoom Logic
    if (cameraView === 'TABLE') {
        targetCameraFOV *= 0.8;
    } else if (aimTarget === 'OPPONENT' && turnOwner === 'DEALER') {
        targetCameraFOV *= 0.85;
    } else if (aimTarget === 'SELF' && turnOwner === 'PLAYER') {
        targetCameraFOV *= (0.75 - heartbeatPulse * 0.15); // Deep contraction zoom on thumps
    } else if (aimTarget !== 'IDLE' && turnOwner === 'PLAYER') {
        targetCameraFOV *= 0.9;
    }

    if (Math.abs(camera.fov - targetCameraFOV) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetCameraFOV, 1 - Math.exp(-3 * dt));
        camera.updateProjectionMatrix();
    }

    // --- VARIANT GUN MODELS (SAWED-OFF / CHOKE) ---
    const isSawed = animState.isSawing || props.player.isSawedActive || props.dealer.isSawedActive;
    const isChoke = props.player.isChokeActive || props.dealer.isChokeActive || false;
    const flashZ = isSawed ? (isChoke ? 7.8 : 4.0) : (isChoke ? 15.5 : 10.5);

    // --- GUN LOGIC ---
    const targets = gunGroup.userData;
    if (!targets.targetPos) {
        targets.targetPos = new THREE.Vector3();
        targets.targetRot = new THREE.Euler();
    }

    let targetGunLightIntensity = 0;

    if (turnOwner === 'PLAYER') {
        if (aimTarget === 'OPPONENT') {
            const swayX = Math.sin(time * 1.5) * 0.02;
            const swayY = Math.cos(time * 2.0) * 0.02;
            const xOffset = isMobile ? swayX * 0.5 : swayX;
            targets.targetPos.set(xOffset, swayY, 8);
            targets.targetRot.set(swayY * 0.5, Math.PI + xOffset * 0.5, 0);
        } else if (aimTarget === 'LEFT') {
            targets.targetPos.set(-2.5, 0.5, 5);
            targets.targetRot.set(0.1, Math.PI + 1.25, 0.1);
        } else if (aimTarget === 'RIGHT') {
            targets.targetPos.set(2.5, 0.5, 5);
            targets.targetRot.set(0.1, Math.PI - 1.25, -0.1);
        } else if (aimTarget === 'SELF') {
            // Visceral face-to-barrel close-up coordinates (offset Z dynamically by barrel length to keep tip at Z=8.5)
            const yOffset = isMobile ? 1.55 : 1.8;
            targets.targetPos.set(0, yOffset, 8.5 - flashZ);
            targets.targetRot.set(-0.08, 0, 0);
        } else if (aimTarget === 'CHOOSING') {
            // Holding Gun, waiting for choice - optimized for mobile to avoid cutoff behind UI
            const xPos = isMobile ? 0.0 : 0.5;
            const yPos = isMobile ? -0.4 : -1.0;
            const zPos = isMobile ? 4.8 : 5.5;
            targets.targetPos.set(xPos, yPos, zPos);
            targets.targetRot.set(0, Math.PI / 2.2, Math.PI / 2); // Sideways hold
        } else if (cameraView === 'GUN') {
            const yPos = isMobile ? -0.4 : -0.75;
            targets.targetPos.set(0, yPos, 4);
            targets.targetRot.set(0, Math.PI / 2, Math.PI / 2);
        } else if (cameraView === 'DEALER_GUN') {
            // Gun held by Dealer/Remote player in PLAYER turn (e.g. Adrenaline check?) or transition
            targets.targetPos.set(0, 1.2, -6); // Up at dealer level
            targets.targetRot.set(0, Math.PI / 2, Math.PI / 2); // Sideways hold
        } else {
            // Table rest
            targets.targetPos.set(0, -0.8, 2);
            targets.targetRot.set(0, Math.PI / 2, 0);
        }
    } else if (turnOwner === 'PLAYER3') {
        const isSelfTarget = aimTarget === 'LEFT';
        const isPlayerTarget = aimTarget === 'SELF';
        const isDealerTarget = aimTarget === 'OPPONENT';
        const isPlayer4Target = aimTarget === 'RIGHT';

        if (isSelfTarget) {
            targets.targetPos.set(-5.5, 1.2, -2);
            targets.targetRot.set(0.2, Math.PI / 2, 0);
            targetGunLightIntensity = 5.0;
        } else if (isDealerTarget) {
            targets.targetPos.set(-4, 0.8, -5);
            targets.targetRot.set(0.15, Math.PI / 3, 0);
            targetGunLightIntensity = 5.0;
        } else if (isPlayerTarget) {
            targets.targetPos.set(-3, 0.8, 3);
            targets.targetRot.set(0.08, Math.PI / 6 + Math.PI / 2, 0);
            targetGunLightIntensity = 5.0;
        } else if (isPlayer4Target) {
            targets.targetPos.set(0, 0.8, -2);
            targets.targetRot.set(0.1, Math.PI / 2, 0);
            targetGunLightIntensity = 5.0;
        } else if (cameraView === 'PLAYER3_GUN') {
            targets.targetPos.set(-6, 0.8, -2);
            targets.targetRot.set(0, Math.PI / 2, Math.PI / 2);
        } else {
            targets.targetPos.set(-6, -0.6, -2);
            targets.targetRot.set(0, Math.PI / 2, Math.PI / 2);
        }
    } else if (turnOwner === 'PLAYER4') {
        const isSelfTarget = aimTarget === 'RIGHT';
        const isPlayerTarget = aimTarget === 'SELF';
        const isDealerTarget = aimTarget === 'OPPONENT';
        const isPlayer3Target = aimTarget === 'LEFT';

        if (isSelfTarget) {
            targets.targetPos.set(5.5, 1.2, -2);
            targets.targetRot.set(0.2, -Math.PI / 2, 0);
            targetGunLightIntensity = 5.0;
        } else if (isDealerTarget) {
            targets.targetPos.set(4, 0.8, -5);
            targets.targetRot.set(0.15, -Math.PI / 3, 0);
            targetGunLightIntensity = 5.0;
        } else if (isPlayerTarget) {
            targets.targetPos.set(3, 0.8, 3);
            targets.targetRot.set(0.08, -Math.PI / 6 - Math.PI / 2, 0);
            targetGunLightIntensity = 5.0;
        } else if (isPlayer3Target) {
            targets.targetPos.set(0, 0.8, -2);
            targets.targetRot.set(0.1, -Math.PI / 2, 0);
            targetGunLightIntensity = 5.0;
        } else if (cameraView === 'PLAYER4_GUN') {
            targets.targetPos.set(6, 0.8, -2);
            targets.targetRot.set(0, -Math.PI / 2, -Math.PI / 2);
        } else {
            targets.targetPos.set(6, -0.6, -2);
            targets.targetRot.set(0, -Math.PI / 2, -Math.PI / 2);
        }
    } else {
        const isMP = gameState?.isMultiplayer;
        if (isMP) {
            if (aimTarget === 'SELF') {
                targets.targetPos.set(0, 2.0, -6.5);
                targets.targetRot.set(-0.25, Math.PI, 0);
                targetGunLightIntensity = 5.0;
            } else if (aimTarget === 'OPPONENT') {
                targets.targetPos.set(0, 0.8, -5.5);
                targets.targetRot.set(0, 0, 0);
                targetGunLightIntensity = 5.0;
            } else if (aimTarget === 'LEFT' || aimTarget === 'RIGHT') {
                const sidePos = scene.userData.player3Side || 'left';
                const sideX = sidePos === 'left' ? -3.0 : 3.0;
                const sideRot = sidePos === 'left' ? Math.PI / 4 : -Math.PI / 4;
                targets.targetPos.set(sideX, 0.8, -4.5);
                targets.targetRot.set(-0.15, Math.PI + sideRot, 0);
                targetGunLightIntensity = 5.0;
            } else if (cameraView === 'DEALER_GUN') {
                targets.targetPos.set(0, 0.8, -6.0);
                targets.targetRot.set(0, Math.PI / 2, Math.PI / 2);
            } else {
                targets.targetPos.set(0, -0.6, -5.5);
                targets.targetRot.set(0, Math.PI / 2, Math.PI / 2);
            }
        } else {
            if (aimTarget === 'SELF') {
                targets.targetPos.set(0, 3.8, 0.0);
                targets.targetRot.set(-0.25, Math.PI, 0);
                targetGunLightIntensity = 5.0;
            } else if (aimTarget === 'OPPONENT') {
                targets.targetPos.set(0, 2, -10);
                targets.targetRot.set(0, 0, 0);
                targetGunLightIntensity = 5.0;
            } else if (aimTarget === 'LEFT' || aimTarget === 'RIGHT') {
                const sidePos = scene.userData.player3Side || 'left';
                const sideX = sidePos === 'left' ? -3.0 : 3.0;
                const sideRot = sidePos === 'left' ? Math.PI / 4 : -Math.PI / 4;
                targets.targetPos.set(sideX, 2.0, -5.0);
                targets.targetRot.set(-0.15, Math.PI + sideRot, 0);
                targetGunLightIntensity = 5.0;
            } else if (cameraView === 'DEALER_GUN') {
                targets.targetPos.set(0, 1.2, -6);
                targets.targetRot.set(0, Math.PI / 2, Math.PI / 2);
            } else {
                targets.targetPos.set(0, -0.7, -2.5);
                targets.targetRot.set(0, Math.PI / 2, Math.PI / 2);
            }
        }
    }

    // --- LIGHTING STABILITY & PULSE ---
    const isTransitionalPhase = ['STEALING', 'ROUND_END', 'RESOLVING', 'BOOT', 'INTRO'].includes(phase);
    const isMenuPhase = phase === 'BOOT' || phase === 'INTRO';

    if (isMenuPhase) {
        if (bulbLight) bulbLight.intensity = 0;
        if (context.roomRedLight) context.roomRedLight.intensity = 0;
        gunLight.intensity = 0;
    } else if (props.isHardMode && context.roomRedLight) {
        // Rhythmic pulse - only if not in a UI/Cinematic phase to avoid flickering
        const heartbeat = isTransitionalPhase ? 0 : Math.pow(Math.sin(time * 1.5), 12.0);
        const baseRed = 0.02;
        const targetIntensity = (baseRed + heartbeat * 0.45) * brightnessMult;
        context.roomRedLight.intensity = THREE.MathUtils.lerp(context.roomRedLight.intensity, targetIntensity, 1 - Math.exp(-6.3 * dt));

        if (bulbLight) {
            const baseBulb = 45.0 * brightnessMult;
            bulbLight.intensity = THREE.MathUtils.lerp(bulbLight.intensity, baseBulb * (1.0 - heartbeat * 0.2), 1 - Math.exp(-6.3 * dt));
        }
    } else if (context.roomRedLight) {
        context.roomRedLight.intensity = THREE.MathUtils.lerp(context.roomRedLight.intensity, 0, 1 - Math.exp(-3.1 * dt));
        if (bulbLight) {
            const baseBulb = 45.0 * brightnessMult;
            bulbLight.intensity = THREE.MathUtils.lerp(bulbLight.intensity, baseBulb, 1 - Math.exp(-3.1 * dt));
        }
    }

    gunLight.intensity = THREE.MathUtils.lerp(gunLight.intensity, targetGunLightIntensity * brightnessMult, 1 - Math.exp(-3 * dt));

    // --- VARIANT GUN MODELS (SAWED-OFF / CHOKE) ---

    if (context.barrelMesh) context.barrelMesh.visible = !isSawed;
    if (context.sight) context.sight.visible = !isSawed;
    if (context.shortBarrelMesh) context.shortBarrelMesh.visible = isSawed;
    if (context.sSight) context.sSight.visible = isSawed;
    if (context.sawCut) context.sawCut.visible = animState.isSawing || isSawed;
    if (context.shortMagTube) context.shortMagTube.visible = isSawed;
    if (context.magTube) context.magTube.visible = !isSawed;

    if (context.chokeMesh) {
        context.chokeMesh.visible = isChoke;
        if (isChoke) {
            // Adjust choke position if sawed
            context.chokeMesh.position.z = isSawed ? 4.5 : 12.2;
        }
    }

    // --- MUZZLE LIGHT & FLASH LOGIC ---
    if (context.muzzleLight) {
        const flashIntensity = (animState.muzzleFlashIntensity || 0) * 0.1;
        context.muzzleLight.intensity = THREE.MathUtils.lerp(context.muzzleLight.intensity, flashIntensity, 1 - Math.exp(-30.0 * dt));

        // Position flash at the end of barrel
        if (context.muzzleFlash) context.muzzleFlash.position.z = flashZ;
        context.muzzleLight.position.set(0, 0.4, flashZ);

        // Dynamic Room Dimming during flash (High Contrast)
        if (bulbLight && flashIntensity > 5) {
            bulbLight.intensity *= 0.2;
        }
    }

    // Gun Animation Lerp (Time-based Damping)
    const gunDampingCurve = isMobile ? 5.5 : 4.5; // Slightly lower for smoother glide
    const gunDamping = 1 - Math.exp(-gunDampingCurve * dt);

    if (!scene.userData._targetPosTemp) scene.userData._targetPosTemp = new THREE.Vector3();
    if (!scene.userData._targetRotTemp) scene.userData._targetRotTemp = new THREE.Euler();
    const targetPos = scene.userData._targetPosTemp.copy(targets.targetPos);
    const targetRot = scene.userData._targetRotTemp.copy(targets.targetRot);

    if (cameraView !== 'TABLE') {
        const swayX = mouse.x * 0.15;
        const swayY = mouse.y * 0.12;
        targetRot.x += swayY * 0.8;
        targetRot.y -= swayX;

        // Weapon Bobbing (Breathing)
        const bobFactor = Math.sin(time * 1.5) * 0.04;
        targetPos.y += bobFactor;
        targetRot.z += Math.cos(time * 0.8) * 0.015;
    }

    gunGroup.position.lerp(targetPos, gunDamping);
    gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, targetRot.x, gunDamping);
    gunGroup.rotation.y = THREE.MathUtils.lerp(gunGroup.rotation.y, targetRot.y, gunDamping);
    gunGroup.rotation.z = THREE.MathUtils.lerp(gunGroup.rotation.z, targetRot.z, gunDamping);

    // RECOIL LOGIC
    if (scene.userData.lastRecoil === undefined) scene.userData.lastRecoil = animState.triggerRecoil;
    if (animState.triggerRecoil > scene.userData.lastRecoil) {
        scene.userData.lastRecoil = animState.triggerRecoil;
        // Reuse pre-allocated vector — no alloc on gun fire
        _vKick.set(0, 0, 1.6).applyEuler(gunGroup.rotation);
        gunGroup.position.add(_vKick);
        gunGroup.rotation.x += 0.75;
        gunGroup.rotation.z += (Math.random() - 0.5) * 0.4;
        scene.userData.cameraShake = 0.8;
    }

    // PUMP RACK LOGIC
    if (scene.userData.lastRack === undefined) scene.userData.lastRack = animState.triggerRack;
    const pump = context.pumpMesh;
    if (pump) {
        if (animState.triggerRack > scene.userData.lastRack) {
            scene.userData.lastRack = animState.triggerRack;
            scene.userData.rackStartTime = time;
        }

        const rackElapsed = time - (scene.userData.rackStartTime || 0);
        const rackDuration = 0.6;
        if (rackElapsed < rackDuration) {
            const p = rackElapsed / rackDuration;
            const curve = p < 0.3 ? (p / 0.3) : (1 - (p - 0.3) / 0.7);
            pump.position.z = 4.5 - curve * 1.5;
        } else {
            pump.position.z = 4.5;
        }
    }

    if (gunGroup.userData.isSawing) {
        const timeScale = dt / 0.0166;
        gunGroup.position.x += Math.sin(time * 150) * 0.08 * timeScale;
        gunGroup.position.y += Math.cos(time * 120) * 0.05 * timeScale;
        gunGroup.rotation.z += Math.sin(time * 80) * 0.1 * timeScale;
    }

    // --- CAMERA POSITIONING ---
    if (!scene.userData._targetCamPos) scene.userData._targetCamPos = new THREE.Vector3();
    const targetCamPos = scene.userData._targetCamPos;

    // Phase change detection for instant snapping to prevent clipping/grey screen/gliding
    if (scene.userData.lastPhase === undefined) scene.userData.lastPhase = phase;
    if (scene.userData.lastPhase !== phase) {
        if (phase === 'LOAD' || phase === 'LOOTING') {
            camera.position.set(0, 3.8, 12);
            targetCamPos.set(0, 3.8, 12);
            if (!scene.userData._curLookAt) {
                scene.userData._curLookAt = new THREE.Vector3(0, 1.5, -2);
            } else {
                scene.userData._curLookAt.set(0, 1.5, -2);
            }
            camera.rotation.set(0, 0, 0);
            camera.lookAt(0, 1.5, -2);
            scene.userData.cameraShake = 0;
            scene.userData.needsRecovery = false;
            scene.userData.hasPlayedDrop = false;
            scene.userData.hasPlayedStand = false;
            scene.userData.recoveryStartTime = null;
        }
        scene.userData.lastPhase = phase;
    }

    const pSwayX = Math.sin(time * 0.5) * 0.8;
    const pSwayY = Math.cos(time * 0.3) * 0.3;

    if (animState.playerHit) {
        targetCamPos.set(2.8, 0.8, 10.5);
    } else if (cameraView === 'TABLE') {
        targetCamPos.set(0, 10, 4);
    } else if (cameraView === 'DEALER_GUN') {
        // Look at the dealer holding the gun
        targetCamPos.set(pSwayX * 0.5 - 4, 3 + pSwayY * 0.2, 5);
    } else if (phase === 'LOAD' || phase === 'LOOTING') {
        // Force player's default POV during load/looting
        targetCamPos.set(pSwayX * 0.5, 3.8 + pSwayY, 12);
    } else if (turnOwner === 'DEALER') {
        if (aimTarget === 'OPPONENT') {
            targetCamPos.set(pSwayX * 0.1, 1.0 + pSwayY * 0.1, 3.5); // Closer & lower
        } else {
            targetCamPos.set(pSwayX, 4 + pSwayY, 11);
        }
    } else if (turnOwner === 'PLAYER3') {
        const sidePos = scene.userData.player3Side || 'left';
        const sideX = sidePos === 'left' ? -3 : 3;
        targetCamPos.set(sideX, 3.0 + pSwayY * 0.1, 5);
    } else if (turnOwner === 'PLAYER4') {
        targetCamPos.set(3, 3.0 + pSwayY * 0.1, 5);
    } else if (turnOwner === 'PLAYER') {
        if (aimTarget === 'SELF') {
            targetCamPos.set(0, 2.3, 10.2 - heartbeatPulse * 0.25);
        } else if (aimTarget === 'OPPONENT') {
            targetCamPos.set(2.5 + pSwayX * 0.1, 3.0 + pSwayY * 0.1, 9); // Lower, closer shoulder
        } else if (aimTarget === 'LEFT') {
            targetCamPos.set(2.0, 3.0, 8.5); // Look Left
        } else if (aimTarget === 'RIGHT') {
            targetCamPos.set(-2.0, 3.0, 8.5); // Look Right
        } else {
            targetCamPos.set(pSwayX * 0.5, 3.8 + pSwayY, 12); // Closer to table
        }
    }

    camera.position.lerp(targetCamPos, 1 - Math.exp(-5.0 * dt));
    // Dynamic lookAt with sway
    if (!scene.userData._lookAtPosTemp) scene.userData._lookAtPosTemp = new THREE.Vector3(0, 2, -5);
    const lookAtPos = scene.userData._lookAtPosTemp.set(0, 2, -5);
    if (animState.playerHit) {
        lookAtPos.set(-0.5, 3.8, -8);
    } else if (cameraView === 'TABLE') {
        lookAtPos.set(0, 0, 0);
    } else if (cameraView === 'DEALER_GUN') {
        lookAtPos.set(-0.5, 2, -6); // Look at dealer's chest/gun area
    } else if (cameraView === 'PLAYER3_GUN') {
        const sidePos = scene.userData.player3Side || 'left';
        const sideX = sidePos === 'left' ? -8 : 8;
        lookAtPos.set(sideX, 2, -2);
    } else if (cameraView === 'PLAYER4_GUN') {
        lookAtPos.set(8, 2, -2);
    } else if (phase === 'LOAD' || phase === 'LOOTING') {
        // Force player's lookAt target during load/looting
        lookAtPos.set(0, 1.5, -2);
    } else if (turnOwner === 'DEALER') {
        if (aimTarget === 'OPPONENT') {
            lookAtPos.set(-0.5, 2.5, -8); // Look closer at dealer face
        } else {
            lookAtPos.set(0, 2, -14);
        }
    } else if (turnOwner === 'PLAYER3') {
        const sidePos = scene.userData.player3Side || 'left';
        const sideX = sidePos === 'left' ? -8 : 8;
        lookAtPos.set(sideX, 1.5, -2);
    } else if (turnOwner === 'PLAYER4') {
        lookAtPos.set(8, 1.5, -2);
    } else if (turnOwner === 'PLAYER') {
        if (aimTarget === 'SELF') {
            const shakeX = (Math.sin(time * 45) * 0.015) * (1.0 + heartbeatPulse * 3.0);
            const shakeY = (Math.cos(time * 50) * 0.015) * (1.0 + heartbeatPulse * 3.0);
            lookAtPos.set(shakeX, 1.8 + shakeY, 8.5); // Focus directly on gun barrel at Z=8.5 with jitter
        } else if (aimTarget === 'OPPONENT') {
            lookAtPos.set(0, 1.5, -14); // Look at dealer chest/barrel
        } else if (aimTarget === 'LEFT') {
            lookAtPos.set(-8, 1.5, -2); // Look at left player
        } else if (aimTarget === 'RIGHT') {
            lookAtPos.set(8, 1.5, -2); // Look at right player
        } else {
            lookAtPos.set(0, 1.5, -2);
        }
    }

    // Smoothly interpolate where the camera is looking
    if (!scene.userData._curLookAt) scene.userData._curLookAt = new THREE.Vector3(0, 2, 0);
    scene.userData._curLookAt.lerp(lookAtPos, 1 - Math.exp(-3.7 * dt));
    camera.lookAt(scene.userData._curLookAt);


    if (animState.playerHit) {
        // Falling over - Dramatic Instant Drop
        if (!scene.userData.hasPlayedDrop) {
            audioManager.playSound('dropping');
            scene.userData.hasPlayedDrop = true;
            scene.userData.hasPlayedStand = false;
            scene.userData.recoveryStartTime = null;
        }
        targetCamPos.set(2.8, 0.8, 10.5); // Hit floor (slumped above table)
        camera.rotation.z = -0.7 + (Math.random() * 0.1);
        scene.userData.cameraShake = 0.5;
        scene.userData.needsRecovery = true;
    } else if (animState.playerRecovering || (scene.userData.needsRecovery && !animState.playerHit)) {
        // Recovering (Stand up slowly) - Groggy effect
        if (!scene.userData.hasPlayedStand) {
            audioManager.playSound('standing');
            scene.userData.hasPlayedStand = true;
            scene.userData.recoveryStartTime = time;
        }

        const recoveryDuration = 2.5; // seconds
        const recoveryElapsed = time - (scene.userData.recoveryStartTime || time);
        const recoveryProgress = Math.min(1, recoveryElapsed / recoveryDuration);

        const recoverSpeed = 0.015 + (recoveryProgress * 0.025);
        camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0, recoverSpeed);

        const wobbleIntensity = 1 - (recoveryProgress * 0.7);
        camera.rotation.z += Math.sin(time * 3) * 0.004 * wobbleIntensity;
        camera.rotation.x += Math.cos(time * 2.5) * 0.003 * wobbleIntensity;

        if (recoveryProgress < 0.5) {
            scene.userData.cameraShake = 0.05 * (1 - recoveryProgress * 2);
        }

        if (recoveryProgress >= 1) {
            scene.userData.needsRecovery = false;
            scene.userData.hasPlayedDrop = false;
            scene.userData.recoveryStartTime = null;
        }
    } else {
        scene.userData.hasPlayedDrop = false;
        scene.userData.recoveryStartTime = null;
        scene.userData.needsRecovery = false;
    }

    // Camera Lerp - Cinematic and Smooth (3.0 speed)
    const camDamping = 1 - Math.exp(-3.0 * dt);
    camera.position.x += (targetCamPos.x - camera.position.x) * camDamping;
    camera.position.y += (targetCamPos.y - camera.position.y) * camDamping;
    camera.position.z += (targetCamPos.z - camera.position.z) * camDamping;

    // Breathing - Reduced on Mobile
    if (aimTarget !== 'SELF' && cameraView !== 'TABLE') {
        // Significantly reduced intensity for mobile (0.01 vs 0.05) to allow "some" life but avoid nausea
        const breathAmp = isMobile ? 0.01 : 0.05;
        const breathY = Math.sin(time * 0.5) * breathAmp;
        camera.position.y += breathY;
    }

    // Shake
    // Camera Shake Logic - Dampen for mobile
    let shake = scene.userData.cameraShake || 0;
    const shakeCap = isMobile ? 0.4 : 1.5;
    if (shake > shakeCap) shake = shakeCap;

    if (shake > 0) {
        // Reduced frequency multiplier for mobile
        const jitter = isMobile ? 0.6 : 1.0;
        const posPower = shake * jitter * 0.8;
        const rotPower = shake * jitter * 0.15; // New Rotational Shake

        camera.position.x += (Math.random() - 0.5) * posPower;
        camera.position.y += (Math.random() - 0.5) * posPower;
        camera.position.z += (Math.random() - 0.5) * posPower * 0.5;

        // Add Cinematic Rotation Shake
        camera.rotation.z += (Math.random() - 0.5) * rotPower;
        camera.rotation.x += (Math.random() - 0.5) * rotPower * 0.5;

        // Time-based decay 
        const decay = Math.pow(0.1, dt);
        shake *= decay;
        if (shake < 0.01) shake = 0;
        scene.userData.cameraShake = shake;
    }

    // Dealer Animation - Enhanced with better drop/recovery
    // --- SPAWN PARTICLES ---
    // Dealer Animation - Enhanced with better drop/recovery
    const baseY = gameState.isMultiplayer ? -4.5 : 3.0;
    let dealerTargetY = dealerGroup.userData.targetY ?? (baseY + Math.sin(time) * 0.05);

    // Sync Health Bar if it's a Player Model (Multiplayer)
    if (dealerGroup.userData.hpFill) {
        const hpFill = dealerGroup.userData.hpFill as THREE.Mesh;
        const maxHp = dealerGroup.userData.maxHp || 4;
        const currentHp = props.dealer.hp;
        const targetScaleX = Math.max(0, currentHp / maxHp);
        hpFill.scale.x = THREE.MathUtils.lerp(hpFill.scale.x, targetScaleX, 1 - Math.exp(-6.3 * dt));
        const hpWidth = (hpFill.scale.x) * 3.8;
        hpFill.position.x = (hpWidth - 3.8) / 2;
    }

    // DEALER RECOVERY ANIMATION
    if (animState.dealerRecovering && !animState.dealerDropping) {
        const wobble = Math.sin(time * 4) * 0.15;
        if (!scene.userData.dealerRecoveryStart) {
            scene.userData.dealerRecoveryStart = time;
        }
        const recoveryProgress = Math.min(1, (time - scene.userData.dealerRecoveryStart) / 1.5);
        dealerTargetY = baseY + wobble * (1 - recoveryProgress);
    } else if (animState.dealerDropping) {
        scene.userData.dealerRecoveryStart = null;
    } else {
        scene.userData.dealerRecoveryStart = null;
    }

    const dealerSpeed = animState.dealerRecovering ? 4.0 : 12.0;
    const dealerDamping = 1 - Math.exp(-dealerSpeed * dt);
    dealerGroup.position.y += (dealerTargetY - dealerGroup.position.y) * dealerDamping;

    const player3Group = scene.userData.cachedPlayer3Group || scene.getObjectByName('PLAYER3');
    if (!scene.userData.cachedPlayer3Group) scene.userData.cachedPlayer3Group = player3Group;
    if (player3Group) {
        const p3BaseY = -4.5;
        let p3TargetY = p3BaseY;
        if (animState.player3Hit) {
            p3TargetY = -8.0;
        } else if (animState.player3Recovering) {
            const wobble = Math.sin(time * 4) * 0.15;
            if (!scene.userData.player3RecoveryStart) {
                scene.userData.player3RecoveryStart = time;
            }
            const recoveryProgress = Math.min(1, (time - scene.userData.player3RecoveryStart) / 1.5);
            p3TargetY = p3BaseY + wobble * (1 - recoveryProgress);
        } else {
            scene.userData.player3RecoveryStart = null;
            p3TargetY = p3BaseY + Math.sin(time * 0.9) * 0.05;
        }

        const p3Speed = animState.player3Recovering ? 4.0 : 12.0;
        const p3Damping = 1 - Math.exp(-p3Speed * dt);
        player3Group.position.y += (p3TargetY - player3Group.position.y) * p3Damping;

        const p3Head = scene.userData.cachedPlayer3Head || player3Group.getObjectByName("HEAD");
        if (!scene.userData.cachedPlayer3Head) scene.userData.cachedPlayer3Head = p3Head;
        if (p3Head) {
            p3Head.rotation.y = THREE.MathUtils.lerp(p3Head.rotation.y, -mouse.x * 0.2, 1 - Math.exp(-3.1 * dt));
            p3Head.rotation.x = THREE.MathUtils.lerp(p3Head.rotation.x, mouse.y * 0.1, 1 - Math.exp(-3.1 * dt));
        }
    }

    const player4Group = scene.userData.cachedPlayer4Group || scene.getObjectByName('PLAYER4');
    if (!scene.userData.cachedPlayer4Group) scene.userData.cachedPlayer4Group = player4Group;
    if (player4Group) {
        const p4BaseY = -4.5;
        let p4TargetY = p4BaseY;
        if (animState.player4Hit) {
            p4TargetY = -8.0;
        } else if (animState.player4Recovering) {
            const wobble = Math.sin(time * 4) * 0.15;
            if (!scene.userData.player4RecoveryStart) {
                scene.userData.player4RecoveryStart = time;
            }
            const recoveryProgress = Math.min(1, (time - scene.userData.player4RecoveryStart) / 1.5);
            p4TargetY = p4BaseY + wobble * (1 - recoveryProgress);
        } else {
            scene.userData.player4RecoveryStart = null;
            p4TargetY = p4BaseY + Math.sin(time * 0.9) * 0.05;
        }

        const p4Speed = animState.player4Recovering ? 4.0 : 12.0;
        const p4Damping = 1 - Math.exp(-p4Speed * dt);
        player4Group.position.y += (p4TargetY - player4Group.position.y) * p4Damping;

        const p4Head = scene.userData.cachedPlayer4Head || player4Group.getObjectByName("HEAD");
        if (!scene.userData.cachedPlayer4Head) scene.userData.cachedPlayer4Head = p4Head;
        if (p4Head) {
            p4Head.rotation.y = THREE.MathUtils.lerp(p4Head.rotation.y, -mouse.x * 0.2, 1 - Math.exp(-3.1 * dt));
            p4Head.rotation.x = THREE.MathUtils.lerp(p4Head.rotation.x, mouse.y * 0.1, 1 - Math.exp(-3.1 * dt));
        }
    }

    if (!scene.userData.cachedHeadGroup) scene.userData.cachedHeadGroup = dealerGroup.getObjectByName("HEAD");
    const headGroup = scene.userData.cachedHeadGroup;
    if (headGroup) {
        if (scene.userData.isMobile) {
            // Mobile: idle sine waves layered ON TOP of touch position
            // Taps still move the head suddenly; idle keeps it alive between touches
            const idleY = Math.sin(time * 0.16) * 0.028 + Math.sin(time * 0.10 + 1.3) * 0.014;
            const idleX = Math.sin(time * 0.13 + 0.7) * 0.008 + Math.sin(time * 0.07 + 2.1) * 0.004;
            headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, -mouse.x * 0.08 + idleY, 1 - Math.exp(-1.8 * dt));
            headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, mouse.y * 0.01 + idleX, 1 - Math.exp(-1.8 * dt));
        } else {
            // Desktop: follow mouse cursor
            headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, -mouse.x * 0.08, 1 - Math.exp(-3.1 * dt));
            headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, mouse.y * 0.01, 1 - Math.exp(-3.1 * dt));
        }

        // ENHANCED RED EYES - Skip for Player Model
        // Cache eye lights and pupils once to avoid per-frame instanceof checks
        if (!gameState.isMultiplayer) {
            if (!scene.userData._cachedEyeLights) {
                const eyeLights: THREE.PointLight[] = [];
                const pupils: THREE.Mesh[] = [];
                headGroup.children.forEach((child: THREE.Object3D) => {
                    if (child instanceof THREE.PointLight) eyeLights.push(child);
                    if (child instanceof THREE.Mesh && (child.name === 'LEFT_PUPIL' || child.name === 'RIGHT_PUPIL')) pupils.push(child as THREE.Mesh);
                });
                scene.userData._cachedEyeLights = eyeLights;
                scene.userData._cachedPupils = pupils;
            }
            const eyeLights = scene.userData._cachedEyeLights as THREE.PointLight[];
            const pupils = scene.userData._cachedPupils as THREE.Mesh[];
            const basePulse = 4.0 + Math.sin(time * 4) * 2.0;
            const heartbeat = Math.sin(time * 8) > 0.7 ? 3.0 : 0;
            const randomFlicker = Math.random() > 0.85 ? Math.random() * 4 : 0;
            const eyeIntensity = (basePulse + heartbeat + randomFlicker) * brightnessMult;
            const glowBase = 0.85 + Math.sin(time * 5) * 0.15;
            for (let _ei = 0; _ei < eyeLights.length; _ei++) {
                eyeLights[_ei].intensity = eyeIntensity;
                eyeLights[_ei].color.setRGB(1, 0, 0);
            }
            for (let _pi = 0; _pi < pupils.length; _pi++) {
                (pupils[_pi].material as THREE.MeshBasicMaterial).color.setRGB(glowBase, 0, 0);
            }
        }
    }

    if (!gameState.isMultiplayer) {
        if (!scene.userData.cachedFaceLight) scene.userData.cachedFaceLight = dealerGroup.getObjectByName("FACE_LIGHT");
        const faceLight = scene.userData.cachedFaceLight as THREE.PointLight;
        if (faceLight) {
            const pulse = 2.0 + Math.sin(time * 1.2) * 0.6;
            const flicker = Math.random() > 0.90 ? Math.random() * 1.5 : 0;
            faceLight.intensity = (pulse + flicker) * brightnessMult;
        }
    }

    if (underLight) {
        const flicker = Math.random() > 0.95 ? Math.random() * 2.0 : 2.0;
        underLight.intensity = THREE.MathUtils.lerp(underLight.intensity, flicker, 1 - Math.exp(-3.1 * dt)) * brightnessMult;
    }

    // --- SPAWN PARTICLES ---

    // Blood Spawn (Dealer Hit)
    // Blood Spawn (Dealer Hit or Player Hit)
    const isDealerHit = animState.dealerHit;
    const isPlayerHit = animState.playerHit;
    const isPlayer3Hit = animState.player3Hit;

    if ((isDealerHit || isPlayerHit || isPlayer3Hit) && (!scene.userData.isLowEndDevice || Math.random() > 0.5)) {
        const bPos = bloodParticles.geometry.attributes.position.array as Float32Array;
        const bVel = bloodParticles.geometry.attributes.velocity.array as Float32Array;
        // Increase spawn rate for more "splash"
        const spawnRate = scene.userData.isMobile ? 4 : 15;
        const len = bPos.length / 3;

        let spawnCount = 0;
        const startIdx = Math.floor(Math.random() * len);

        for (let k = 0; k < len; k++) {
            const i = (startIdx + k) % len;
            if (bPos[i * 3 + 1] > 100) {
                if (isDealerHit) {
                    // Dealer Head (-13z)
                    bPos[i * 3] = (Math.random() - 0.5) * 1.5;
                    bPos[i * 3 + 1] = 5.0 + (Math.random() - 0.5) * 1.5;
                    bPos[i * 3 + 2] = -13.0 + (Math.random() - 0.5) * 1.0;

                    // Explode OUTWARDS from head
                    bVel[i * 3] = (Math.random() - 0.5) * 8.0;
                    bVel[i * 3 + 1] = Math.random() * 5.0 + 2.0;
                    bVel[i * 3 + 2] = Math.random() * 8.0 + 2.0; // Towards player
                } else if (isPlayerHit) {
                    // Player Hit (near camera)
                    bPos[i * 3] = (Math.random() - 0.5) * 2.0;
                    bPos[i * 3 + 1] = 2.0 + (Math.random() - 0.5) * 1.0;
                    bPos[i * 3 + 2] = 8.0;

                    bVel[i * 3] = (Math.random() - 0.5) * 5.0;
                    bVel[i * 3 + 1] = Math.random() * 4.0;
                    bVel[i * 3 + 2] = -Math.random() * 5.0; // Away from camera? Or towards? Mostly just down/messy
                } else if (isPlayer3Hit) {
                    const sidePos = scene.userData.player3Side || 'left';
                    const sideX = sidePos === 'left' ? -8 : 8;
                    bPos[i * 3] = sideX + (Math.random() - 0.5) * 1.5;
                    bPos[i * 3 + 1] = 3.0 + (Math.random() - 0.5) * 1.5;
                    bPos[i * 3 + 2] = -2.0 + (Math.random() - 0.5) * 1.0;

                    bVel[i * 3] = (sidePos === 'left' ? 1 : -1) * (Math.random() * 5.0 + 2.0);
                    bVel[i * 3 + 1] = Math.random() * 5.0 + 2.0;
                    bVel[i * 3 + 2] = (Math.random() - 0.5) * 5.0;
                }

                spawnCount++;
                if (spawnCount >= spawnRate) break;
            }
        }
        bloodParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Sparks (Sawing)
    if (animState.isSawing || animState.triggerSparks > 0) {
        const sPos = sparkParticles.geometry.attributes.position.array as Float32Array;
        const sVel = sparkParticles.geometry.attributes.velocity.array as Float32Array;
        const isPlayer = props.turnOwner === 'PLAYER';
        const sparkZOffset = isPlayer ? 4.5 : -4.5;

        for (let k = 0; k < 2; k++) {
            for (let i = 0; i < sPos.length / 3; i++) {
                if (sPos[i * 3] > 100) {
                    sPos[i * 3] = gunGroup.position.x + (Math.random() - 0.5) * 0.5;
                    sPos[i * 3 + 1] = gunGroup.position.y + 0.5;
                    sPos[i * 3 + 2] = gunGroup.position.z + sparkZOffset + (Math.random() - 0.5) * 1.5;
                    sVel[i * 3] = (Math.random() - 0.5) * 0.2;
                    sVel[i * 3 + 1] = Math.random() * 0.2 + 0.1;
                    sVel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
                    break;
                }
            }
        }
        sparkParticles.geometry.attributes.position.needsUpdate = true;
    }

    // --- ITEM ANIMATIONS ---
    if (shouldUpdateHeavyEffects) {
        updateItemAnimations(context, props, time, dt);
    }

    // Muzzle Flash Randomness — index loop to avoid per-frame closure alloc
    if (muzzleFlash.visible) {
        for (let _fi = 0; _fi < muzzleFlash.children.length; _fi++) {
            const mesh = muzzleFlash.children[_fi] as THREE.Mesh;
            const mat = mesh.material as THREE.Material;
            if (mat && mat.opacity > 0.01) {
                mesh.scale.setScalar(1.0 + Math.random() * 0.5);
                mesh.rotation.z += Math.random() * 0.5;
            }
        }
    }

    if (shouldUpdateHeavyEffects) {
        updateBlood(bloodParticles, dt);
    }

    if (animState.playerHit || animState.dealerHit || animState.player3Hit) {
        bloodParticles.visible = true;
    }

    if (shouldUpdateHeavyEffects) {
        updateSparks(sparkParticles, dt);
    }
    if (!reduceEffects || bulletMesh.visible) {
        updateBullet(bulletMesh, dt);
    }

    if (shellCasings && shellVelocities && shouldUpdateHeavyEffects) {
        for (let i = 0; i < shellCasings.length; i++) {
            updateShell(shellCasings[i], shellVelocities[i], time, dt);
        }
    }

    // Track frame performance for debug monitoring
    performanceMonitor.updateFrame();

    renderer.render(scene, camera);
}
