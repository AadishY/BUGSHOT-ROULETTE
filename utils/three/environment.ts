import * as THREE from 'three';
import { getDeviceType } from '../gameUtils';

function generateGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.4, 'rgba(255,200,0,0.5)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// procedural brick texture - brighter for visibility
function createBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#3a2a25'; // Brighter reddish brown base
    ctx.fillRect(0, 0, 512, 512);

    const brickH = 32;
    const brickW = 64;

    for (let y = 0; y < 512; y += brickH) {
        // Offset every other row
        const offset = (y / brickH) % 2 === 0 ? 0 : 32;
        for (let x = -32; x < 512; x += brickW) {
            // Brick color variation - brighter
            const shade = 35 + Math.random() * 40;
            ctx.fillStyle = `rgb(${shade + 45}, ${shade + 25}, ${shade + 15})`;

            // Draw brick with mortar gap
            ctx.fillRect(x + offset + 2, y + 2, brickW - 4, brickH - 4);

            // Add grunge/noise
            if (Math.random() > 0.5) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(x + offset + 5 + Math.random() * 40, y + 5 + Math.random() * 20, 10, 10);
            }
        }
    }

    // Light vignette
    const grad = ctx.createRadialGradient(256, 256, 128, 256, 256, 512);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)'); // Less dark
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.anisotropy = (getDeviceType() === 'pc') ? 8 : 1;
    return tex;
}

function createTableTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048; // Higher resolution
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // ═══════════════════════════════════════════════════════════════
    // BUCKSHOT ROULETTE STYLE TABLE - Dark worn green with amber lines
    // ═══════════════════════════════════════════════════════════════

    // Base - Very dark olive/military green
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, 2048, 2048);

    // Felt texture layer - subtle variation
    for (let i = 0; i < 50000; i++) {
        const shade = Math.random();
        if (shade > 0.7) {
            ctx.fillStyle = '#253525'; // Lighter green spots
        } else if (shade > 0.4) {
            ctx.fillStyle = '#1e2e1e'; // Mid tone
        } else {
            ctx.fillStyle = '#142014'; // Dark spots
        }
        const size = 1 + Math.random() * 3;
        ctx.fillRect(Math.random() * 2048, Math.random() * 2048, size, size);
    }

    // Add wear patterns / scratches
    ctx.strokeStyle = 'rgba(10, 15, 10, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 80; i++) {
        ctx.beginPath();
        const x1 = Math.random() * 2048;
        const y1 = Math.random() * 2048;
        const len = 20 + Math.random() * 100;
        const angle = Math.random() * Math.PI * 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + Math.cos(angle) * len, y1 + Math.sin(angle) * len);
        ctx.stroke();
    }

    // Coffee/liquid stains
    for (let i = 0; i < 8; i++) {
        const x = 300 + Math.random() * 1448;
        const y = 300 + Math.random() * 1448;
        const r = 30 + Math.random() * 80;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(25, 15, 10, 0.3)');
        grad.addColorStop(0.6, 'rgba(20, 12, 8, 0.15)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // ═══════════════════════════════════════════════════════════════
    // GLOWING AMBER/GOLD GRID LINES - Like the reference
    // ═══════════════════════════════════════════════════════════════

    // Helper for glowing lines
    const drawGlowLine = (x1: number, y1: number, x2: number, y2: number, width: number = 3) => {
        // Outer glow
        ctx.strokeStyle = 'rgba(180, 150, 80, 0.2)';
        ctx.lineWidth = width + 12;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Mid glow
        ctx.strokeStyle = 'rgba(200, 170, 100, 0.4)';
        ctx.lineWidth = width + 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Core line
        ctx.strokeStyle = 'rgba(220, 200, 140, 0.8)';
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };

    const drawGlowCircle = (x: number, y: number, r: number, width: number = 3) => {
        // Outer glow
        ctx.strokeStyle = 'rgba(180, 150, 80, 0.2)';
        ctx.lineWidth = width + 12;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Mid glow
        ctx.strokeStyle = 'rgba(200, 170, 100, 0.4)';
        ctx.lineWidth = width + 6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Core line
        ctx.strokeStyle = 'rgba(220, 200, 140, 0.8)';
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    };

    const drawGlowRect = (x: number, y: number, w: number, h: number, width: number = 2) => {
        drawGlowLine(x, y, x + w, y, width);
        drawGlowLine(x + w, y, x + w, y + h, width);
        drawGlowLine(x + w, y + h, x, y + h, width);
        drawGlowLine(x, y + h, x, y, width);
    };

    // Center dividing line
    drawGlowLine(1024, 100, 1024, 1948, 4);

    // Large central roulette circle
    drawGlowCircle(1024, 1024, 280, 5);
    drawGlowCircle(1024, 1024, 200, 3);

    // Inner design - cross pattern
    drawGlowLine(1024 - 180, 1024, 1024 + 180, 1024, 2);
    drawGlowLine(1024, 1024 - 180, 1024, 1024 + 180, 2);

    // Corner markings
    drawGlowLine(100, 100, 200, 100, 2);
    drawGlowLine(100, 100, 100, 200, 2);

    drawGlowLine(1948, 100, 1848, 100, 2);
    drawGlowLine(1948, 100, 1948, 200, 2);

    drawGlowLine(100, 1948, 200, 1948, 2);
    drawGlowLine(100, 1948, 100, 1848, 2);

    drawGlowLine(1948, 1948, 1848, 1948, 2);
    drawGlowLine(1948, 1948, 1948, 1848, 2);

    // Item placement zones - Left side (dealer)
    drawGlowRect(150, 300, 350, 250, 2);
    drawGlowRect(150, 600, 350, 250, 2);

    // Item placement zones - Right side (player)
    drawGlowRect(1548, 300, 350, 250, 2);
    drawGlowRect(1548, 600, 350, 250, 2);

    // Small item slots at bottom (player side)
    for (let i = 0; i < 4; i++) {
        drawGlowRect(1200 + i * 100, 1700, 80, 80, 2);
    }

    // Small item slots at top (dealer side)
    for (let i = 0; i < 4; i++) {
        drawGlowRect(648 + i * 100, 250, 80, 80, 2);
    }

    // Gun placement area (center)
    drawGlowRect(874, 900, 300, 150, 3);

    // Vignette effect - darker edges
    const vignette = ctx.createRadialGradient(1024, 1024, 400, 1024, 1024, 1400);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 2048, 2048);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = (getDeviceType() === 'pc') ? 8 : 1;
    tex.minFilter = THREE.NearestFilter; // Sharp pixels
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

export const createEnvironment = (scene: THREE.Scene, isMobile: boolean = false, ultraPerformance: boolean = false) => {
    const settings = scene.userData.settings || {};
    const ultraPerformanceMode = ultraPerformance || !!settings.ultraPerformance;
    const balancedPerformance = !!settings.balancedPerformance;
    // ═══════════════════════════════════════════════════════════════
    // BUCKSHOT ROULETTE BUNKER ENVIRONMENT
    // Dark industrial underground aesthetic
    // ═══════════════════════════════════════════════════════════════

    // Create procedural concrete texture for floor
    const createConcreteTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(canvas);

        // Brighter base concrete
        ctx.fillStyle = '#1a1816';
        ctx.fillRect(0, 0, 1024, 1024);

        // Concrete variation - brighter
        for (let i = 0; i < 15000; i++) {
            const shade = Math.random();
            if (shade > 0.7) {
                ctx.fillStyle = '#252220';
            } else if (shade > 0.4) {
                ctx.fillStyle = '#1e1c1a';
            } else {
                ctx.fillStyle = '#161412';
            }
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 6, 2 + Math.random() * 6);
        }

        // Cracks
        ctx.strokeStyle = 'rgba(10, 8, 6, 0.8)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            let x = Math.random() * 1024;
            let y = Math.random() * 1024;
            ctx.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
                x += (Math.random() - 0.5) * 80;
                y += (Math.random() - 0.5) * 80;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Oil/grime stains
        for (let i = 0; i < 12; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 1024;
            const r = 20 + Math.random() * 60;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(25, 20, 15, 0.4)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.anisotropy = (getDeviceType() === 'pc') ? 8 : 1;
        return tex;
    };

    // Floor - Industrial concrete (brighter)
    const floorTex = ultraPerformanceMode ? null : createConcreteTexture();
    const floorMat = ultraPerformanceMode
        ? new THREE.MeshBasicMaterial({ color: 0x050505 })
        : (balancedPerformance
            ? new THREE.MeshLambertMaterial({ map: floorTex || undefined, color: 0x1a1614 })
            : new THREE.MeshStandardMaterial({
                map: floorTex || undefined,
                color: 0x1a1614, // Brighter
                roughness: 0.9,
                metalness: 0.1
            }));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -9;
    floor.receiveShadow = !isMobile && !ultraPerformanceMode && !balancedPerformance;
    scene.add(floor);

    // Ceiling - Very dark with void feel
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 1.0, side: THREE.BackSide })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 20;
    scene.add(ceiling);

    // Grunge Back Wall - Near black industrial
    const createWallTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(canvas);

        // Brighter base for visibility
        ctx.fillStyle = '#1a1614';
        ctx.fillRect(0, 0, 512, 512);

        // Grimy patches - brighter
        for (let i = 0; i < 500; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#252220' : '#1c1a18';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 15, 3 + Math.random() * 15);
        }

        // Water stains running down
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = 'rgba(40, 35, 30, 0.4)';
            ctx.lineWidth = 2 + Math.random() * 5;
            ctx.beginPath();
            const x = Math.random() * 512;
            ctx.moveTo(x, 0);
            let cx = x;
            for (let y = 0; y < 512; y += 20) {
                cx += (Math.random() - 0.5) * 15;
                ctx.lineTo(cx, y);
            }
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.anisotropy = (getDeviceType() === 'pc') ? 8 : 1;
        return tex;
    };

    const wallTex = ultraPerformanceMode ? null : createWallTexture();
    // Back wall with emissive so it's always visible
    const backWallMat = ultraPerformanceMode
        ? new THREE.MeshBasicMaterial({ color: 0x030303 })
        : (balancedPerformance
            ? new THREE.MeshLambertMaterial({ map: wallTex || undefined, color: 0x3a3530 })
            : new THREE.MeshStandardMaterial({
                map: wallTex || undefined,
                color: 0x3a3530,
                roughness: 0.85,
                emissive: 0x151210,
                emissiveIntensity: 0.15
            }));
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), backWallMat);
    backWall.position.set(0, 5, -28); // Moved back (was -22)
    backWall.receiveShadow = !isMobile && !ultraPerformanceMode && !balancedPerformance;
    scene.add(backWall);

    if (!ultraPerformanceMode) {
        // Crate material with slight emissive for visibility
        const crateMat = new THREE.MeshStandardMaterial({
            color: 0x3a3530,
            roughness: 0.8,
            emissive: 0x0a0808,
            emissiveIntensity: 0.15
        });

        // Background Stacks (Fill the void)
        const makeStack = (x: number, z: number, y: number, r: number, scale: number = 1) => {
            const box = new THREE.Mesh(new THREE.BoxGeometry(4 * scale, 4 * scale, 4 * scale), crateMat);
            box.position.set(x, y, z);
            box.rotation.y = r;
            if (!isMobile) {
                box.castShadow = true;
                box.receiveShadow = true;
            }
            scene.add(box);
            return box;
        };

        // Left Stack - More crates for density
        makeStack(-15, -5, -7, 0.5);
        makeStack(-15, -5, -3, 0.5);
        makeStack(-15, -1, -5, 0.2);
        makeStack(-17, -7, -5, 0.3, 0.8);

        // Right Stack
        makeStack(16, -6, -6, -0.2);
        makeStack(18, -6, -2, -0.4);
        makeStack(17, -2, -4, 0.1);
        makeStack(19, -7, -4, -0.3, 0.7);

        // Far Back Props (Silhouettes for depth)
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 2), crateMat);
        shelf.position.set(0, -2, -25);
        shelf.receiveShadow = !isMobile;
        scene.add(shelf);

        // Left Foreground - Industrial Cart with items
        const cartGroup = new THREE.Group();
        cartGroup.position.set(-10, -5, 6);
        cartGroup.rotation.y = 0.4;

        const cartMat = new THREE.MeshStandardMaterial({ color: 0x252220, metalness: 0.6, roughness: 0.7 });
        const cartFrame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.5, 2.5), cartMat);
        cartGroup.add(cartFrame);

        // Tray top
        const cartTray = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.15, 2.8), new THREE.MeshStandardMaterial({ color: 0x3a3530, metalness: 0.5 }));
        cartTray.position.y = 2.3;
        cartGroup.add(cartTray);

        // Wheels
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151210 });
        const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
        [[-1.2, -2, -0.8], [1.2, -2, -0.8], [-1.2, -2, 0.8], [1.2, -2, 0.8]].forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos[0], pos[1], pos[2]);
            cartGroup.add(wheel);
        });
        scene.add(cartGroup);

        // Cart light (Neutral/Low)
        const cartLight = new THREE.PointLight(0x4a4540, 8.0, 20);
        cartLight.position.set(-8, -2, 6);
        scene.add(cartLight);

        // Right Foreground - Industrial Cabinet with LED display
        const cabinetGroup = new THREE.Group();
        cabinetGroup.position.set(11, -4.5, 5);
        cabinetGroup.rotation.y = -0.35;

        const cabMat = new THREE.MeshStandardMaterial({ color: 0x1a1815, roughness: 0.8 });
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 3), cabMat);
        cabinetGroup.add(cabinet);

        // LED display panel (green glow like reference)
        const displayMat = new THREE.MeshStandardMaterial({
            color: 0x001500,
            emissive: 0x00ff00,
            emissiveIntensity: 0.3
        });
        const display = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.2), displayMat);
        display.position.set(0, 1, 1.51);
        cabinetGroup.add(display);

        // LED indicator lights
        const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        for (let i = 0; i < 5; i++) {
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.05), ledMat);
            led.position.set(-1 + i * 0.5, 0, 1.52);
            cabinetGroup.add(led);
        }
        scene.add(cabinetGroup);
    }




    // Bulb & Wire Group for animation
    const bulbGroup = new THREE.Group();
    bulbGroup.name = "BULB_GROUP";
    scene.add(bulbGroup);

    // === HANGING WIRES (Procedural) ===
    const createWire = (start: THREE.Vector3, end: THREE.Vector3, slack: number, segments: number) => {
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = THREE.MathUtils.lerp(start.x, end.x, t);
            const z = THREE.MathUtils.lerp(start.z, end.z, t);
            // Parabola for slack
            const y = THREE.MathUtils.lerp(start.y, end.y, t) - (Math.sin(t * Math.PI) * slack);
            points.push(new THREE.Vector3(x, y, z));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const geo = new THREE.TubeGeometry(curve, segments, 0.05, 6, false);
        const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
        return new THREE.Mesh(geo, mat);
    };

    // Add multiple wires hanging from ceiling
    if (!ultraPerformanceMode) {
        scene.add(createWire(new THREE.Vector3(-10, 12, -5), new THREE.Vector3(10, 12, -5), 2.5, 10));
        scene.add(createWire(new THREE.Vector3(-15, 12, -10), new THREE.Vector3(5, 14, -15), 3.0, 10));
        scene.add(createWire(new THREE.Vector3(-5, 14, -20), new THREE.Vector3(15, 12, -18), 2.0, 10));
        scene.add(createWire(new THREE.Vector3(0, 14, 5), new THREE.Vector3(0, 10, 0), 1.0, 8)); // Near bulb
    }

    // Wire Geometry (Simple straight one for bulb group)
    const wireGeo = new THREE.CylinderGeometry(0.03, 0.03, 6);
    const wire = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
    wire.position.set(0, -3, 0);

    // Ceiling Pivot Group
    const hangingLight = new THREE.Group();
    hangingLight.name = "HANGING_LIGHT";
    hangingLight.position.set(0, 14, 0);
    scene.add(hangingLight);

    hangingLight.add(wire);

    // Bulb Mesh
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 32, 32),
        new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffaa00,
            emissiveIntensity: 2.0,
            toneMapped: false
        })
    );
    bulb.position.set(0, -6, 0); // End of wire
    if (!isMobile) bulb.castShadow = false; // Fix artifact
    hangingLight.add(bulb);

    // Fake Volumetric Glow Sprite (Only on Desktop)
    if (!isMobile && !ultraPerformanceMode) {
        const spriteMat = new THREE.SpriteMaterial({
            map: generateGlowTexture(),
            color: 0xffaa00,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        const glowSprite = new THREE.Sprite(spriteMat);
        glowSprite.scale.set(6, 6, 1);
        bulb.add(glowSprite);
    }

    // --- INDUSTRIAL PIPES & VENTS --- (Brighter materials)
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3a3535, roughness: 0.6, metalness: 0.7 });
    const rustMat = new THREE.MeshStandardMaterial({ color: 0x5d4638, roughness: 0.85 });

    // --- ENHANCED BACKGROUND PROPS --- (Brighter)
    if (!ultraPerformanceMode) {
        const boxGeo = new THREE.BoxGeometry(3, 3, 3);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.85 });

        // === AMP RACK (Left Side - visible) ===
        const rackGroup = new THREE.Group();
        rackGroup.position.set(-10, -1, -12); // Moved closer (was -18)
        rackGroup.rotation.y = 0.5;

        const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 4), new THREE.MeshStandardMaterial({ color: 0x353030 }));
        rackGroup.add(rackFrame);

        // Amp faces - brighter
        const ampMat = new THREE.MeshStandardMaterial({ color: 0x252222 });
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

        for (let i = 0; i < 3; i++) {
            const amp = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2, 0.2), ampMat);
            amp.position.set(0, 2 - i * 2.5, 2.0);
            rackGroup.add(amp);

            // Blinking lights row
            for (let j = 0; j < 5; j++) {
                const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.1), lightMat);
                l.position.set(-1.5 + j * 0.5, 0, 0.2);
                amp.add(l);
            }

            // Dials - brighter
            const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0x777777 }));
            dial.rotation.x = Math.PI / 2;
            dial.position.set(1.5, 0, 0.2);
            amp.add(dial);
        }

        // Big Speaker at bottom - brighter
        const sub = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshStandardMaterial({ color: 0x1a1818 }));
        sub.position.set(0, -2.5, 2.05);
        rackGroup.add(sub);
        scene.add(rackGroup);

        // === EXTRA LEFT PROPS (Visible) ===
        const leftStack = new THREE.Group();
        leftStack.position.set(-14, -4, -8); // Moved closer (was -22)
        leftStack.rotation.y = 0.8;
        const box1 = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), new THREE.MeshStandardMaterial({ color: 0x4a3a2a }));
        const box2 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 2.5), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
        box2.position.y = 3.2; box2.rotation.y = 0.5;
        leftStack.add(box1); leftStack.add(box2);
        scene.add(leftStack);


        // === RIGHT GENERATOR STACK (Visible) ===
        const genGroup = new THREE.Group();
        genGroup.position.set(12, -3, -10); // Moved closer (was 20)
        genGroup.rotation.y = -0.6;

        const genBase = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 4), new THREE.MeshStandardMaterial({ color: 0x334433 }));
        genGroup.add(genBase);

        // Coils / Vents
        const ventMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        for (let i = 0; i < 3; i++) {
            const vent = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16), ventMat);
            vent.rotation.x = Math.PI / 2;
            vent.position.set(0, 1.5 - i * 1.5, 2.1);
            genGroup.add(vent);
        }
        scene.add(genGroup);

        // Ceiling Fan (Industrial)
        const fanGroup = new THREE.Group();
        fanGroup.position.set(0, 10, -5);
        const bladeGeo = new THREE.BoxGeometry(12, 0.2, 1);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
        const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
        blade2.rotation.y = Math.PI / 2;
        fanGroup.add(blade1); fanGroup.add(blade2);
        scene.add(fanGroup);

        // Animate fan (simple)
        const animateFan = () => {
            fanGroup.rotation.y += 0.01;
            requestAnimationFrame(animateFan);
        };
        animateFan();

        // Random Cables hanging
        const cableCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-10, 15, -5),
            new THREE.Vector3(-4, 9, -5),
            new THREE.Vector3(4, 12, -5),
            new THREE.Vector3(10, 15, -5),
        ]);
        const cableGeo = new THREE.TubeGeometry(cableCurve, 20, 0.1, 8, false);
        const cableMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const looseCable = new THREE.Mesh(cableGeo, cableMat);
        scene.add(looseCable);

        // Right Stack Clutter - closer
        const clutter2 = new THREE.Mesh(boxGeo, boxMat); clutter2.position.set(12, -6.5, -18); clutter2.rotation.y = -0.3; scene.add(clutter2);
        const clutter3 = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 2), boxMat); clutter3.position.set(10, -5, -19); clutter3.rotation.y = 0.4; scene.add(clutter3);

        // === DEALER LAIR FOG (Static/Environmental) ===
        const createDirtySkinTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            // Pale dead skin base
            ctx.fillStyle = '#e0c0b0';
            ctx.fillRect(0, 0, 512, 512);
            // Dirty noise
            for (let i = 0; i < 1000; i++) {
                ctx.fillStyle = 'rgba(50, 40, 30, 0.2)';
                ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            return tex;
        };
        const createFogSprite = () => {
            const spriteMat = new THREE.SpriteMaterial({
                map: createDirtySkinTexture(), // Recycling texture for noise
                color: 0x121212, // Lighter Dark Grey
                transparent: true,
                opacity: 0.25,
                blending: THREE.NormalBlending
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(8, 8, 1);
            return sprite;
        };

        const envFogGroup = new THREE.Group();
        envFogGroup.name = 'ENV_DEALER_FOG';
        // Center it where the dealer sits
        envFogGroup.position.set(0, 3, -8);

        for (let i = 0; i < 16; i++) {
            const spr = createFogSprite();
            // Spread it around the dealer's general area
            spr.position.set(
                (Math.random() - 0.5) * 8,    // Wider spread
                -2 + (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6
            );
            spr.scale.setScalar(8 + Math.random() * 5);
            envFogGroup.add(spr);
        }
        scene.add(envFogGroup);

        // === LEFT CUPBOARD PROPS ===
        // === LEFT SIDE - ROD CUPBOARD / SHELF ===
        // === LEFT SIDE - ROD CUPBOARD / SHELF ===
        // === LEFT SIDE - ROD CUPBOARD / SHELF ===
        const leftShelfGroup = new THREE.Group();
        // Positioned on the floor, larger and more visible
        leftShelfGroup.position.set(-14, -8, 4);
        leftShelfGroup.rotation.y = 0.4;
        leftShelfGroup.scale.set(2.0, 2.0, 2.0); // HUGE

        // Metal Frame (Rods)
        const rodMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.4 });
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });

        // Vertical Rods - Taller
        const rodGeo = new THREE.CylinderGeometry(0.1, 0.1, 14, 8);
        const rod1 = new THREE.Mesh(rodGeo, rodMat); rod1.position.set(-1.8, 0, 1); leftShelfGroup.add(rod1);
        const rod2 = new THREE.Mesh(rodGeo, rodMat); rod2.position.set(1.8, 0, 1); leftShelfGroup.add(rod2);
        const rod3 = new THREE.Mesh(rodGeo, rodMat); rod3.position.set(-1.8, 0, -1); leftShelfGroup.add(rod3);
        const rod4 = new THREE.Mesh(rodGeo, rodMat); rod4.position.set(1.8, 0, -1); leftShelfGroup.add(rod4);

        // Shelves - More floors
        const shelfGeo = new THREE.BoxGeometry(3.8, 0.1, 2.2);
        for (let y = -6; y <= 6; y += 3) {
            const shelf = new THREE.Mesh(shelfGeo, shelfMat);
            shelf.position.y = y;
            leftShelfGroup.add(shelf);
        }

        // Boxes on top - SCALED UP
        const boxPropMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const shelfBox1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), boxPropMat); // Larger box
        shelfBox1.position.set(-0.5, 6.7, 0); // Adjusted height
        shelfBox1.rotation.y = 0.2;
        leftShelfGroup.add(shelfBox1);

        const shelfBox2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), boxPropMat); // Larger box
        shelfBox2.position.set(0.6, 6.6, 0.2);
        shelfBox2.rotation.y = -0.4;
        leftShelfGroup.add(shelfBox2);

        scene.add(leftShelfGroup);

        // Light for left shelf
        const shelfLight = new THREE.PointLight(0x5a4a3a, 10.0, 30);
        shelfLight.position.set(-10, 0, 5);
        scene.add(shelfLight);

        // === RIGHT SIDE - INDUSTRIAL RACK (Reference Image Style) ===
        const rightRackGroup = new THREE.Group();
        // Positioned higher up and larger
        rightRackGroup.position.set(13, -1, 4);
        rightRackGroup.rotation.y = -0.5;
        rightRackGroup.scale.set(1.5, 1.5, 1.5);

        // Main Console Body
        const rackMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.5 });
        const rackBody = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 1.5), rackMat);
        rightRackGroup.add(rackBody);

        // Side Speaker/Vent
        const ventBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 1.2), rackMat);
        ventBody.position.set(-2.2, -0.15, 0.2);
        ventBody.rotation.z = 0.1; // Tilted slightly like image
        rightRackGroup.add(ventBody);

        // Vent Circle
        const ventCircle = new THREE.Mesh(
            new THREE.CircleGeometry(0.5, 16),
            new THREE.MeshStandardMaterial({ color: 0x111111, side: THREE.DoubleSide })
        );
        ventCircle.position.set(-2.2, -0.2, 0.81);
        rightRackGroup.add(ventCircle);

        // Glowing Panels
        const panelGeo = new THREE.PlaneGeometry(0.8, 0.3);
        const panelMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green lights
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(0.5, 0.6, 0.76);
        rightRackGroup.add(panel);

        // Wires (Curves)
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(1, 0, 0.8),
            new THREE.Vector3(1.5, -1, 1.5),
            new THREE.Vector3(1.2, -3, 2),
            new THREE.Vector3(2, -5, 1)
        ]);
        const rackWireGeo = new THREE.TubeGeometry(curve, 8, 0.05, 4, false);
        const rackWireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const rackWires = new THREE.Mesh(rackWireGeo, rackWireMat);
        rightRackGroup.add(rackWires);

        // Prop on top: Mug (White Cylinder with Handle)
        const mugGroup = new THREE.Group();
        mugGroup.position.set(0.5, 1.25, 0);
        mugGroup.rotation.y = 0.5;

        const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
        mugBody.position.y = 0.25;
        mugGroup.add(mugBody);

        // Handle
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 12), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
        handle.position.set(0.25, 0.25, 0);
        mugGroup.add(handle);

        rightRackGroup.add(mugGroup);

        scene.add(rightRackGroup);

        // Light for right rack (Greenish)
        const rackLight = new THREE.PointLight(0x22ff22, 8.0, 25);
        rackLight.position.set(10, 2, 5);
        scene.add(rackLight);

        // Center Back - Metal Drum / Barrel - brighter
        const drumGeo = new THREE.CylinderGeometry(1.5, 1.5, 4, 16);
        const drumMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.65, metalness: 0.5 });
        const drum = new THREE.Mesh(drumGeo, drumMat);
        drum.position.set(2, -6, -22);
        scene.add(drum);

        // === CRT SECURITY TELEVISION (Left Side) ===
        const leftTvGroup = new THREE.Group();
        leftTvGroup.position.set(-12, 1.0, -4);
        leftTvGroup.rotation.y = 0.8;
        leftTvGroup.scale.set(1.2, 1.2, 1.2);

        const tvCaseMat = new THREE.MeshStandardMaterial({ color: 0x2d302e, metalness: 0.5, roughness: 0.5 });
        const leftTvCase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 1.8), tvCaseMat);
        leftTvGroup.add(leftTvCase);

        const leftTvBevel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 0.1), tvCaseMat);
        leftTvBevel.position.set(0, 0, 0.9);
        leftTvGroup.add(leftTvBevel);

        const leftTvScreenMat = new THREE.MeshStandardMaterial({
            color: 0x113322,
            emissive: 0x00cc55, // Glowing Green Screen
            emissiveIntensity: 3.0,
            roughness: 0.1,
            metalness: 0.9
        });
        const leftTvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 0.05), leftTvScreenMat);
        leftTvScreen.position.set(-0.1, 0, 0.95);
        leftTvGroup.add(leftTvScreen);

        // TV Knobs
        const knobMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
        const leftDial1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8), knobMat);
        leftDial1.rotation.x = Math.PI / 2;
        leftDial1.position.set(0.7, 0.4, 0.95);
        leftTvGroup.add(leftDial1);

        const leftDial2 = leftDial1.clone();
        leftDial2.position.set(0.7, 0.0, 0.95);
        leftTvGroup.add(leftDial2);

        const leftTvLight = new THREE.SpotLight(0x00ff88, 25.0, 20);
        leftTvLight.position.set(0, 0, 1.0);
        leftTvLight.target.position.set(5, -1, 3); // Aim towards table center
        leftTvGroup.add(leftTvLight);
        leftTvGroup.add(leftTvLight.target);

        scene.add(leftTvGroup);


        // === TERMINAL SCREEN (Right Side) ===
        const rightTvGroup = new THREE.Group();
        rightTvGroup.position.set(12, 1.5, -4);
        rightTvGroup.rotation.y = -0.8;
        rightTvGroup.scale.set(1.1, 1.1, 1.1);

        const rightTvCase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.6), tvCaseMat);
        rightTvGroup.add(rightTvCase);

        const rightTvBevel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 0.1), tvCaseMat);
        rightTvBevel.position.set(0, 0, 0.8);
        rightTvGroup.add(rightTvBevel);

        const rightTvScreenMat = new THREE.MeshStandardMaterial({
            color: 0x331111,
            emissive: 0xff3300, // Glowing Amber/Red terminal screen
            emissiveIntensity: 2.5,
            roughness: 0.1,
            metalness: 0.9
        });
        const rightTvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.05), rightTvScreenMat);
        rightTvScreen.position.set(-0.1, 0, 0.85);
        rightTvGroup.add(rightTvScreen);

        // TV Knobs
        const rightDial1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8), knobMat);
        rightDial1.rotation.x = Math.PI / 2;
        rightDial1.position.set(0.8, 0.3, 0.85);
        rightTvGroup.add(rightDial1);

        const rightDial2 = rightDial1.clone();
        rightDial2.position.set(0.8, -0.1, 0.85);
        rightTvGroup.add(rightDial2);

        const rightTvLight = new THREE.SpotLight(0xff4400, 20.0, 20);
        rightTvLight.position.set(0, 0, 0.9);
        rightTvLight.target.position.set(-5, -1, 3); // Aim towards table center
        rightTvGroup.add(rightTvLight);
        rightTvGroup.add(rightTvLight.target);

        scene.add(rightTvGroup);

        // Floor Debris (Random papers/scraps)
        if (!isMobile) {
            const debrisGeo = new THREE.PlaneGeometry(0.3, 0.4);
            const debrisMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide });
            for (let i = 0; i < 15; i++) {
                const debris = new THREE.Mesh(debrisGeo, debrisMat);
                debris.position.set((Math.random() - 0.5) * 15, -7.95, (Math.random() - 0.5) * 15 - 5);
                debris.rotation.x = -Math.PI / 2;
                debris.rotation.z = Math.random() * 2 * Math.PI;
                scene.add(debris);
            }
        }

        // Background point lights for ominous depth - Increased intensity
        const clutterLight = new THREE.PointLight(0x778899, 30, 60);
        clutterLight.position.set(0, 10, -20);
        scene.add(clutterLight);

        // Extra Fill for far corners
        const bgFill = new THREE.PointLight(0x443322, 10, 40); // Brighter
        bgFill.position.set(-20, 0, -25);
        scene.add(bgFill);
        const bgFill2 = new THREE.PointLight(0x223344, 10, 40); // Brighter
        bgFill2.position.set(20, 0, -25);
        scene.add(bgFill2);

        // Central Blue Rim for Back Wall depth
        const bgBlueRim = new THREE.SpotLight(0x445566, 15.0);
        bgBlueRim.position.set(0, -5, -20);
        bgBlueRim.target.position.set(0, 5, -28);
        bgBlueRim.angle = 1.0;
        bgBlueRim.penumbra = 0.5;
        scene.add(bgBlueRim);
        scene.add(bgBlueRim.target);

        // --- INDUSTRIAL PIPES & VENTS --- (Using materials defined above)

        // Ceiling Piping
        const pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 40), pipeMat);
        pipe1.rotation.z = Math.PI / 2; pipe1.position.set(0, 12, -15);
        scene.add(pipe1);

        const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 40), rustMat);
        pipe2.rotation.z = Math.PI / 2; pipe2.position.set(0, 13, -12);
        scene.add(pipe2);

        // Vertical pipes in background
        const vPipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 20), pipeMat);
        vPipe1.position.set(-18, 5, -22);
        scene.add(vPipe1);

        const vPipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 20), rustMat);
        vPipe2.position.set(15, 5, -22);
        scene.add(vPipe2);

        // Vent Fan (brighter materials)
        const fanHousing = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 2), new THREE.MeshStandardMaterial({ color: 0x2a2828 }));
        fanHousing.position.set(8, 5, -25);
        scene.add(fanHousing);
        const fanBlades = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x1a1818 }));
        fanBlades.rotation.x = Math.PI / 2; fanBlades.position.set(8, 5, -24);
        scene.add(fanBlades);

        // Grimy Monitor/Terminal (brighter)
        const terminal = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 2), new THREE.MeshStandardMaterial({ color: 0x252222 }));
        terminal.position.set(-10, -5, -20); terminal.rotation.y = 0.4;
        scene.add(terminal);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.8), new THREE.MeshStandardMaterial({ color: 0x004400, emissive: 0x00ff00, emissiveIntensity: 0.4 }));
        screen.position.set(-10, -5, -18.9); screen.rotation.y = 0.4;
        scene.add(screen);
    }

    // === BRICK WALLS === (With emissive for visibility)
    const brickTex = ultraPerformanceMode ? null : createBrickTexture();
    if (brickTex) brickTex.repeat.set(2, 2);
    const brickMat = ultraPerformanceMode
        ? new THREE.MeshBasicMaterial({ color: 0x060505 })
        : (balancedPerformance
            ? new THREE.MeshLambertMaterial({ map: brickTex || undefined, color: 0xbb8877 })
            : new THREE.MeshStandardMaterial({
                map: brickTex || undefined,
                color: 0xbb8877,
                roughness: 0.8,
                metalness: 0.1,
                emissive: 0x1a1210,
                emissiveIntensity: 0.15
            }));

    // Side Walls - further away for open feel
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), brickMat);
    leftWall.position.set(-20, 5, -12); // Moved out and back (was -15, -5)
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = !isMobile && !ultraPerformanceMode && !balancedPerformance;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), brickMat);
    rightWall.position.set(20, 5, -12); // Moved out and back
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = !isMobile && !ultraPerformanceMode && !balancedPerformance;
    scene.add(rightWall);

    // Front Wall (Behind Player) - completes room enclosure at Z = 18
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), brickMat);
    frontWall.position.set(0, 5, 18);
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = !isMobile && !ultraPerformanceMode && !balancedPerformance;
    scene.add(frontWall);

    if (!ultraPerformanceMode) {
        // Behind Props (Behind Player, Z = 17 to 17.5)
    // Horizontal ceiling pipes behind player
    const behindPipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40), pipeMat);
    behindPipe1.rotation.z = Math.PI / 2;
    behindPipe1.position.set(0, 11, 17.2);
    scene.add(behindPipe1);

    const behindPipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 40), rustMat);
    behindPipe2.rotation.z = Math.PI / 2;
    behindPipe2.position.set(0, 12, 17.5);
    scene.add(behindPipe2);

    // Vertical pipes behind player
    const behindVPipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 20), pipeMat);
    behindVPipe1.position.set(-15, 5, 17.3);
    scene.add(behindVPipe1);

    const behindVPipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 20), rustMat);
    behindVPipe2.position.set(15, 5, 17.3);
    scene.add(behindVPipe2);

    // === STAGE LIGHTS (Barn Doors) - ENHANCED WITH GLOW ===
    const createStageLight = (x: number, y: number, z: number, targetX: number, targetY: number, targetZ: number) => {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.lookAt(targetX, targetY, targetZ);

        const housingMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.7 });

        // Main Can
        const can = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 3, 16), housingMat);
        can.rotation.x = Math.PI / 2;
        group.add(can);

        // Lens/Bulb - ENHANCED with brighter emissive
        const lensMat = new THREE.MeshStandardMaterial({
            color: 0xffcc88,
            emissive: 0xffaa66,
            emissiveIntensity: 2.5,
            toneMapped: false
        });
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 32), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 1.6;
        group.add(lens);

        // Inner bright core
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffee,
            transparent: true,
            opacity: 0.9
        });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), coreMat);
        core.position.z = 1.5;
        group.add(core);

        // Barn Doors
        const doorGeo = new THREE.BoxGeometry(2.5, 2.5, 0.1);
        const topDoor = new THREE.Mesh(doorGeo, housingMat);
        topDoor.position.set(0, 1.6, 2.0);
        topDoor.rotation.x = Math.PI / 3;
        group.add(topDoor);

        const bottomDoor = new THREE.Mesh(doorGeo, housingMat);
        bottomDoor.position.set(0, -1.6, 2.0);
        bottomDoor.rotation.x = -Math.PI / 3;
        group.add(bottomDoor);

        const leftDoor = new THREE.Mesh(doorGeo, housingMat);
        leftDoor.position.set(-1.6, 0, 2.0);
        leftDoor.rotation.y = -Math.PI / 3;
        group.add(leftDoor);

        const rightDoor = new THREE.Mesh(doorGeo, housingMat);
        rightDoor.position.set(1.6, 0, 2.0);
        rightDoor.rotation.y = Math.PI / 3;
        group.add(rightDoor);

        // Hanging Yoke
        const yoke = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.2, 4, 16, Math.PI), housingMat);
        yoke.rotation.z = Math.PI / 2;
        yoke.rotation.x = Math.PI / 2;
        yoke.position.y = 0;
        group.add(yoke);

        // === ENHANCED GLOW EFFECTS ===

        // Inner bright glow sprite
        const innerGlowMat = new THREE.SpriteMaterial({
            map: generateGlowTexture(),
            color: 0xffffcc,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const innerGlow = new THREE.Sprite(innerGlowMat);
        innerGlow.position.set(0, 0, 1.7);
        innerGlow.scale.set(3, 3, 1);
        group.add(innerGlow);

        // Outer soft glow
        const outerGlowMat = new THREE.SpriteMaterial({
            map: generateGlowTexture(),
            color: 0xffaa55,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const outerGlow = new THREE.Sprite(outerGlowMat);
        outerGlow.position.set(0, 0, 2.0);
        outerGlow.scale.set(8, 8, 1);
        group.add(outerGlow);



        scene.add(group);
    };

    createStageLight(-12, 10, -15, 0, 0, 0);
    createStageLight(12, 10, -15, 0, 0, 0);

    // === BACK WALL SPEAKERS/TECH (From Reference) ===
    const createSpeaker = (x: number, y: number, z: number, ry: number) => {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = ry;

        // Cabinet
        const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 3), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
        group.add(cab);

        // Speaker Cone
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x050505 }));
        cone.rotation.x = -Math.PI / 2;
        cone.position.z = 1.5;
        cone.position.y = -1;
        group.add(cone);

        // Tweeter
        const tweet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x050505 }));
        tweet.rotation.x = Math.PI / 2;
        tweet.position.set(0, 1.5, 1.5);
        group.add(tweet);

        scene.add(group);
    };

    createSpeaker(-12, 1, -26, 0.4);
    createSpeaker(12, 1, -26, -0.4);


    // --- CAGE / FENCE BACKGROUND ---
    const fenceGroup = new THREE.Group();
    const wireFMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.5 });

    // Horizontal Bars
    for (let i = 0; i < 6; i++) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 50), wireFMat);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, -5 + i * 2, -18);
        fenceGroup.add(bar);
    }
    // Vertical Bars
    for (let i = -12; i <= 12; i += 2) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 14), wireFMat);
        bar.position.set(i * 2, 0, -18);
        fenceGroup.add(bar);
    }
    scene.add(fenceGroup);
    }
};

