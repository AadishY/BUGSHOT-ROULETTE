import * as THREE from 'three';

// Shared Geometries Cache
let beerBodyGeo: THREE.CylinderGeometry;
let beerRimGeo: THREE.CylinderGeometry;
let beerTabGeo: THREE.BoxGeometry;

export const createBeerCan = (): THREE.Group => {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc0000, metalness: 0.6, roughness: 0.3 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });

    if (!beerBodyGeo) {
        beerBodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16);
        beerRimGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.05, 16);
        beerTabGeo = new THREE.BoxGeometry(0.15, 0.02, 0.25);
    }

    // Can Body
    const can = new THREE.Mesh(beerBodyGeo, mat);
    can.castShadow = true;
    group.add(can);

    // Can Top/Rim
    const top = new THREE.Mesh(beerRimGeo, topMat);
    top.position.y = 0.6;
    group.add(top);

    const bottom = new THREE.Mesh(beerRimGeo, topMat);
    bottom.position.y = -0.6;
    group.add(bottom);

    // Tab
    const tab = new THREE.Mesh(beerTabGeo, topMat);
    tab.position.set(0, 0.63, 0);
    group.add(tab);

    group.name = 'ITEM_BEER';
    return group;
};

// Cigs Cache
let cigStickGeo: THREE.CylinderGeometry;
let cigFilterGeo: THREE.CylinderGeometry;
let cigTipGeo: THREE.CylinderGeometry;
let smokeGeo: THREE.SphereGeometry;

export const createCigarette = (): THREE.Group => {
    const group = new THREE.Group();

    if (!cigStickGeo) {
        cigStickGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
        cigFilterGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.25, 8);
        cigTipGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.05, 8);
        smokeGeo = new THREE.SphereGeometry(0.1, 4, 4);
    }

    // Main Stick
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const stick = new THREE.Mesh(cigStickGeo, stickMat);
    stick.rotation.z = Math.PI / 2;
    group.add(stick);

    // Filter
    const filterMat = new THREE.MeshStandardMaterial({ color: 0xd2691e }); // Chocolate/Orange
    const filter = new THREE.Mesh(cigFilterGeo, filterMat);
    filter.rotation.z = Math.PI / 2;
    filter.position.x = -0.525;
    group.add(filter);

    // Emissive Tip (for glow)
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x555555 }); // Grey ash start
    const tip = new THREE.Mesh(cigTipGeo, tipMat);
    tip.rotation.z = Math.PI / 2;
    tip.position.x = 0.425;
    tip.name = 'CIG_TIP';
    group.add(tip);

    // Smoke Particles (Pool)
    const smokeGroup = new THREE.Group();
    smokeGroup.name = 'SMOKE_POOL';
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0 }); // Shared material? No, opacity changes per particle?
    // Actually the logic uses opacity 0 initially.
    // If I share material, they all fade together? 
    // Usually particles need individual opacity if they fade individually.
    // In animations.ts/updateItemAnimations, it iterates children and changes opacity.
    // So they must have their own materials.

    for (let i = 0; i < 5; i++) {
        // Geometry shared, Material distinct
        const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
        smokeGroup.add(p);
    }
    smokeGroup.position.set(0.425, 0, 0); // At tip
    group.add(smokeGroup);

    group.name = 'ITEM_CIGS';
    return group;
};

export const createSaw = (): THREE.Group => {
    const group = new THREE.Group();

    // Handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 }); // Wood
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.15), handleMat);
    handle.position.set(-0.8, 0, 0);
    group.add(handle);

    // Metal Frame
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.05), metalMat);
    frame.position.set(0.2, 0.35, 0);
    group.add(frame);


    // Blade
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, roughness: 0.4 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.02), bladeMat);
    blade.position.set(0.2, -0.35, 0);
    group.add(blade);

    // Connector
    const conn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.05), metalMat);
    conn.position.set(1.2, 0, 0);
    group.add(conn);

    group.name = 'ITEM_SAW';
    return group;
};

