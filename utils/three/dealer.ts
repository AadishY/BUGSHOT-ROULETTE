import * as THREE from 'three';

export const createDealerModel = (scene: THREE.Scene) => {
    // Check if dealer already exists
    const existingDealer = scene.getObjectByName('DEALER');
    if (existingDealer) return existingDealer as THREE.Group;

    const dealerGroup = new THREE.Group();
    dealerGroup.name = 'DEALER';

    const settings = scene.userData.settings || {};
    const ultraPerformance = !!settings.ultraPerformance;
    const balancedPerformance = !!settings.balancedPerformance;

    // Materials
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const teethMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0xffffcc }) 
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0xffffcc }) 
            : new THREE.MeshStandardMaterial({ color: 0xffffcc, roughness: 0.4, metalness: 0.1 }));

    // Creates a gruesome skin texture with blood/grime
    const createDirtySkinTexture = () => {
        if (ultraPerformance) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Pale dead skin base
        ctx.fillStyle = '#e0c0b0';
        ctx.fillRect(0, 0, 512, 512);

        // Dirty noise
        for (let i = 0; i < 5000; i++) {
            const val = Math.random();
            ctx.fillStyle = val > 0.5 ? 'rgba(100, 80, 70, 0.15)' : 'rgba(50, 40, 30, 0.2)';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 4, 2 + Math.random() * 4);
        }

        // Blood splatters
        for (let i = 0; i < 25; i++) {
            const cx = Math.random() * 512;
            const cy = Math.random() * 512;
            const r = 5 + Math.random() * 40;

            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, 'rgba(120, 0, 0, 0.6)');
            grad.addColorStop(1, 'rgba(80, 0, 0, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
    };

    const dirtySkinTex = createDirtySkinTexture();
    const skullMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0xffddcc }) 
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ map: dirtySkinTex || undefined, color: 0xffddcc }) 
            : new THREE.MeshStandardMaterial({ map: dirtySkinTex || undefined, color: 0xffddcc, roughness: 0.6, metalness: 0.1 }));

    // === HEAD ===
    const headGroup = new THREE.Group();
    headGroup.name = "HEAD"; // Important for animation

    // Distorted Sphere Head - LARGER
    const skullGeo = new THREE.SphereGeometry(2.1, 64, 64);
    const posAttribute = skullGeo.attributes.position;
    for (let i = 0; i < posAttribute.count; i++) {
        const x = posAttribute.getX(i);
        const y = posAttribute.getY(i);
        const z = posAttribute.getZ(i);

        // More intense distortion
        const noise = Math.sin(x * 3.0) * Math.cos(y * 3.0) * 0.06 +
            Math.cos(z * 2.5) * 0.06;

        // Scale slightly based on noise
        const scale = 1.0 + noise;
        posAttribute.setXYZ(i, x * scale, y * scale, z * scale);
    }
    skullGeo.computeVertexNormals();
    skullGeo.scale(1.0, 1.2, 0.95); // Elongated

    const skull = new THREE.Mesh(skullGeo, skullMat);
    skull.castShadow = true;
    headGroup.add(skull);

    // === EYES ===
    const createOvalEye = (rx: number, ry: number) => {
        const shape = new THREE.Shape();
        shape.ellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
        return new THREE.ShapeGeometry(shape);
    };

    const lEye = new THREE.Mesh(createOvalEye(0.65, 0.8), voidMat);
    lEye.position.set(-1.2, 0.6, 1.8);
    lEye.rotation.z = 0.15;
    lEye.rotation.y = -0.3;
    headGroup.add(lEye);

    const rEye = new THREE.Mesh(createOvalEye(0.65, 0.8), voidMat);
    rEye.position.set(1.2, 0.6, 1.8);
    rEye.rotation.z = -0.15;
    rEye.rotation.y = 0.3;
    headGroup.add(rEye);

    // Red glowing pupils - SLIT SHAPE (Smaller)
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const pupilGeo = new THREE.CapsuleGeometry(0.06, 0.2, 4, 8);

    const lPupil = new THREE.Mesh(pupilGeo, pupilMat);
    lPupil.position.set(-1.2, 0.6, 1.9);
    lPupil.rotation.z = 0.1;
    lPupil.name = 'LEFT_PUPIL';
    headGroup.add(lPupil);

    const rPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rPupil.position.set(1.2, 0.6, 1.9);
    rPupil.rotation.z = -0.1;
    rPupil.name = 'RIGHT_PUPIL';
    headGroup.add(rPupil);

    // Pupil glow (Reduced)
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.6
    });

    const lGlow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), glowMat);
    lGlow.position.set(-1.2, 0.6, 1.95);
    lGlow.name = 'LEFT_GLOW';
    headGroup.add(lGlow);

    const rGlow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), glowMat);
    rGlow.position.set(1.2, 0.6, 1.95);
    rGlow.name = 'RIGHT_GLOW';
    headGroup.add(rGlow);

    // Add general face glow light
    const faceLight = new THREE.PointLight(0xff0000, 2.0, 5);
    faceLight.position.set(0, 0, 2.5);
    faceLight.name = "FACE_LIGHT";
    headGroup.add(faceLight);

    // === MOUTH - Jagged Horror Grin ===
    const grinShape = new THREE.Shape();
    grinShape.moveTo(-1.5, 0.3);
    // Jagged bottom lip
    grinShape.bezierCurveTo(-0.6, -1.0, 0.6, -1.0, 1.5, 0.3);
    // Jagged top lip connection
    grinShape.bezierCurveTo(0.8, -0.4, -0.8, -0.4, -1.5, 0.3);

    const grinGeo = new THREE.ExtrudeGeometry(grinShape, { depth: 0.5, bevelEnabled: false });
    const mouthVoid = new THREE.Mesh(grinGeo, voidMat);
    mouthVoid.position.set(0, -0.8, 1.6);
    mouthVoid.scale.set(1.1, 1, 1);
    mouthVoid.rotation.x = 0.15;
    headGroup.add(mouthVoid);

    // === TEETH ===
    const gumMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0x220000 }) 
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0x220000 }) 
            : new THREE.MeshStandardMaterial({ color: 0x220000, roughness: 0.3 }));
    const gum = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 0.6), gumMat);
    gum.position.set(0, -1.4, 1.6);
    headGroup.add(gum);

    // Sharp uneven teeth - MORE JAGGED
    for (let i = 0; i < 16; i++) {
        const t = (i / 15) * 2 - 1; // -1 to 1

        // Upper
        const h = 0.5 + Math.random() * 0.4;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, h, 4), teethMat);
        cone.position.set(t * 1.3, -0.8, 2.1);
        cone.rotation.x = Math.PI - 0.2;
        cone.rotation.z = (Math.random() - 0.5) * 0.5;
        headGroup.add(cone);

        // Lower
        const h2 = 0.4 + Math.random() * 0.4;
        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.07, h2, 4), teethMat);
        cone2.position.set(t * 1.1 + (Math.random() - 0.5) * 0.1, -1.4, 2.05);
        cone2.rotation.z = (Math.random() - 0.5) * 0.5;
        headGroup.add(cone2);
    }

    dealerGroup.add(headGroup);

    // === BODY ===
    // Dark, ill-fitting suit - Buckshot style (Black/Dark Grey)
    const suitMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0x080808 }) 
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0x080808 }) 
            : new THREE.MeshStandardMaterial({
                color: 0x080808, // Almost black
                roughness: 0.5,  // Worn fabric (Reduced for highlights)
                metalness: 0.1,
                emissive: 0x000000,
                emissiveIntensity: 0
            }));

    // Neck - thicker
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.0), skullMat);
    neck.position.set(0, -1.8, 0);
    neck.castShadow = true;
    dealerGroup.add(neck);

    // Shoulders - Hunched and Broad
    const shoulders = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 1.5, 2.0),
        suitMat
    );
    shoulders.position.set(0, -2.5, 0);
    // Hunch effect
    shoulders.rotation.x = 0.2;
    shoulders.castShadow = true;
    dealerGroup.add(shoulders);

    // Upper Torso - Bulky
    const upperTorso = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 3.0, 1.8),
        suitMat
    );
    upperTorso.position.set(0, -4.5, 0.2);
    upperTorso.castShadow = true;
    dealerGroup.add(upperTorso);

    // Mid Torso
    const midTorso = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 2.5, 1.6),
        suitMat
    );
    midTorso.position.set(0, -6.5, 0.2);
    midTorso.castShadow = true;
    dealerGroup.add(midTorso);

    // Arms - Re-rigged to connect properly
    const upperArmGeo = new THREE.CylinderGeometry(0.6, 0.5, 3.0);

    const lUpperArm = new THREE.Mesh(upperArmGeo, suitMat);
    lUpperArm.position.set(-3.5, -3.2, 0.2); // Lower attachment
    lUpperArm.rotation.z = 0.3;
    lUpperArm.rotation.x = 0; // Vertical
    lUpperArm.castShadow = true;
    dealerGroup.add(lUpperArm);

    const rUpperArm = new THREE.Mesh(upperArmGeo, suitMat);
    rUpperArm.position.set(3.5, -3.2, 0.2);
    rUpperArm.rotation.z = -0.3;
    rUpperArm.rotation.x = 0;
    rUpperArm.castShadow = true;
    dealerGroup.add(rUpperArm);

    // Forearms - Reaching forward onto the table
    // Forearms - Reaching forward onto the table
    const forearmGeo = new THREE.CylinderGeometry(0.5, 0.4, 3.5);

    const lForearm = new THREE.Mesh(forearmGeo, suitMat);
    // Adjusted to reach from shoulder to table (WIDER STANCE)
    // Pulling back: Z 2.5 -> 1.5. Raising: Y -4.0 -> -3.6
    lForearm.position.set(-3.8, -3.6, 1.5);
    lForearm.rotation.x = -Math.PI / 2 + 0.6; // Steeper angle
    lForearm.rotation.z = -0.2; // Angled outward
    lForearm.castShadow = true;
    lForearm.name = 'LEFT_FOREARM';
    dealerGroup.add(lForearm);

    const rForearm = new THREE.Mesh(forearmGeo, suitMat);
    rForearm.position.set(3.8, -3.6, 1.5);
    rForearm.rotation.x = -Math.PI / 2 + 0.6;
    rForearm.rotation.z = 0.2; // Angled outward
    rForearm.castShadow = true;
    rForearm.name = 'RIGHT_FOREARM';
    dealerGroup.add(rForearm);

    // Hands - Resting on table in front of dealer
    // Target Absolute Y: -0.7 (Table Surface)
    // Calculation: 3.0 + (localY * 0.9) = -0.7 => localY = -4.1
    // Target Absolute Z: -5.5 (Closer to dealer)
    // Calculation: -8.0 + (localZ * 0.9) = -5.5 => localZ = 2.7
    const handGeo = new THREE.BoxGeometry(1.2, 0.6, 1.6);

    const lHand = new THREE.Mesh(handGeo, skullMat);
    lHand.position.set(-3.5, -4.15, 2.7);
    lHand.rotation.x = 0.0; // Flat on table
    lHand.rotation.z = 0.2;
    lHand.castShadow = true;
    lHand.name = 'LEFT_HAND';
    dealerGroup.add(lHand);

    const rHand = new THREE.Mesh(handGeo, skullMat);
    rHand.position.set(3.5, -4.15, 2.7);
    rHand.rotation.x = 0.0;
    rHand.rotation.z = -0.2;
    rHand.castShadow = true;
    rHand.name = 'RIGHT_HAND';
    dealerGroup.add(rHand);

    // Fingers - Sprawled on table
    const fingerGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.9);
    for (let i = 0; i < 4; i++) {
        // Left fingers
        const lFinger = new THREE.Mesh(fingerGeo, skullMat);
        // Z offset relative to hand Z (2.7) + length
        lFinger.position.set(-3.9 + i * 0.25, -4.35, 3.6);
        lFinger.rotation.x = Math.PI / 2;
        lFinger.rotation.y = 0.2;
        dealerGroup.add(lFinger);

        // Right fingers
        const rFinger = new THREE.Mesh(fingerGeo, skullMat);
        rFinger.position.set(3.1 + i * 0.25, -4.35, 3.6);
        rFinger.rotation.x = Math.PI / 2;
        rFinger.rotation.y = -0.2; // splay
        dealerGroup.add(rFinger);
    }

    // Position the entire dealer group
    dealerGroup.position.set(0, 3.0, -8);
    dealerGroup.scale.set(0.9, 0.9, 0.9); // Larger size

    scene.add(dealerGroup);
    return dealerGroup;
};