export const createDust = (scene: THREE.Scene, isMobile: boolean = false, ultraPerformance: boolean = false) => {
    const settings = scene.userData.settings || {};
    const ultraPerformanceMode = ultraPerformance || !!settings.ultraPerformance;
    // ═══════════════════════════════════════════════════════════════
    // ATMOSPHERIC DUST PARTICLES - Subtle and sparse
    // ═══════════════════════════════════════════════════════════════

    if (ultraPerformanceMode) return null;

    const particleCount = isMobile ? 5 : 20; // Reduced particle count
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        // Spread particles in the scene
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = Math.random() * 15 + 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 25;

        // Slow, lazy drifting
        velocities[i * 3] = (Math.random() - 0.5) * 0.01;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    // Subtle dust color
    const material = new THREE.PointsMaterial({
        color: 0xbbaa88,
        size: 0.12, // Smaller
        transparent: true,
        opacity: 0.2, // Less visible
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    particles.name = 'DUST_PARTICLES';
    scene.add(particles);

    return particles;
};

export const createTable = (scene: THREE.Scene, ultraPerformance: boolean = false) => {
    const settings = scene.userData.settings || {};
    const ultraPerformanceMode = ultraPerformance || !!settings.ultraPerformance;
    const balancedPerformance = !!settings.balancedPerformance;
    
    const tableGroup = new THREE.Group();
    tableGroup.name = 'TABLE_GROUP';

    // ═══════════════════════════════════════════════════════════════
    // BUCKSHOT ROULETTE STYLE TABLE - Industrial worn metal & felt
    // ═══════════════════════════════════════════════════════════════

    // Generate Procedural Table Texture
    const tableTex = ultraPerformanceMode ? null : createTableTexture();

    // Table Top - Worn green felt with glowing lines
    const tableMat = ultraPerformanceMode
        ? new THREE.MeshBasicMaterial({ color: 0x1c2814 }) // flat green
        : (balancedPerformance
            ? new THREE.MeshLambertMaterial({ map: tableTex || undefined, color: 0x666655 })
            : new THREE.MeshStandardMaterial({
                map: tableTex || undefined,
                color: 0x666655, // Slightly desaturated
                roughness: 0.85,
                metalness: 0.05,
                emissiveMap: tableTex || undefined,
                emissive: 0x443322, // Subtle glow for lines
                emissiveIntensity: 0.15
            }));

    const top = new THREE.Mesh(new THREE.BoxGeometry(20, 0.6, 18), tableMat);
    top.position.y = -1;
    top.receiveShadow = !ultraPerformanceMode && !balancedPerformance;
    top.castShadow = !ultraPerformanceMode && !balancedPerformance;
    tableGroup.add(top);

    // ═══════════════════════════════════════════════════════════════
    // WORN INDUSTRIAL METAL RIM
    // ═══════════════════════════════════════════════════════════════

    // Create worn metal texture
    const createRimTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(canvas);

        // Base rusty metal
        ctx.fillStyle = '#1a1815';
        ctx.fillRect(0, 0, 256, 256);

        // Rust spots
        for (let i = 0; i < 200; i++) {
            const shade = Math.random();
            if (shade > 0.8) {
                ctx.fillStyle = '#3d2a1a'; // Rust color
            } else if (shade > 0.5) {
                ctx.fillStyle = '#252220'; // Dark metal
            } else {
                ctx.fillStyle = '#1c1916'; // Very dark
            }
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 8, 2 + Math.random() * 8);
        }

        // Scratches
        ctx.strokeStyle = 'rgba(40, 35, 30, 0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 30; i++) {
            ctx.beginPath();
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = (getDeviceType() === 'pc') ? 8 : 1;
        return tex;
    };

    const rimTex = ultraPerformanceMode ? null : createRimTexture();
    const rimMat = ultraPerformanceMode
        ? new THREE.MeshBasicMaterial({ color: 0x121212 }) // flat grey
        : (balancedPerformance
            ? new THREE.MeshLambertMaterial({ map: rimTex || undefined, color: 0x2a2520 })
            : new THREE.MeshStandardMaterial({
                map: rimTex || undefined,
                color: 0x2a2520,
                roughness: 0.75,
                metalness: 0.7
            }));

    // Thicker industrial rim
    const rimHeight = 1.2;
    const rimThickness = 0.8;

    // Front/Back rims - shorter width (19)
    const rimF = new THREE.Mesh(new THREE.BoxGeometry(19, rimHeight, rimThickness), rimMat);
    rimF.position.set(0, -0.6, 7.4); // Adjusted Z
    rimF.castShadow = !ultraPerformanceMode && !balancedPerformance;
    tableGroup.add(rimF);

    const rimB = new THREE.Mesh(new THREE.BoxGeometry(19, rimHeight, rimThickness), rimMat);
    rimB.position.set(0, -0.6, -7.4); // Adjusted Z
    rimB.castShadow = !ultraPerformanceMode && !balancedPerformance;
    tableGroup.add(rimB);

    // Left/Right rims - shorter length (14)
    const rimL = new THREE.Mesh(new THREE.BoxGeometry(rimThickness, rimHeight, 14), rimMat);
    rimL.position.set(-9.4, -0.6, 0); // Adjusted X
    rimL.castShadow = !ultraPerformanceMode && !balancedPerformance;
    tableGroup.add(rimL);

    const rimR = new THREE.Mesh(new THREE.BoxGeometry(rimThickness, rimHeight, 14), rimMat);
    rimR.position.set(9.4, -0.6, 0); // Adjusted X
    rimR.castShadow = !ultraPerformanceMode && !balancedPerformance;
    tableGroup.add(rimR);

    // ═══════════════════════════════════════════════════════════════
    // HEAVY INDUSTRIAL LEGS
    // ═══════════════════════════════════════════════════════════════

    const legMat = ultraPerformance
        ? new THREE.MeshBasicMaterial({ color: 0x0a0a0a })
        : new THREE.MeshStandardMaterial({
            color: 0x151210,
            roughness: 0.8,
            metalness: 0.4
        });

    // Chunky square legs
    const legGeo = new THREE.BoxGeometry(1.2, 8, 1.2);
    const legPositions = [
        [-8, -5, -6], // Adjusted leg positions
        [8, -5, -6],
        [-8, -5, 6],
        [8, -5, 6]
    ];

    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        leg.castShadow = !ultraPerformance;
        tableGroup.add(leg);

        // Add decorative bolts
        const boltMat = ultraPerformance
            ? new THREE.MeshBasicMaterial({ color: 0x181818 })
            : new THREE.MeshStandardMaterial({ color: 0x3a3530, metalness: 0.8, roughness: 0.4 });
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 6), boltMat);
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(pos[0], pos[1] + 3, pos[2] + 0.6);
        tableGroup.add(bolt);
    });

    // Cross-braces under table
    const braceMat = ultraPerformance
        ? new THREE.MeshBasicMaterial({ color: 0x080808 })
        : new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.8 });
    const braceGeo = new THREE.BoxGeometry(0.5, 0.5, 20);

    const brace1 = new THREE.Mesh(braceGeo, braceMat);
    brace1.position.set(-12, -3, 0);
    tableGroup.add(brace1);

    const brace2 = new THREE.Mesh(braceGeo, braceMat);
    brace2.position.set(12, -3, 0);
    tableGroup.add(brace2);

    scene.add(tableGroup);
    return top;
};