export const createHandcuffs = (): THREE.Group => {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });

    const ring = new THREE.TorusGeometry(0.3, 0.04, 8, 24);
    const leftCuff = new THREE.Mesh(ring, metalMat);
    leftCuff.position.x = -0.35;
    group.add(leftCuff);

    const rightCuff = new THREE.Mesh(ring, metalMat);
    rightCuff.position.x = 0.35;
    group.add(rightCuff);

    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), metalMat);
    group.add(chain);

    group.name = 'ITEM_CUFFS';
    return group;
};

export const createMagnifyingGlass = (): THREE.Group => {
    const group = new THREE.Group();

    // Handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.0, 8), handleMat);
    handle.position.y = -0.8;
    group.add(handle);

    // Rim
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 12, 32), rimMat);
    group.add(rim);

    // Glass
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff, // Slight blue tint
        metalness: 0.1,
        roughness: 0.1,
        transparent: true,
        opacity: 0.3
    });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 32), glassMat);
    glass.rotation.x = Math.PI / 2;
    group.add(glass);

    group.name = 'ITEM_GLASS';
    return group;
};

export const createPhone = (): THREE.Group => {
    const group = new THREE.Group();
    // Body
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.1, 0.9);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Screen
    const screenGeo = new THREE.PlaneGeometry(0.4, 0.6);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x001133 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.rotation.x = -Math.PI / 2;
    screen.position.y = 0.06;
    screen.position.z = -0.05;
    screen.name = 'PHONE_SCREEN';
    group.add(screen);

    // Buttons area
    const btnArea = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    btnArea.rotation.x = -Math.PI / 2;
    btnArea.position.y = 0.06;
    btnArea.position.z = 0.35;
    group.add(btnArea);

    group.name = 'ITEM_PHONE';
    return group;
};

export const createInverter = (): THREE.Group => {
    const group = new THREE.Group();
    // Compact Device
    const baseGeo = new THREE.BoxGeometry(0.5, 0.2, 0.7);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    group.add(base);

    // Glowing core
    const coreGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.22, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc }); // Cyan glow
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.05;
    group.add(core);

    // Wires/Detail
    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 16), new THREE.MeshStandardMaterial({ color: 0xcc0000 }));
    wire.rotation.x = Math.PI / 2;
    wire.position.y = 0.11;
    group.add(wire);

    group.name = 'ITEM_INVERTER';
    return group;
};

export const createAdrenaline = (): THREE.Group => {
    const group = new THREE.Group();

    // Auto-Injector Shape
    // Main Tube
    const tubeGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 16);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    group.add(tube);

    // Liquid inside
    const liquidGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 16);
    const liquidMat = new THREE.MeshBasicMaterial({ color: 0xcc00aa }); // Pink/Purple fluid
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    group.add(liquid);

    // Cap/Needle guard
    const capGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.2, 16);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = -0.45;
    group.add(cap);

    // Plunger
    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16), capMat);
    plunger.position.y = 0.45;
    group.add(plunger);

    group.name = 'ITEM_ADRENALINE';
    return group;
};

export const createRemote = (): THREE.Group => {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.1, 1.0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Big Red Button
    const btnGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 });
    const btn = new THREE.Mesh(btnGeo, btnMat);
    btn.position.set(0, 0.08, -0.2);
    group.add(btn);

    // Arrow markings (using simple planes or boxes)
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const arrow1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.3), arrowMat);
    arrow1.position.set(0, 0.06, 0.2);
    arrow1.rotation.y = Math.PI / 4;
    group.add(arrow1);

    const arrow2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.3), arrowMat);
    arrow2.position.set(0, 0.06, 0.2);
    arrow2.rotation.y = -Math.PI / 4;
    group.add(arrow2);

    group.name = 'ITEM_REMOTE';
    return group;
};

