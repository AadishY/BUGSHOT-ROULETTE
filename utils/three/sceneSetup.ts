import * as THREE from 'three';
import { SceneContext } from '../../types';
import { setupLighting, createTable, createGunModel, createDealerModel, createPlayerAvatar, createProjectiles, createEnvironment, createDust, createBeerCan, createCigarette, createSaw, createHandcuffs, createMagnifyingGlass, createPhone, createInverter, createAdrenaline, createRemote, createBigInverter, createContract } from '../threeHelpers';



export const cleanObject = (object: THREE.Object3D) => {
    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
    });
};

export const cleanScene = (scene: THREE.Scene) => {
    cleanObject(scene);
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
    camera.position.set(0, 4, 14);

    // Device Detection & Optimization Profiles
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || width < 900;
    const isAndroid = userAgent.includes('android');
    const pixelRatio = window.devicePixelRatio || 1;

    // Aggressive Low-End Check
    // If it's Android, or low res, or has less than 4GB RAM (approx check via hardwareConcurrency < 8 usually means older CPU), consider low end
    const isLowEndDevice = isMobile && (isAndroid || width < 600 || pixelRatio < 2 || navigator.hardwareConcurrency < 6);

    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance', // Try high perf first
        alpha: false,
        stencil: false,
        depth: true, // Keep depth
        precision: 'mediump' // Standardize across devices for consistency
    });

    // Mobile Optimization: Aggressive resolution scaling
    let mobilePixelScale = 2; // Default mobile
    if (isLowEndDevice) mobilePixelScale = 3.5; // Even lower res for low-end (simulates ~270p-360p)

    // Desktop: default to 3 or user setting. Mobile: strictly optimized.
    const pixelScale = isMobile ? mobilePixelScale : (props.settings.pixelScale || 3);

    const maxPixelRatio = isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2); // Cap at 2x for desktop
    renderer.setPixelRatio(maxPixelRatio);
    renderer.setSize(width / pixelScale, height / pixelScale, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.imageRendering = 'pixelated'; // Essential for the look

    // Disable shadows completely on ALL mobile devices for max FPS
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;

    // Tone mapping
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.9;

    scene.userData.isMobile = isMobile;
    scene.userData.isAndroid = isAndroid;
    scene.userData.isLowEndDevice = isLowEndDevice;

    container.appendChild(renderer.domElement);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const lights = setupLighting(scene);
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

    createEnvironment(scene, isMobile);
    const dustParticles = createDust(scene, isMobile);
    createTable(scene);

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

    const itemLight = new THREE.PointLight(0xffffee, 0, 25);
    itemLight.position.set(0, 5, -12);
    scene.add(itemLight);

    const itemsGroup = { itemBeer, itemCigs, itemSaw, itemCuffs, itemGlass, itemPhone, itemInverter, itemAdrenaline, itemRemote, itemBigInverter, itemContract, itemLight };


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

    // Particles - HEAVILY REDUCED for Mobile
    // Mobile: 20 particles max. Low-end: 10. PC: 100
    const particleCount = isLowEndDevice ? 10 : (isMobile ? 25 : 100);
    const particles = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);
    const pVelocities = new Float32Array(particleCount * 3);
    // Initialize off-screen
    for (let i = 0; i < particleCount * 3; i++) pPositions[i] = 9999;

    particles.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    particles.setAttribute('velocity', new THREE.BufferAttribute(pVelocities, 3));

    const pMat = new THREE.PointsMaterial({
        color: 0xcc0000,
        size: 1.5,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });
    const bloodParticles = new THREE.Points(particles, pMat);
    // Don't frustrate culling
    bloodParticles.frustumCulled = false;
    scene.add(bloodParticles);

    const sparkCount = isLowEndDevice ? 8 : (isMobile ? 20 : 80);
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
        nextShellIndex: 0
    };
};
