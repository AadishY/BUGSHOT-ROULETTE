import * as THREE from 'three';

export const createGunModel = (scene: THREE.Scene) => {
    const gunGroup = new THREE.Group();
    const isMobile = scene.userData.isMobile || false;
    const shouldCastShadow = !isMobile;

    const settings = scene.userData.settings || {};
    const ultraPerformance = !!settings.ultraPerformance;
    const balancedPerformance = !!settings.balancedPerformance;

    const metalMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0x999999 })
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0x999999 }) 
            : new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.15, envMapIntensity: 1 }));
            
    const woodMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0x4a3228 })
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0x4a3228 }) 
            : new THREE.MeshStandardMaterial({ color: 0x4a3228, roughness: 0.8 }));
            
    const darkMetalMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0x1a1a1a }) 
            : new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.4 }));
            
    const chokeMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0x111111 })
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0x111111 }) 
            : new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7, roughness: 0.7 }));
            
    const sawCutMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0xcccccc })
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0xcccccc }) 
            : new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.1 }));

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.2, 3.2), metalMat);
    receiver.castShadow = shouldCastShadow;
    receiver.position.z = 0;

    // Trigger Group Housing
    const triggerGroup = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 1.5), darkMetalMat);
    triggerGroup.position.set(0, -0.65, 0.2);
    receiver.add(triggerGroup);

    // Receiver Details - Side Plate / Heat Shield
    const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 2.0), darkMetalMat);
    sidePlate.position.set(0.42, 0.1, 0);
    receiver.add(sidePlate);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 4.0), woodMat);
    stock.position.z = -3.5; stock.position.y = -0.15; stock.castShadow = shouldCastShadow;

    // Shotgun Barrel (Long - Default)
    const barrelGeo = new THREE.CylinderGeometry(0.28, 0.28, 10, 24);
    const barrelMesh = new THREE.Mesh(barrelGeo, metalMat);
    barrelMesh.rotation.x = Math.PI / 2; barrelMesh.position.set(0, 0.4, 5.5); barrelMesh.castShadow = shouldCastShadow;
    barrelMesh.name = 'BARREL';

    // Shotgun Barrel (Short - Sawed Off)
    const shortBarrelGeo = new THREE.CylinderGeometry(0.28, 0.32, 3.5, 24);
    const shortBarrelMesh = new THREE.Mesh(shortBarrelGeo, metalMat);
    shortBarrelMesh.rotation.x = Math.PI / 2;
    shortBarrelMesh.position.set(0, 0.4, 2.2);
    shortBarrelMesh.visible = false;
    shortBarrelMesh.name = 'SHORT_BARREL';

    // Saw Cut Detail (Rough metal edge)
    const sawCut = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 24), sawCutMat);
    sawCut.rotation.x = Math.PI / 2;
    sawCut.position.set(0, 0.4, 3.9);
    sawCut.visible = false;
    sawCut.name = 'SAW_CUT';

    // Barrel Rings - Thicker for detail
    for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.15, 12), metalMat);
        ring.position.y = -4 + i * 3.5;
        barrelMesh.add(ring);
    }

    // Barrel Hole (Black Void Cap)
    const holeGeo = new THREE.CircleGeometry(0.22, 24);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x010101 });
    const holeMesh = new THREE.Mesh(holeGeo, holeMat);
    holeMesh.rotation.x = -Math.PI / 2;
    holeMesh.position.set(0, 5.01, 0);
    barrelMesh.add(holeMesh);

    const shortHole = holeMesh.clone();
    shortHole.position.set(0, 1.76, 0);
    shortBarrelMesh.add(shortHole);

    // Pump mechanism - RIBBED FOREGRIP
    const pumpGroup = new THREE.Group();
    pumpGroup.name = "PUMP";
    pumpGroup.position.set(0, -0.25, 4.5);

    // Create ribs for the pump
    for (let i = 0; i < 9; i++) {
        const ribMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 16), woodMat);
        ribMesh.rotation.x = Math.PI / 2;
        ribMesh.position.z = -1.4 + i * 0.35;
        ribMesh.castShadow = shouldCastShadow;
        pumpGroup.add(ribMesh);
    }
    // Inner tube for pump
    const pumpInner = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 3.2, 16), woodMat);
    pumpInner.rotation.x = Math.PI / 2;
    pumpGroup.add(pumpInner);

    const pump = pumpGroup;

    // Mag Tube - Longer and more industrial
    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 9.5, 16), darkMetalMat);
    magTube.rotation.x = Math.PI / 2; magTube.position.set(0, -0.3, 4.8); magTube.castShadow = shouldCastShadow;
    magTube.name = 'MAG_TUBE';

    const shortMagTube = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.5, 16), darkMetalMat);
    shortMagTube.rotation.x = Math.PI / 2; shortMagTube.position.set(0, -0.3, 2.2);
    shortMagTube.visible = false;
    shortMagTube.name = 'SHORT_MAG_TUBE';

    // Mag Tube Cap (Solid End)
    const magCap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.4, 16), metalMat);
    magCap.position.y = 4.75;
    magTube.add(magCap);

    const sMagCap = magCap.clone();
    sMagCap.position.y = 1.75;
    shortMagTube.add(sMagCap);

    const guardGeo = new THREE.TorusGeometry(0.3, 0.06, 8, 16, Math.PI);
    const guard = new THREE.Mesh(guardGeo, darkMetalMat);
    guard.rotation.z = Math.PI; guard.position.set(0, -0.6, 0.5);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.8 }));
    sight.position.set(0, 0.65, 10.5);
    sight.name = "SIGHT";

    const sSight = sight.clone();
    sSight.position.set(0, 0.65, 4.0);
    sSight.visible = false;
    sSight.name = "SHORT_SIGHT";

    // Shell Ejection Port (Now positioned on the side of the new receiver)
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x050505 }));
    port.position.set(0.3, 0.25, 1.0);
    receiver.add(port);

    // Trigger (Positioned inside triggerGroup)
    const triggerGeo = new THREE.TorusGeometry(0.12, 0.04, 8, 8, Math.PI / 2);
    const trigger = new THREE.Mesh(triggerGeo, darkMetalMat);
    trigger.rotation.z = Math.PI; trigger.rotation.y = Math.PI / 2;
    trigger.position.set(0, -0.15, 0.3);
    triggerGroup.add(trigger);

    // Choke Attachment (The Husher - UPGRADED)
    const chokeGroup = new THREE.Group();
    chokeGroup.name = 'CHOKE';
    chokeGroup.visible = false;
    chokeGroup.position.set(0, 0.4, 12.2);

    const chokeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.8, 32), chokeMat);
    chokeBody.rotation.x = Math.PI / 2;
    chokeGroup.add(chokeBody);

    // Cooling Fins
    for (let i = 0; i < 12; i++) {
        const fin = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.02, 4, 32), chokeMat);
        fin.rotation.x = Math.PI / 2;
        fin.position.z = -1.6 + i * 0.3;
        chokeGroup.add(fin);
    }

    // Muzzle Brake Holes
    const brakeHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (let i = 0; i < 8; i++) {
        const brakeHole = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), brakeHoleMat);
        brakeHole.position.set(Math.cos(i * Math.PI / 4) * 0.43, Math.sin(i * Math.PI / 4) * 0.43, 1.2);
        brakeHole.rotation.y = Math.PI / 2;
        chokeGroup.add(brakeHole);
    }

    const chokeMesh = chokeGroup;

    gunGroup.add(receiver, stock, barrelMesh, shortBarrelMesh, sawCut, pump, magTube, shortMagTube, guard, sight, sSight, chokeMesh);

    // Dynamic Muzzle Flash (Multi-plane Star)
    const flashGeo = new THREE.PlaneGeometry(3.5, 3.5);
    const flashMat = new THREE.MeshBasicMaterial({
        color: 0xffdd88, side: THREE.DoubleSide, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const f1 = new THREE.Mesh(flashGeo, flashMat);
    const f2 = new THREE.Mesh(flashGeo, flashMat); f2.rotation.z = Math.PI / 4;
    const f3 = new THREE.Mesh(flashGeo, flashMat); f3.rotation.z = -Math.PI / 4;
    const muzzleFlash = new THREE.Group();
    muzzleFlash.add(f1, f2, f3);
    muzzleFlash.position.set(0, 0.4, 10.5);
    muzzleFlash.visible = false;
    gunGroup.add(muzzleFlash);

    scene.add(gunGroup);

    return { gunGroup, barrelMesh, shortBarrelMesh, sawCut, muzzleFlash, pump, magTube, shortMagTube, chokeMesh, sight, sSight };
};

export const createProjectiles = (scene: THREE.Scene) => {
    const bulletGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5);
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffaa00, emissiveIntensity: 5 });
    const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
    bulletMesh.rotation.x = Math.PI / 2; bulletMesh.visible = false;
    scene.add(bulletMesh);

    // Create 3 shell casings for multi-shell system
    const shellCasings: THREE.Mesh[] = [];
    const shellVelocities: THREE.Vector3[] = [];

    // Define drop positions in the middle of the table (spread out slightly)
    const shellPositions = [
        { x: -1.5, z: 0 },    // Left position
        { x: 0, z: 0 },       // Center position
        { x: 1.5, z: 0 },     // Right position
    ];

    for (let i = 0; i < 3; i++) {
        const shellCasing = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12),
            new THREE.MeshStandardMaterial({ color: 0xb91c1c })
        );
        const shellBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.125, 0.125, 0.1, 12),
            new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 })
        );
        shellBase.position.y = -0.22;
        shellCasing.add(shellBase);
        shellCasing.rotation.z = Math.PI / 2;
        shellCasing.visible = false;
        shellCasing.userData.shellIndex = i;
        shellCasing.userData.basePosition = shellPositions[i];
        shellCasing.userData.landedAt = null;
        scene.add(shellCasing);
        shellCasings.push(shellCasing);
        shellVelocities.push(new THREE.Vector3());
    }

    // Keep backward compatibility - return first shell as 'shellCasing'
    return { bulletMesh, shellCasing: shellCasings[0], shellCasings, shellVelocities };
};