export const createBigInverter = (): THREE.Group => {
    const group = new THREE.Group();
    // Compact Device - More Rectangular for BigInverter
    const baseGeo = new THREE.BoxGeometry(0.8, 0.2, 0.5); // Wider X, shorter Z
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    group.add(base);

    // Glowing core - ORANGE
    const coreGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.23, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); // Orange glow
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.05;
    // Rotate to lie flat? No, sticking up like a coil
    group.add(core);

    // Wires/Detail - Blue wires
    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 16), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
    wire.rotation.x = Math.PI / 2;
    wire.position.y = 0.11;
    group.add(wire);

    // Extra detail to distinguish
    const sidePlate1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.4), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    sidePlate1.position.set(-0.3, 0, 0);
    group.add(sidePlate1);

    const sidePlate2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.4), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    sidePlate2.position.set(0.3, 0, 0);
    group.add(sidePlate2);

    group.name = 'ITEM_BIG_INVERTER';
    return group;
};

export const createContract = (): THREE.Group => {
    const group = new THREE.Group();

    // Clipboard
    const boardGeo = new THREE.BoxGeometry(0.7, 0.05, 0.9);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }); // Dark wood
    const board = new THREE.Mesh(boardGeo, boardMat);
    group.add(board);

    // Paper
    const paperGeo = new THREE.PlaneGeometry(0.6, 0.8);
    const paperMat = new THREE.MeshBasicMaterial({ color: 0xffffee, side: THREE.DoubleSide });
    const paper = new THREE.Mesh(paperGeo, paperMat);
    paper.rotation.x = -Math.PI / 2;
    paper.position.y = 0.03;
    group.add(paper);

    // Clip
    const clipGeo = new THREE.BoxGeometry(0.4, 0.05, 0.1);
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    const clip = new THREE.Mesh(clipGeo, clipMat);
    clip.position.set(0, 0.05, -0.35);
    group.add(clip);

    // Blood Stains (Simple red planes)
    const stain1 = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), new THREE.MeshBasicMaterial({ color: 0x880000 }));
    stain1.rotation.x = -Math.PI / 2;
    stain1.position.set(0.1, 0.04, 0.2);
    group.add(stain1);

    const stain2 = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0xaa0000 }));
    stain2.rotation.x = -Math.PI / 2;
    stain2.position.set(-0.15, 0.04, 0);
    group.add(stain2);

    group.name = 'ITEM_CONTRACT';

    // ADJUSTMENTS
    group.scale.setScalar(2.5); // 2.5 times larger
    group.rotation.x = Math.PI / 8; // Slight tilt towards camera

    return group;
};

export const createLuckycharm = (): THREE.Group => {
    const group = new THREE.Group();

    // Hanger Ring (Gold Torus)
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1
    });
    const ringGeo = new THREE.TorusGeometry(0.12, 0.03, 8, 24);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.position.set(0, 0.45, 0);
    group.add(ring);

    // Stem (Gold/Green Cylinder link)
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8);
    const stem = new THREE.Mesh(stemGeo, goldMat);
    stem.position.set(0, 0.3, 0);
    group.add(stem);

    // Clover Leaves Group
    const cloverGroup = new THREE.Group();
    const leafMat = new THREE.MeshStandardMaterial({
        color: 0x00cc44, // Vibrant emerald green
        emissive: 0x003311, // Green glow
        roughness: 0.2,
        metalness: 0.1
    });

    const leafGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);

    // 4 Leaves laid flat
    const leaf1 = new THREE.Mesh(leafGeo, leafMat);
    leaf1.rotation.x = Math.PI / 2;
    leaf1.position.set(0, 0.16, 0);
    cloverGroup.add(leaf1);

    const leaf2 = new THREE.Mesh(leafGeo, leafMat);
    leaf2.rotation.x = Math.PI / 2;
    leaf2.position.set(0, -0.16, 0);
    cloverGroup.add(leaf2);

    const leaf3 = new THREE.Mesh(leafGeo, leafMat);
    leaf3.rotation.x = Math.PI / 2;
    leaf3.position.set(-0.16, 0, 0);
    cloverGroup.add(leaf3);

    const leaf4 = new THREE.Mesh(leafGeo, leafMat);
    leaf4.rotation.x = Math.PI / 2;
    leaf4.position.set(0.16, 0, 0);
    cloverGroup.add(leaf4);

    // Little gold core sphere at center
    const coreGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const core = new THREE.Mesh(coreGeo, goldMat);
    cloverGroup.add(core);

    cloverGroup.position.set(0, 0, 0);
    group.add(cloverGroup);

    group.name = 'ITEM_LUCKYCHARM';

    // Scale it to match other items
    group.scale.setScalar(2.0);

    return group;
};

