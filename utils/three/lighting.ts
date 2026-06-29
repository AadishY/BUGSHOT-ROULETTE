import * as THREE from 'three';
import { getDeviceType } from '../gameUtils';
import { GameSettings } from '../../types';

export const setupLighting = (scene: THREE.Scene, settings?: GameSettings) => {
    // ═══════════════════════════════════════════════════════════════
    // BUCKSHOT ROULETTE STYLE LIGHTING - Dark Industrial Bunker
    // ═══════════════════════════════════════════════════════════════

    const device = getDeviceType();
    const isMobile = device === 'mobile' || !!settings?.ultraPerformance || !!settings?.balancedPerformance;
    const isTablet = device === 'tablet';

    // Slight fog for depth — reduced base density so realistic head scans aren't obscured
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.012);

    // Reduced ambient for high contrast - boost ambient slightly in Potato mode to prevent pitch blackness
    const ambientIntensity = settings?.ultraPerformance 
        ? 0.45 
        : (isMobile ? 0.25 : 0.15);
    const ambient = new THREE.AmbientLight(0x221111, ambientIntensity);
    scene.add(ambient);

    // ═══════════════════════════════════════════════════════════════
    // MAIN SPOTLIGHT - Essential (More Intense)
    // ═══════════════════════════════════════════════════════════════
    const mainSpotlight = new THREE.SpotLight(0xffddaa, isMobile ? 3500 : 5500);
    mainSpotlight.position.set(0, 18, -2);
    mainSpotlight.target.position.set(0, -1, 0);
    mainSpotlight.angle = 0.38;
    mainSpotlight.penumbra = 0.8;
    mainSpotlight.decay = 2.5;
    mainSpotlight.distance = 60;
    
    // Shadows: Only on PC (and not in balanced or ultra mode)
    mainSpotlight.castShadow = (device === 'pc') && !settings?.ultraPerformance && !settings?.balancedPerformance;
    mainSpotlight.shadow.mapSize.width = (settings?.balancedPerformance) ? 512 : 1024;
    mainSpotlight.shadow.mapSize.height = (settings?.balancedPerformance) ? 512 : 1024;
    mainSpotlight.shadow.bias = -0.0004;
    mainSpotlight.shadow.radius = 2.0;

    scene.add(mainSpotlight);
    scene.add(mainSpotlight.target);

    // Gun Spot - Essential (Brighter)
    const gunSpot = new THREE.SpotLight(0xffeedd, isMobile ? 800 : 1200);
    gunSpot.position.set(0, 15, 2);
    gunSpot.target.position.set(0, 0, 2);
    gunSpot.angle = 0.45;
    gunSpot.penumbra = 0.6;
    gunSpot.castShadow = (device === 'pc') && !settings?.ultraPerformance && !settings?.balancedPerformance;
    if (device === 'pc' && !settings?.ultraPerformance && !settings?.balancedPerformance) {
        gunSpot.shadow.mapSize.width = 512;
        gunSpot.shadow.mapSize.height = 512;
    }
    scene.add(gunSpot);
    scene.add(gunSpot.target);

    // Bulb - High Intensity Point
    const bulbLight = new THREE.PointLight(0xffaa44, isMobile ? 30.0 : 45.0, 50);
    bulbLight.position.set(0, 8, 0);
    bulbLight.castShadow = (device === 'pc') && !settings?.ultraPerformance && !settings?.balancedPerformance;
    if (device === 'pc' && !settings?.ultraPerformance && !settings?.balancedPerformance) {
        bulbLight.shadow.mapSize.width = 512;
        bulbLight.shadow.mapSize.height = 512;
        bulbLight.shadow.bias = -0.0001;
        bulbLight.shadow.radius = 4;
    }
    scene.add(bulbLight);

    // Dealer Rim - Essential for look (Stronger)
    const dealerRim = new THREE.SpotLight(0xff7700, isMobile ? 16 : 28);
    dealerRim.position.set(0, 14, -35);
    dealerRim.target.position.set(0, 4, -14);
    dealerRim.angle = 0.6;
    dealerRim.penumbra = 1.0;
    scene.add(dealerRim);
    scene.add(dealerRim.target);

    // Dynamic Game Lights - Essential
    const muzzleLight = new THREE.PointLight(0xffaa00, 0, 30);
    scene.add(muzzleLight);

    const roomRedLight = new THREE.PointLight(0xff0000, 0, 120);
    roomRedLight.position.set(0, 10, 0);
    scene.add(roomRedLight);

    const underLight = new THREE.PointLight(0xff1111, isMobile ? 3.0 : 6.0, 20);
    underLight.position.set(0, -2, -10);
    // Add on PC/Tablet always, or on Mobile if ultraPerformance is active
    if (device !== 'mobile') {
        scene.add(underLight);
    }

    const tableGlow = new THREE.PointLight(0x445533, 4.0, 15);
    tableGlow.position.set(0, 0, 0);
    if (device !== 'mobile') {
        scene.add(tableGlow);
    }

    // --- OPTIONAL LIGHTS ---
    let playerFill = null;
    let bgRim = null;
    let rimLight = null;
    if (!settings?.ultraPerformance) {
        // Rims (More colorful)
        bgRim = new THREE.SpotLight(0xff2200, 80);
        bgRim.position.set(20, 10, -25);
        bgRim.target.position.set(0, 2, -10);
        bgRim.angle = 1.0;
        bgRim.penumbra = 0.8;
        if (device === 'pc') {
            scene.add(bgRim);
            scene.add(bgRim.target);
        }

        const coldRim = new THREE.SpotLight(0x0044ff, 40); // Boosted cold rim
        coldRim.position.set(-20, 10, -25);
        coldRim.target.position.set(0, 2, -10);
        coldRim.angle = 1.0;
        coldRim.penumbra = 0.8;
        if (device !== 'mobile') {
            scene.add(coldRim);
            scene.add(coldRim.target);
        }

        // Fills
        playerFill = new THREE.DirectionalLight(0x1a2233, 0.25);
        playerFill.position.set(-5, 4, 15);
        if (device === 'pc') {
            scene.add(playerFill);
        }

        const sideFill = new THREE.PointLight(0x332222, 5, 40);
        sideFill.position.set(18, 2, 8);
        if (device === 'pc') {
            scene.add(sideFill);
        }

        rimLight = new THREE.SpotLight(0x442222, 10);
        rimLight.position.set(0, 12, -30);
        rimLight.lookAt(0, 5, -14);
        if (device === 'pc') {
            scene.add(rimLight);
        }

        // Environment Background Lights
        const hemiLight = new THREE.HemisphereLight(0x332222, 0x0a0a0a, 0.4);
        if (device !== 'mobile') {
            scene.add(hemiLight);
        }

        const deepBgLight = new THREE.PointLight(0x334455, 40, 120);
        deepBgLight.position.set(0, 12, -20);
        if (device !== 'mobile') {
            scene.add(deepBgLight);
        }

        const leftPropLight = new THREE.PointLight(0xaa6644, 25.0, 30);
        leftPropLight.position.set(-15, 2, 10);
        if (device === 'pc') {
            scene.add(leftPropLight);
        }

        const rightPropLight = new THREE.PointLight(0x4466aa, 25.0, 30);
        rightPropLight.position.set(15, 2, 10);
        if (device === 'pc') {
            scene.add(rightPropLight);
        }

        // Warm dramatic wall wash spotlight
        const playerWallWash = new THREE.SpotLight(0x775544, 40);
        playerWallWash.position.set(0, 18, -2);
        playerWallWash.target.position.set(0, 5, 18);
        playerWallWash.angle = 1.0;
        playerWallWash.penumbra = 0.5;
        if (device === 'pc') {
            scene.add(playerWallWash);
            scene.add(playerWallWash.target);
        }
    }

    // --- HEAVY LIGHTS (Desktop Only) ---
    if (device === 'pc' && !settings?.ultraPerformance && !settings?.balancedPerformance) {
        // Table Accents
        const tableAccent1 = new THREE.PointLight(0x44ff44, 1.5, 8);
        tableAccent1.position.set(-10, -0.5, 0);
        scene.add(tableAccent1);

        const tableAccent2 = new THREE.PointLight(0x44ff44, 1.5, 8);
        tableAccent2.position.set(10, -0.5, 0);
        scene.add(tableAccent2);

        // Player Spot
        const playerSpot = new THREE.SpotLight(0x443344, 3.0);
        playerSpot.position.set(0, 6, 10);
        playerSpot.target.position.set(0, -2, 6);
        playerSpot.angle = 0.9;
        playerSpot.penumbra = 1.0;
        scene.add(playerSpot);
        scene.add(playerSpot.target);

        const cornerLight1 = new THREE.PointLight(0x664433, 20, 50);
        cornerLight1.position.set(-12, 10, -12);
        scene.add(cornerLight1);

        const cornerLight2 = new THREE.PointLight(0x445577, 20, 50);
        cornerLight2.position.set(12, 10, -12);
        scene.add(cornerLight2);

        const backFlood = new THREE.DirectionalLight(0x554444, 0.5);
        backFlood.position.set(0, 15, 10);
        backFlood.target.position.set(0, 0, -25);
        scene.add(backFlood);
        scene.add(backFlood.target);

        const wallWash = new THREE.SpotLight(0x556677, 40);
        wallWash.position.set(0, 20, 5);
        wallWash.target.position.set(0, 0, -25);
        wallWash.angle = 1.0;
        wallWash.penumbra = 0.5;
        scene.add(wallWash);
        scene.add(wallWash.target);

        const leftWallLight = new THREE.PointLight(0x665544, 20, 40);
        leftWallLight.position.set(-15, 8, -8);
        scene.add(leftWallLight);

        const rightWallLight = new THREE.PointLight(0x445566, 20, 40);
        rightWallLight.position.set(15, 8, -8);
        scene.add(rightWallLight);

        const genSpot = new THREE.SpotLight(0xaaccff, 50);
        genSpot.position.set(15, 10, 0);
        genSpot.target.position.set(12, -3, -10);
        genSpot.angle = 0.5;
        genSpot.penumbra = 1;
        scene.add(genSpot);
        scene.add(genSpot.target);

        const cameraFill = new THREE.PointLight(0x443333, 10, 40);
        cameraFill.position.set(0, 10, 15);
        scene.add(cameraFill);
    }

    return {
        muzzleLight,
        roomRedLight,
        bulbLight,
        gunSpot,
        tableGlow,
        rimLight, 
        fillLight: playerFill, 
        ambient,
        bgRim, 
        dealerRim,
        underLight,
        mainSpotlight
    };
};
