import * as THREE from 'three';

export const createPlayerAvatar = (scene: THREE.Scene, position: THREE.Vector3, rotationY: number, name: string, hp: number = 4, maxHp: number = 4) => {
    const avatarGroup = new THREE.Group();
    avatarGroup.name = 'PLAYER_' + name;
    avatarGroup.position.copy(position);
    avatarGroup.rotation.y = rotationY;

    const settings = scene.userData.settings || {};
    const ultraPerformance = !!settings.ultraPerformance;
    const balancedPerformance = !!settings.balancedPerformance;

    const skinMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0xffccaa }) 
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0xffccaa }) 
            : new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 }));
            
    const suitMat = ultraPerformance 
        ? new THREE.MeshBasicMaterial({ color: 0x222222 }) 
        : (balancedPerformance 
            ? new THREE.MeshLambertMaterial({ color: 0x222222 }) 
            : new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }));

    // Body
    const torso = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 2.5), suitMat);
    torso.position.set(0, 3, 0);
    torso.castShadow = true;
    torso.name = "TORSO";
    avatarGroup.add(torso);

    // Head (Normal Sphere)
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), skinMat);
    head.position.set(0, 7.5, 0);
    head.castShadow = true;
    head.name = "HEAD";
    avatarGroup.add(head);

    // Sunglasses
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    glasses.position.set(0, 7.6, 1.3);
    avatarGroup.add(glasses);

    // Arms
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 7), suitMat);
    lArm.position.set(-3, 3, 0); lArm.rotation.z = 0.2;
    lArm.castShadow = true;
    lArm.name = "LEFT_ARM";
    avatarGroup.add(lArm);
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 7), suitMat);
    rArm.position.set(3, 3, 0); rArm.rotation.z = -0.2;
    rArm.castShadow = true;
    rArm.name = "RIGHT_ARM";
    avatarGroup.add(rArm);

    // === HEALTH BAR REMOVED AT USER REQUEST ===
    /*
    const hpGroup = new THREE.Group();
    hpGroup.position.set(0, 10.5, 0);

    const hpBgGeo = new THREE.PlaneGeometry(4, 0.5);
    const hpBg = new THREE.Mesh(hpBgGeo, new THREE.MeshBasicMaterial({ color: 0x331111, side: THREE.DoubleSide }));
    hpGroup.add(hpBg);

    const hpWidth = (hp / maxHp) * 3.8;
    const hpFillGeo = new THREE.PlaneGeometry(hpWidth, 0.4);
    const hpFill = new THREE.Mesh(hpFillGeo, new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
    hpFill.position.x = (hpWidth - 3.8) / 2;
    hpFill.position.z = 0.01;
    hpGroup.add(hpFill);

    avatarGroup.add(hpGroup);
    avatarGroup.userData.hpGroup = hpGroup;
    avatarGroup.userData.hpFill = hpFill;
    avatarGroup.userData.maxHp = maxHp;
    */

    // === NAME TAG ===
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.toUpperCase(), 128, 32);
    }
    const nameTex = new THREE.CanvasTexture(canvas);
    const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex, transparent: true }));
    nameSprite.position.set(0, 11.5, 0);
    nameSprite.scale.set(4, 1, 1);
    avatarGroup.add(nameSprite);

    // === CHAT BUBBLE ===
    const chatGroup = new THREE.Group();
    chatGroup.position.set(0, 13, 0);
    avatarGroup.add(chatGroup);
    avatarGroup.userData.chatGroup = chatGroup;
    avatarGroup.userData.playerName = name;

    scene.add(avatarGroup);
    return avatarGroup;
};

// Helper to update player health bar
export const updatePlayerHealth = (avatarGroup: THREE.Group, hp: number) => {
    const hpFill = avatarGroup.userData.hpFill as THREE.Mesh;
    const maxHp = avatarGroup.userData.maxHp || 4;
    if (hpFill) {
        const hpWidth = Math.max(0.1, (hp / maxHp) * 3.8);
        hpFill.scale.x = hp / maxHp;
        hpFill.position.x = (hpWidth - 3.8) / 2;
    }
};

// Helper to show chat bubble
export const showChatBubble = (avatarGroup: THREE.Group, message: string) => {
    const chatGroup = avatarGroup.userData.chatGroup as THREE.Group;
    if (!chatGroup) return;

    // Clear existing
    while (chatGroup.children.length) chatGroup.remove(chatGroup.children[0]);

    // Create bubble
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 512, 100, 20);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxLen = 30;
        const text = message.length > maxLen ? message.substring(0, maxLen) + '...' : message;
        ctx.fillText(text, 256, 50);
    }
    const bubbleTex = new THREE.CanvasTexture(canvas);
    const bubbleSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true }));
    bubbleSprite.scale.set(6, 1.5, 1);
    chatGroup.add(bubbleSprite);

    // Auto-remove after delay
    setTimeout(() => {
        if (chatGroup.children.length) chatGroup.remove(bubbleSprite);
    }, 4000);
};