export const createFlashbang = (): THREE.Group => {
    const group = new THREE.Group();

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x242424, metalness: 0.8, roughness: 0.6 }); // Matte dark grey tactical body
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0066cc, metalness: 0.3, roughness: 0.4 }); // Blue band
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.2 }); // Silver fuse head
    const leverMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.5 }); // Safety lever

    // Canister Body
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.65, 16);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Blue Band (middle stripe)
    const stripeGeo = new THREE.CylinderGeometry(0.185, 0.185, 0.15, 16);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.05;
    group.add(stripe);

    // Fuse Head / Cap
    const capGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 12);
    const cap = new THREE.Mesh(capGeo, metalMat);
    cap.position.y = 0.4;
    group.add(cap);

    // Safety Pin Lever (spoon)
    const leverGeo = new THREE.BoxGeometry(0.03, 0.35, 0.06);
    const lever = new THREE.Mesh(leverGeo, leverMat);
    lever.position.set(0.08, 0.35, 0);
    lever.rotation.z = -0.12;
    group.add(lever);

    // Pull Ring
    const ringGeo = new THREE.TorusGeometry(0.08, 0.015, 8, 16);
    const ring = new THREE.Mesh(ringGeo, metalMat);
    ring.position.set(-0.12, 0.42, 0);
    ring.rotation.y = Math.PI / 2;
    group.add(ring);

    group.name = 'ITEM_FLASHBANG';

    // Scale it to match other items
    group.scale.setScalar(2.0);

    return group;
};

export const createCrusher = (): THREE.Group => {
    const group = new THREE.Group();

    // Materials
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8, metalness: 0.1 }); // Dark wood handle
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.3, metalness: 0.85 }); // Dark iron hammer head
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xb5a642, roughness: 0.4, metalness: 0.9 }); // Brass reinforcement rings

    // Wooden Handle (Cylinder along Y axis)
    const handleGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 16);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.0;
    handle.castShadow = true;
    handle.receiveShadow = true;
    group.add(handle);

    // Brass Pommel (grip cap at bottom)
    const pommelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 12);
    const pommel = new THREE.Mesh(pommelGeo, accentMat);
    pommel.position.y = -0.55;
    group.add(pommel);

    // Hammer Head block (horizontal along Z axis, sitting on top of the handle)
    const headGeo = new THREE.BoxGeometry(0.24, 0.24, 0.55);
    const head = new THREE.Mesh(headGeo, metalMat);
    head.position.y = 0.55;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    // Left strike plate
    const strikeLGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 16);
    const strikeL = new THREE.Mesh(strikeLGeo, metalMat);
    strikeL.position.set(0, 0.55, -0.295);
    strikeL.rotation.x = Math.PI / 2;
    group.add(strikeL);

    // Right strike plate
    const strikeRGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 16);
    const strikeR = new THREE.Mesh(strikeRGeo, metalMat);
    strikeR.position.set(0, 0.55, 0.295);
    strikeR.rotation.x = Math.PI / 2;
    group.add(strikeR);

    // Brass collar reinforcement (under the head)
    const collarGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.12, 12);
    const collar = new THREE.Mesh(collarGeo, accentMat);
    collar.position.y = 0.43;
    group.add(collar);

    group.name = 'ITEM_CRUSHER';
    
    // Scale to make it look appropriately large
    group.scale.setScalar(2.2);

    return group;
};

