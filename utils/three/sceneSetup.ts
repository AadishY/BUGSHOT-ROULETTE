import * as THREE from 'three';
import { SceneContext } from '../../types';
import { getDeviceType } from '../gameUtils';
import { setupLighting, createTable, createGunModel, createDealerModel, createPlayerAvatar, createProjectiles, createEnvironment, createDust, createBeerCan, createCigarette, createSaw, createHandcuffs, createMagnifyingGlass, createPhone, createInverter, createAdrenaline, createRemote, createBigInverter, createContract, createLuckycharm, createFlashbang, createCrusher, createTotem, createMirror, createTarotCard } from '../threeHelpers';


export const cleanScene = (scene: THREE.Scene) => {

    scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach((mat) => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        }
    });
};

export const initThreeScene = (container: HTMLElement, props: any): SceneContext | null => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return null;

    const scene = new THREE.Scene();
    // Visible dark background - NOT black so you can always see something
    scene.background = new THREE.Color(0x151210);

    const defaultFov = 85;
    const camera = new THREE.PerspectiveCamera(props.settings.fov || defaultFov, width / height, 0.1, 100);
    
    // Position camera instantly at its starting view location to avoid gliding from afar in the grey fog at startup
    const initialCamPos = new THREE.Vector3(0, 3.8, 12); // Default player view
    const pSwayX = 0;
    const pSwayY = 0;
    if (props.cameraView === 'TABLE') {
        initialCamPos.set(0, 10, 4);
    } else if (props.cameraView === 'DEALER_GUN') {
        initialCamPos.set(pSwayX * 0.5 - 4, 3 + pSwayY * 0.2, 5);
    } else if (props.turnOwner === 'DEALER') {
        if (props.aimTarget === 'OPPONENT') {
            initialCamPos.set(pSwayX * 0.1, 1.0 + pSwayY * 0.1, 3.5);
        } else {
            initialCamPos.set(pSwayX, 4 + pSwayY, 11);
        }
    } else if (props.turnOwner === 'PLAYER') {
        if (props.aimTarget === 'SELF') {
            initialCamPos.set(0, 2.3, 10.2);
        } else if (props.aimTarget === 'OPPONENT') {
            initialCamPos.set(2.5 + pSwayX * 0.1, 3.0 + pSwayY * 0.1, 9);
        } else {
            initialCamPos.set(pSwayX * 0.5, 3.8 + pSwayY, 12);
        }
    }
    camera.position.copy(initialCamPos);

    // Pre-calculate initial look-at coordinates so camera initializes pointing at the correct target immediately
    const initialLookAt = new THREE.Vector3(0, 2, -5);
    if (props.cameraView === 'TABLE') {
        initialLookAt.set(0, 0, 0);
    } else if (props.cameraView === 'DEALER_GUN') {
        initialLookAt.set(-0.5, 2, -6);
    } else if (props.turnOwner === 'DEALER') {
        if (props.aimTarget === 'OPPONENT') {
            initialLookAt.set(-0.5, 2.5, -8);
        } else {
            initialLookAt.set(0, 2, -14);
        }
    } else if (props.turnOwner === 'PLAYER') {
        if (props.aimTarget === 'SELF') {
            initialLookAt.set(0, 1.8, 8.5);
        } else if (props.aimTarget === 'OPPONENT') {
            initialLookAt.set(0, 1.5, -14);
        } else {
            initialLookAt.set(0, 1.5, -2);
        }
    }
    camera.lookAt(initialLookAt);
    scene.userData._curLookAt = initialLookAt.clone();

    // Device Detection & Optimization Profiles
    const device = getDeviceType();
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = device === 'mobile';
    const isTablet = device === 'tablet';
    const isAndroid = userAgent.includes('android');
    const pixelRatio = window.devicePixelRatio || 1;

    // Aggressive Low-End Check
    const isLowEndDevice = (isMobile && (isAndroid || width < 600 || pixelRatio < 2 || navigator.hardwareConcurrency < 6)) || !!props.settings.ultraPerformance || !!props.settings.balancedPerformance;

    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance', // Try high perf first
        alpha: false,
        stencil: false,
        depth: true, // Keep depth
        precision: (isMobile || props.settings.ultraPerformance) ? 'lowp' : 'mediump' // Standardize across devices for consistency
    });



    // Mobile Optimization: Aggressive resolution scaling
    let mobilePixelScale = 2; // Default mobile
    if (isMobile) {
        mobilePixelScale = props.settings.ultraPerformance ? 5.5 : (props.settings.balancedPerformance ? 4.5 : (isLowEndDevice ? 4.5 : 3.5));
    } else if (isTablet) {
        mobilePixelScale = props.settings.ultraPerformance ? 4.0 : (props.settings.balancedPerformance ? 3.0 : 2.2);
    }

    // Desktop: default to 3 or user setting. Mobile: strictly optimized.
    const pixelScale = (isMobile || isTablet) ? mobilePixelScale : (props.settings.ultraPerformance ? 5.0 : (props.settings.balancedPerformance ? 4.0 : (props.settings.pixelScale || 3)));

    const maxPixelRatio = (isMobile || props.settings.ultraPerformance) ? 1.0 : (isTablet ? 1.2 : Math.min(window.devicePixelRatio, 2)); // Cap at 2x for desktop
    renderer.setPixelRatio(maxPixelRatio);
    renderer.setSize(width / pixelScale, height / pixelScale, false);

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.imageRendering = 'pixelated';

    // Disable shadows completely on ALL mobile/tablet devices or when ultraPerformance/balancedPerformance is active
    renderer.shadowMap.enabled = (device === 'pc') && !props.settings.ultraPerformance && !props.settings.balancedPerformance;
    renderer.shadowMap.type = (device === 'pc') ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;



    // Tone mapping
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.9;

    scene.userData.isMobile = isMobile;
    scene.userData.isAndroid = isAndroid;
    scene.userData.isLowEndDevice = isLowEndDevice;
    scene.userData.settings = props.settings; // Make settings accessible to other scripts

    container.appendChild(renderer.domElement);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const lights = setupLighting(scene, props.settings);
    // ... lights setup array ...
    const baseLights = [
        { light: lights.bulbLight, baseIntensity: lights.bulbLight?.intensity },
        { light: lights.gunSpot, baseIntensity: lights.gunSpot?.intensity },
        { light: lights.tableGlow, baseIntensity: lights.tableGlow?.intensity },
        { light: lights.rimLight, baseIntensity: lights.rimLight?.intensity },
        { light: lights.fillLight, baseIntensity: lights.fillLight?.intensity },
        { light: lights.ambient, baseIntensity: lights.ambient?.intensity },
        { light: lights.bgRim, baseIntensity: lights.bgRim?.intensity },
        { light: lights.dealerRim, baseIntensity: lights.dealerRim?.intensity },
        { light: lights.underLight, baseIntensity: lights.underLight?.intensity }
    ].filter(bl => bl.light) as { light: THREE.Light, baseIntensity: number }[];

    createEnvironment(scene, isMobile, props.settings.ultraPerformance);
    const dustParticles = createDust(scene, isMobile, props.settings.ultraPerformance);
    createTable(scene, props.settings.ultraPerformance);

    const { gunGroup, barrelMesh, shortBarrelMesh, sawCut, muzzleFlash, pump, magTube, shortMagTube, chokeMesh, sight, sSight } = createGunModel(scene);

    // Gun Light
    const gunLight = new THREE.PointLight(0xffeebb, 0, 15);
    gunLight.position.set(0, 0.5, 0);
    gunGroup.add(gunLight);

    // Items
    const itemBeer = createBeerCan(); itemBeer.visible = false; scene.add(itemBeer);
    const itemCigs = createCigarette(); itemCigs.visible = false; scene.add(itemCigs);
    const itemSaw = createSaw(); itemSaw.visible = false; scene.add(itemSaw);
    const itemCuffs = createHandcuffs(); itemCuffs.visible = false; scene.add(itemCuffs);
    const itemGlass = createMagnifyingGlass(); itemGlass.visible = false; scene.add(itemGlass);
    const itemPhone = createPhone(); itemPhone.visible = false; scene.add(itemPhone);
    const itemInverter = createInverter(); itemInverter.visible = false; scene.add(itemInverter);
    const itemAdrenaline = createAdrenaline(); itemAdrenaline.visible = false; scene.add(itemAdrenaline);
    const itemRemote = createRemote(); itemRemote.visible = false; scene.add(itemRemote);
    const itemBigInverter = createBigInverter(); itemBigInverter.visible = false; scene.add(itemBigInverter);
    const itemContract = createContract(); itemContract.visible = false; scene.add(itemContract);
    const itemLuckycharm = createLuckycharm(); itemLuckycharm.visible = false; scene.add(itemLuckycharm);
    const itemFlashbang = createFlashbang(); itemFlashbang.visible = false; scene.add(itemFlashbang);
    const itemCrusher = createCrusher(); itemCrusher.visible = false; scene.add(itemCrusher);
    const itemTotem = createTotem(); itemTotem.visible = false; scene.add(itemTotem);
    const itemMirror = createMirror(); itemMirror.visible = false; scene.add(itemMirror);

    const itemDeckCards: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
        const card = createTarotCard('Death');
        card.visible = false;
        scene.add(card);
        itemDeckCards.push(card);
    }

    const itemLight = new THREE.PointLight(0xffffee, 0, 25);
    itemLight.position.set(0, 5, -12);
    scene.add(itemLight);

    const itemsGroup = { itemBeer, itemCigs, itemSaw, itemCuffs, itemGlass, itemPhone, itemInverter, itemAdrenaline, itemRemote, itemBigInverter, itemContract, itemLuckycharm, itemFlashbang, itemCrusher, itemTotem, itemMirror, itemLight };


    // Multiplayer vs Singleplayer representation
    const isMP = props.gameState?.isMultiplayer;
    let dealerGroup: THREE.Group;

    if (isMP) {
        // Opponent is another player
        const opponentName = props.gameState?.opponentName || 'OPPONENT';
        // Positioned lower so head aligns with dealer head height
        dealerGroup = createPlayerAvatar(scene, new THREE.Vector3(0, -4.5, -8), Math.PI, opponentName);
        dealerGroup.name = 'DEALER'; // Keep name 'DEALER' for animation logic compatibility
    } else {
        dealerGroup = createDealerModel(scene);
    }
    const playerAvatars: THREE.Group[] = [];

    const { bulletMesh: bMesh, shellCasing, shellCasings, shellVelocities } = createProjectiles(scene);

    // Add click listeners to Gun
    gunGroup.children.forEach(c => {
        c.userData.type = 'GUN';
    });

    // Particles - HEAVILY REDUCED for Mobile / Ultra Performance
    const particleCount = props.settings.ultraPerformance ? 2 : (isLowEndDevice ? 10 : (isMobile ? 25 : 100));
    const particles = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);
    const pVelocities = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);
    // Initialize off-screen and set varying colors
    for (let i = 0; i < particleCount; i++) {
        pPositions[i * 3] = 9999;
        pPositions[i * 3 + 1] = 9999;
        pPositions[i * 3 + 2] = 9999;

        // Varies from deep burgundy to rust-crimson
        pColors[i * 3] = 0.45 + Math.random() * 0.45;     // Red
        pColors[i * 3 + 1] = 0.02 + Math.random() * 0.06;  // Green
        pColors[i * 3 + 2] = 0.02 + Math.random() * 0.04;  // Blue
    }

    particles.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    particles.setAttribute('velocity', new THREE.BufferAttribute(pVelocities, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const pMat = new THREE.PointsMaterial({
        vertexColors: true,
        size: isMobile ? 1.2 : 1.8,
        transparent: true,
        opacity: 0.95,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });
    const bloodParticles = new THREE.Points(particles, pMat);
    // Don't frustrate culling
    bloodParticles.frustumCulled = false;
    scene.add(bloodParticles);

    const sparkCount = props.settings.ultraPerformance ? 2 : (isLowEndDevice ? 8 : (isMobile ? 20 : 80));
    const sparkGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(sparkCount * 3);
    const sVel = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount * 3; i++) sPos[i] = 9999;
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sparkGeo.setAttribute('velocity', new THREE.BufferAttribute(sVel, 3));
    const sMat = new THREE.PointsMaterial({ color: 0xffffcc, size: 0.3, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    const sparkParticles = new THREE.Points(sparkGeo, sMat);
    sparkParticles.frustumCulled = false;
    scene.add(sparkParticles);

    return {
        scene,
        camera,
        renderer,
        raycaster,
        mouse,
        gunGroup,
        dealerGroup,
        itemsGroup,
        shellCasing,
        bulletMesh: bMesh,
        bloodParticles,
        sparkParticles,
        dustParticles,
        bulbLight: lights.bulbLight,
        gunLight,
        underLight: lights.underLight,
        muzzleFlash,
        baseLights,
        shellCasings,
        shellVelocities,
        barrelMesh,
        shortBarrelMesh,
        sawCut,
        pumpMesh: pump,
        magTube,
        shortMagTube,
        sight,
        sSight,
        chokeMesh,
        muzzleLight: lights.muzzleLight,
        roomRedLight: lights.roomRedLight,
        nextShellIndex: 0,
        itemDeckCards
    };
};