export const createTotem = (): THREE.Group => {
    const group = new THREE.Group();

    // Materials
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffb700, // Golden yellow
        roughness: 0.2,
        metalness: 0.8
    });
    const wingMat = new THREE.MeshStandardMaterial({
        color: 0xffd700, // Lighter gold/yellow for contrast
        roughness: 0.3,
        metalness: 0.7
    });
    const eyeMat = new THREE.MeshStandardMaterial({
        color: 0x00ff66, // Minecraft green emerald eyes
        emissive: 0x003311,
        roughness: 0.1
    });

    // 1. Main Body (Box)
    const bodyGeo = new THREE.BoxGeometry(0.22, 0.34, 0.14);
    const body = new THREE.Mesh(bodyGeo, goldMat);
    body.position.y = 0.0;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 2. Head (Box on top of body)
    const headGeo = new THREE.BoxGeometry(0.24, 0.24, 0.16);
    const head = new THREE.Mesh(headGeo, goldMat);
    head.position.y = 0.29;
    head.castShadow = true;
    group.add(head);

    // 3. Nose (Minecraft villager nose style)
    const noseGeo = new THREE.BoxGeometry(0.06, 0.11, 0.06);
    const nose = new THREE.Mesh(noseGeo, goldMat);
    nose.position.set(0, 0.27, 0.11);
    group.add(nose);

    // 4. Left Eye (Emerald green box)
    const eyeLGeo = new THREE.BoxGeometry(0.06, 0.06, 0.04);
    const eyeL = new THREE.Mesh(eyeLGeo, eyeMat);
    eyeL.position.set(-0.07, 0.31, 0.095);
    group.add(eyeL);

    // 5. Right Eye
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.07;
    group.add(eyeR);

    // 6. Left Arm/Wing (Sticks out from side, bent down/back slightly)
    const wingLGeo = new THREE.BoxGeometry(0.1, 0.22, 0.08);
    const wingL = new THREE.Mesh(wingLGeo, wingMat);
    wingL.position.set(-0.16, 0.08, 0.02);
    wingL.rotation.z = 0.25; // angled outward
    wingL.rotation.y = -0.15;
    group.add(wingL);

    // 7. Right Arm/Wing
    const wingRGeo = new THREE.BoxGeometry(0.1, 0.22, 0.08);
    const wingR = new THREE.Mesh(wingRGeo, wingMat);
    wingR.position.set(0.16, 0.08, 0.02);
    wingR.rotation.z = -0.25;
    wingR.rotation.y = 0.15;
    group.add(wingR);

    // 8. Lower Base/Skirt (Minecraft totem bottom flange)
    const skirtGeo = new THREE.BoxGeometry(0.26, 0.08, 0.16);
    const skirt = new THREE.Mesh(skirtGeo, goldMat);
    skirt.position.y = -0.21;
    group.add(skirt);

    group.name = 'ITEM_TOTEM';

    // Scale it to be visible on the table/hand
    group.scale.setScalar(2.0);

    return group;
};

export const createMirror = (): THREE.Group => {
    const group = new THREE.Group();

    const goldMat = new THREE.MeshStandardMaterial({ 
        color: 0xd4af37, // Metallic gold
        roughness: 0.25, 
        metalness: 0.9 
    });

    const glassMat = new THREE.MeshStandardMaterial({ 
        color: 0xaadaff, 
        roughness: 0.02, 
        metalness: 0.98,
        emissive: 0x112244,
        emissiveIntensity: 0.35
    });

    const frameTorus = new THREE.TorusGeometry(0.18, 0.025, 12, 36);
    const frame = new THREE.Mesh(frameTorus, goldMat);
    frame.scale.set(0.78, 1.15, 1.0);
    frame.castShadow = true;
    group.add(frame);

    const glassGeo = new THREE.CylinderGeometry(0.178, 0.178, 0.015, 32);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.rotation.x = Math.PI / 2;
    glass.scale.set(0.78, 1.15, 1.0);
    group.add(glass);

    const addScroll = (x: number, y: number, rz: number) => {
        const scrollGeo = new THREE.TorusGeometry(0.04, 0.009, 8, 16);
        const mesh = new THREE.Mesh(scrollGeo, goldMat);
        mesh.position.set(x, y, 0);
        mesh.rotation.z = rz;
        mesh.castShadow = true;
        group.add(mesh);
    };

    const addBead = (x: number, y: number, r: number) => {
        const beadGeo = new THREE.SphereGeometry(r, 8, 8);
        const mesh = new THREE.Mesh(beadGeo, goldMat);
        mesh.position.set(x, y, 0);
        mesh.castShadow = true;
        group.add(mesh);
    };

    // 1. Top Flourish
    addScroll(0, 0.24, 0);
    addScroll(-0.06, 0.22, Math.PI / 4);
    addScroll(0.06, 0.22, -Math.PI / 4);
    addBead(0, 0.29, 0.018);
    addBead(-0.03, 0.27, 0.012);
    addBead(0.03, 0.27, 0.012);

    // 2. Bottom Flourish
    addScroll(0, -0.24, Math.PI);
    addScroll(-0.06, -0.22, -Math.PI / 4);
    addScroll(0.06, -0.22, Math.PI / 4);
    addBead(0, -0.29, 0.018);
    addBead(-0.03, -0.27, 0.012);
    addBead(0.03, -0.27, 0.012);

    // 3. Left Side Flourish
    addScroll(-0.16, 0.06, Math.PI / 2 + Math.PI / 6);
    addScroll(-0.16, -0.06, Math.PI / 2 - Math.PI / 6);
    addScroll(-0.17, 0, Math.PI / 2);
    addBead(-0.19, 0, 0.018);
    addBead(-0.18, 0.03, 0.01);
    addBead(-0.18, -0.03, 0.01);

    // 4. Right Side Flourish
    addScroll(0.16, 0.06, -Math.PI / 2 - Math.PI / 6);
    addScroll(0.16, -0.06, -Math.PI / 2 + Math.PI / 6);
    addScroll(0.17, 0, -Math.PI / 2);
    addBead(0.19, 0, 0.018);
    addBead(0.18, 0.03, 0.01);
    addBead(0.18, -0.03, 0.01);

    // 5. Diagonal Scroll Accents
    addScroll(-0.11, 0.15, Math.PI / 3);
    addScroll(0.11, 0.15, -Math.PI / 3);
    addScroll(-0.11, -0.15, -Math.PI / 3);
    addScroll(0.11, -0.15, Math.PI / 3);

    group.name = 'ITEM_MIRROR';
    group.scale.setScalar(2.0);

    return group;
};

export const createCardTexture = (name: string, isBack: boolean): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    if (isBack) {
        // Gold gothic back design
        const grad = ctx.createRadialGradient(128, 192, 20, 128, 192, 200);
        grad.addColorStop(0, '#2d0a15'); // Dark maroon
        grad.addColorStop(1, '#0b0205'); // Near black
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 384);

        ctx.strokeStyle = '#d4af37'; // Gold
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, 236, 364);

        ctx.strokeStyle = '#aa820a'; // Darker gold
        ctx.lineWidth = 2;
        ctx.strokeRect(16, 16, 224, 352);

        ctx.fillStyle = '#d4af37';
        ctx.fillRect(16, 16, 12, 12);
        ctx.fillRect(228, 16, 12, 12);
        ctx.fillRect(16, 356, 12, 12);
        ctx.fillRect(228, 356, 12, 12);

        ctx.beginPath();
        ctx.moveTo(30, 30);
        ctx.lineTo(226, 354);
        ctx.moveTo(226, 30);
        ctx.lineTo(30, 354);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(128, 192, 50, 0, Math.PI * 2);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(128, 192, 44, 0, Math.PI * 2);
        ctx.strokeStyle = '#aa820a';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 20px serif';
        ctx.fillStyle = '#d4af37';
        ctx.textAlign = 'center';
        ctx.fillText('R O U L E T T E', 128, 198);
    } else {
        // Front design
        let bgColor = '#111';
        let accentColor = '#ffd700';
        let desc = '';
        
        switch (name) {
            case 'The Magician':
                bgColor = '#1e112c'; // Purple
                accentColor = '#c084fc';
                desc = 'Gain a random item';
                break;
            case 'The Hanged Man':
                bgColor = '#2d0606'; // Blood red
                accentColor = '#f87171';
                desc = 'Lose 1 health';
                break;
            case 'The Hermit':
                bgColor = '#062016'; // Deep green
                accentColor = '#34d399';
                desc = 'Ends turn instantly';
                break;
            case 'The Moon':
                bgColor = '#091e3a'; // Blue
                accentColor = '#60a5fa';
                desc = 'Grab item from opponent';
                break;
            case 'Judgment':
                bgColor = '#2a1a08'; // Orange/Gold
                accentColor = '#fbbf24';
                desc = 'Invert blank shell';
                break;
            case 'Wheel of Fortune':
                bgColor = '#23120b'; // Bronze
                accentColor = '#fb923c';
                desc = 'Reshuffle ammo';
                break;
            case 'The Sun':
                bgColor = '#3b1007'; // Terracotta
                accentColor = '#f59e0b';
                desc = 'Gain 1 health';
                break;
            case 'Death':
                bgColor = '#0a0a0a'; // Black
                accentColor = '#e2e8f0';
                desc = 'Destroy 1 own item';
                break;
            case 'The Tower':
                bgColor = '#111827'; // Dark grey
                accentColor = '#fbbf24';
                desc = 'Destroy opponent item';
                break;
            case 'The Fool':
                bgColor = '#042f2e'; // Teal
                accentColor = '#2dd4bf';
                desc = 'Reveal bullet info';
                break;
            case 'Justice':
                bgColor = '#0f172a'; // Indigo
                accentColor = '#a78bfa';
                desc = 'Swap HP totals';
                break;
        }

        const grad = ctx.createRadialGradient(128, 192, 10, 128, 192, 220);
        grad.addColorStop(0, bgColor);
        grad.addColorStop(1, '#050505');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 384);

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, 236, 364);

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(14, 14, 228, 356);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeRect(28, 70, 200, 190);

        ctx.font = 'small-caps bold 20px serif';
        ctx.fillStyle = accentColor;
        ctx.textAlign = 'center';
        ctx.fillText(name.toUpperCase(), 128, 45);

        ctx.beginPath();
        ctx.moveTo(50, 55);
        ctx.lineTo(206, 55);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.save();
        ctx.translate(128, 160);
        ctx.strokeStyle = accentColor;
        ctx.fillStyle = accentColor;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (name === 'The Magician') {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 35,
                           Math.sin((18 + i * 72) * Math.PI / 180) * 35);
                ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 15,
                           Math.sin((54 + i * 72) * Math.PI / 180) * 15);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fillRect(-45, -35, 6, 6);
            ctx.fillRect(40, 30, 4, 4);
            ctx.fillRect(35, -25, 5, 5);
        } 
        else if (name === 'The Hanged Man') {
            ctx.beginPath();
            ctx.moveTo(0, -35);
            ctx.lineTo(0, 35);
            ctx.moveTo(-20, -15);
            ctx.lineTo(20, -15);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 5, 12, 0, Math.PI * 2);
            ctx.stroke();
        } 
        else if (name === 'The Hermit') {
            ctx.strokeRect(-15, -25, 30, 45);
            ctx.beginPath();
            ctx.arc(0, -25, 10, Math.PI, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-15, -10); ctx.lineTo(15, -10);
            ctx.moveTo(-15, 10); ctx.lineTo(15, 10);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (name === 'The Moon') {
            ctx.beginPath();
            ctx.arc(-10, 0, 30, -Math.PI / 2, Math.PI / 2);
            ctx.quadraticCurveTo(15, 0, -10, -Math.PI / 2);
            ctx.fill();
        } 
        else if (name === 'Judgment') {
            ctx.beginPath();
            ctx.moveTo(-5, -10);
            ctx.bezierCurveTo(-25, -35, -45, -10, -35, 15);
            ctx.bezierCurveTo(-25, 25, -10, 10, -5, 0);
            ctx.moveTo(5, -10);
            ctx.bezierCurveTo(25, -35, 45, -10, 35, 15);
            ctx.bezierCurveTo(25, 25, 10, 10, 5, 0);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(0, -25);
            ctx.lineTo(0, 25);
            ctx.moveTo(-10, -15);
            ctx.lineTo(10, -15);
            ctx.stroke();
        } 
        else if (name === 'Wheel of Fortune') {
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = i * Math.PI / 4;
                ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
                ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
            }
            ctx.stroke();
        } 
        else if (name === 'The Sun') {
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                const angle = i * Math.PI / 6;
                const len = i % 2 === 0 ? 32 : 24;
                ctx.moveTo(Math.cos(angle) * 16, Math.sin(angle) * 16);
                ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
            }
            ctx.stroke();
        } 
        else if (name === 'Death') {
            ctx.beginPath();
            ctx.arc(0, -10, 18, Math.PI, 0);
            ctx.lineTo(12, 15);
            ctx.lineTo(-12, 15);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = bgColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-6, 10); ctx.lineTo(-6, 16);
            ctx.moveTo(0, 10); ctx.lineTo(0, 16);
            ctx.moveTo(6, 10); ctx.lineTo(6, 16);
            ctx.stroke();
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.arc(-6, -6, 4, 0, Math.PI * 2);
            ctx.arc(6, -6, 4, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (name === 'The Tower') {
            ctx.strokeRect(-15, -15, 30, 40);
            ctx.beginPath();
            ctx.moveTo(-18, -15); ctx.lineTo(18, -15);
            ctx.lineTo(0, -30);
            ctx.closePath();
            ctx.stroke();
            ctx.strokeStyle = '#f59e0b';
            ctx.beginPath();
            ctx.moveTo(35, -45);
            ctx.lineTo(10, -20);
            ctx.lineTo(20, -20);
            ctx.lineTo(-5, 0);
            ctx.stroke();
        } 
        else if (name === 'The Fool') {
            ctx.beginPath();
            ctx.arc(0, 5, 18, 0, Math.PI, true);
            ctx.lineTo(-18, 15);
            ctx.lineTo(18, 15);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-18, 0);
            ctx.bezierCurveTo(-35, -25, -25, -30, -15, -15);
            ctx.moveTo(18, 0);
            ctx.bezierCurveTo(35, -25, 25, -30, 15, -15);
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(0, -30, 10, -35, 0, -15);
            ctx.stroke();
        } 
        else if (name === 'Justice') {
            ctx.beginPath();
            ctx.moveTo(0, -30);
            ctx.lineTo(0, 25);
            ctx.moveTo(-15, 25);
            ctx.lineTo(15, 25);
            ctx.moveTo(-30, -15);
            ctx.lineTo(30, -15);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-25, -15);
            ctx.lineTo(-32, 5);
            ctx.moveTo(-25, -15);
            ctx.lineTo(-18, 5);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-25, 5, 8, 0, Math.PI, false);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(25, -15);
            ctx.lineTo(32, 5);
            ctx.moveTo(25, -15);
            ctx.lineTo(18, 5);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(25, 5, 8, 0, Math.PI, false);
            ctx.stroke();
        }

        ctx.restore();

        ctx.font = 'italic 12px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(desc, 128, 305);

        ctx.font = '12px serif';
        ctx.fillStyle = accentColor;
        ctx.fillText('• X I I I •', 128, 345);
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

export const createTarotCard = (name: string): THREE.Group => {
    const group = new THREE.Group();
    const cardGeo = new THREE.BoxGeometry(0.8, 1.2, 0.01);

    const frontTex = createCardTexture(name, false);
    const frontMat = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: 0.8,
        metalness: 0.0,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.2,
        side: THREE.DoubleSide
    });

    const backTex = createCardTexture(name, true);
    const backMat = new THREE.MeshStandardMaterial({
        map: backTex,
        roughness: 0.75,
        metalness: 0.0,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
        side: THREE.DoubleSide
    });

    const edgeMat = new THREE.MeshStandardMaterial({
        color: 0xaa820a,
        roughness: 0.4,
        metalness: 0.8
    });

    const materials = [
        edgeMat,
        edgeMat,
        edgeMat,
        edgeMat,
        frontMat,
        backMat
    ];

    const mesh = new THREE.Mesh(cardGeo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'CARD_MESH';
    group.add(mesh);

    group.name = `ITEM_DECK_CARD_${name.replace(/\s+/g, '_')}`;
    group.userData = { name, isRevealed: false };

    return group;
};


