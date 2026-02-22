import * as THREE from 'three';
import { SceneContext, SceneProps } from '../../types';
import { audioManager } from '../audioManager';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _vBullet = new THREE.Vector3();

export function updateParticles(p: THREE.Points, limit: number) {
    const pos = p.geometry.attributes.position.array as Float32Array;
    const vel = p.geometry.attributes.velocity.array as Float32Array;
    const len = pos.length;
    // Optimization: avoid Math.abs overhead and repeated array access
    // Iterate by 3 to skip multiplication
    for (let i = 0; i < len; i += 3) {
        let x = pos[i] + vel[i];
        let y = pos[i + 1] + vel[i + 1];
        let z = pos[i + 2] + vel[i + 2];

        if (Math.abs(x) > limit) x *= -0.9;
        if (Math.abs(y) > 15) y *= -0.9;
        if (Math.abs(z) > 20) z *= -0.9;

        pos[i] = x;
        pos[i + 1] = y;
        pos[i + 2] = z;
    }
    p.geometry.attributes.position.needsUpdate = true;
}

export function updateShell(shell: THREE.Mesh, vel: THREE.Vector3, time: number, dt: number) {
    const timeScale = dt / 0.0166;
    if (shell.visible) {
        shell.position.x += vel.x * timeScale;
        shell.position.y += vel.y * timeScale;
        shell.position.z += vel.z * timeScale;
        vel.y -= 0.012 * timeScale; // Lighter gravity

        // Only tumble while moving fast
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
        if (speed > 0.02) {
            shell.rotation.x += speed * 0.5 * timeScale;
            shell.rotation.z += speed * 0.3 * timeScale;
        }

        // Ground/Table collision (Table height approx -0.85)
        if (shell.position.y < -0.85) {
            shell.position.y = -0.85;
            vel.y = -vel.y * 0.25; // Less bounce
            vel.x *= 0.5; // More friction
            vel.z *= 0.5;

            // Stop quickly when slow
            if (Math.abs(vel.y) < 0.03) {
                vel.y = 0;
            }
            if (Math.abs(vel.x) < 0.005 && Math.abs(vel.z) < 0.005) {
                vel.x = 0;
                vel.z = 0;

                // Mark when shell landed (for 15 second despawn timer)
                if (!shell.userData.landedAt) {
                    shell.userData.landedAt = time;
                }
            }
        }

        // Check if shell has been on table for 15 seconds
        if (shell.userData.landedAt && time - shell.userData.landedAt > 15) {
            shell.visible = false;
            shell.userData.landedAt = null;
        }

        // Keep shell on table - clamp position instead of letting it fall (GC Optimization)
        if (shell.position.y < -0.5) {
            shell.position.x = Math.max(-10, Math.min(10, shell.position.x));
            shell.position.z = Math.max(-8, Math.min(8, shell.position.z));
        }

        // Despawn only if fallen through floor somehow
        if (shell.position.y < -5) {
            shell.visible = false;
            shell.userData.landedAt = null;
        }
    }
}

export function updateBullet(bullet: THREE.Mesh, dt: number) {
    if (bullet.visible) {
        const speed = 5.0;
        const moveDist = speed * (dt / 0.0166);
        const dir = bullet.userData.velocity as THREE.Vector3;
        if (dir) {
            // Optimization: avoid clone()
            _vBullet.copy(dir).multiplyScalar(moveDist);
            bullet.position.add(_vBullet);
        }
        if (bullet.position.distanceTo(_v1.set(0, 0, 0)) > 60) bullet.visible = false;
    }
}

export function updateBlood(p: THREE.Points, dt: number) {
    const bPos = p.geometry.attributes.position.array as Float32Array;
    const bVel = p.geometry.attributes.velocity.array as Float32Array;
    const timeScale = dt / 0.0166;
    let activeBlood = false;
    for (let i = 0; i < bPos.length / 3; i++) {
        const idx = i * 3;
        if (bPos[idx + 1] < 100) {
            activeBlood = true;
            bPos[idx] += bVel[idx] * timeScale;
            bPos[idx + 1] += bVel[idx + 1] * timeScale;
            bPos[idx + 2] += bVel[idx + 2] * timeScale;
            bVel[idx + 1] -= 0.05 * timeScale; // Heavier gravity

            // Floor Collision
            if (bPos[idx + 1] < -9) {
                bPos[idx + 1] -= 0.02 * timeScale; // Slowly sink into ground
                bVel[idx] *= 0.8; // Friction
                bVel[idx + 1] = 0;
                bVel[idx + 2] *= 0.8;
            }

            // Recycle after falling way below
            if (bPos[idx + 1] < -15) bPos[idx + 1] = 9999;
        }
    }
    if (activeBlood) p.geometry.attributes.position.needsUpdate = true;
}

export function updateSparks(p: THREE.Points, dt: number) {
    const sPosArr = p.geometry.attributes.position.array as Float32Array;
    const sVelArr = p.geometry.attributes.velocity.array as Float32Array;
    const timeScale = dt / 0.0166;
    let activeSparks = false;
    for (let i = 0; i < sPosArr.length / 3; i++) {
        const idx = i * 3;
        if (sPosArr[idx + 1] < 100) {
            activeSparks = true;
            sPosArr[idx] += sVelArr[idx] * timeScale;
            sPosArr[idx + 1] += sVelArr[idx + 1] * timeScale;
            sPosArr[idx + 2] += sVelArr[idx + 2] * timeScale;
            sVelArr[idx + 1] -= 0.02 * timeScale;
            if (sPosArr[idx + 1] < -2) sPosArr[idx + 1] = 9999;
        }
    }
    if (activeSparks) p.geometry.attributes.position.needsUpdate = true;
}

export function updateItemAnimations(context: SceneContext, props: SceneProps, time: number, dt: number) {
    const items = context.itemsGroup;
    const scene = context.scene;
    const camera = context.camera;
    const animState = props.animState;
    const isPlayerTurn = props.turnOwner === 'PLAYER';

    const easeOutBack = (t: number) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    const easeOutElastic = (t: number) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    };

    if (items) {
        // ITEM LIGHT HELPER - Illuminate visible items
        // ITEM LIGHT HELPER - Illuminate visible items
        const updateItemLight = () => {
            if (!items.itemLight) return;

            // Check which item is currently visible - Optimized to avoid array creation
            let activeItem = null;
            if (items.itemBeer.visible) activeItem = items.itemBeer;
            else if (items.itemCigs.visible) activeItem = items.itemCigs;
            else if (items.itemSaw.visible) activeItem = items.itemSaw;
            else if (items.itemCuffs.visible) activeItem = items.itemCuffs;
            else if (items.itemGlass.visible) activeItem = items.itemGlass;
            else if (items.itemPhone.visible) activeItem = items.itemPhone;
            else if (items.itemInverter.visible) activeItem = items.itemInverter;
            else if (items.itemAdrenaline.visible) activeItem = items.itemAdrenaline;

            if (activeItem) {
                items.itemLight.position.copy(activeItem.position);
                items.itemLight.position.y += 2;
                items.itemLight.position.z += 3;

                const isDealerItem = activeItem.position.z < -2;
                const isHardMode = props.isHardMode;

                if (isHardMode) {
                    const pulse = Math.pow(Math.sin(time * 1.5), 10.0);
                    // Tint item light red during hard mode
                    items.itemLight.color.setRGB(1.0, 1.0 - pulse, 1.0 - pulse);
                    items.itemLight.intensity = (isDealerItem ? 45 : 25) * (1.0 + pulse * 1.5);
                    items.itemLight.distance = isDealerItem ? 35 : 25;
                } else {
                    items.itemLight.color.setHex(0xffffff);
                    items.itemLight.intensity = isDealerItem ? 35 : 15;
                    items.itemLight.distance = isDealerItem ? 30 : 20;
                }
            } else {
                items.itemLight.intensity = 0;
            }
        };

        // Initialize user data
        if (scene.userData.lastDrink === undefined) scene.userData.lastDrink = animState.triggerDrink;
        if (scene.userData.lastHeal === undefined) scene.userData.lastHeal = animState.triggerHeal;
        if (scene.userData.lastSaw === undefined) scene.userData.lastSaw = animState.triggerSparks;
        if (scene.userData.lastCuff === undefined) scene.userData.lastCuff = animState.triggerCuff;
        if (scene.userData.lastRack === undefined) scene.userData.lastRack = animState.triggerRack;
        if (scene.userData.lastGlass === undefined) scene.userData.lastGlass = animState.triggerGlass;
        if (scene.userData.lastPhone === undefined) scene.userData.lastPhone = animState.triggerPhone;
        if (scene.userData.lastInverter === undefined) scene.userData.lastInverter = animState.triggerInverter;
        if (scene.userData.lastAdrenaline === undefined) scene.userData.lastAdrenaline = animState.triggerAdrenaline;

        // GLASS ANIMATION
        if (animState.triggerGlass < scene.userData.lastGlass) scene.userData.lastGlass = animState.triggerGlass;
        if (animState.triggerGlass > scene.userData.lastGlass) {
            scene.userData.lastGlass = animState.triggerGlass;
            scene.userData.glassStart = time;
            items.itemGlass.visible = true;
            audioManager.playSound('glass');
        }

        const glassTime = time - (scene.userData.glassStart || -999);
        const glassDuration = isPlayerTurn ? 2.5 : 2.5; // Longer for dealer too
        if (glassTime >= 0 && glassTime < glassDuration) {
            items.itemGlass.visible = true;

            if (isPlayerTurn) {
                if (glassTime < 0.5) {
                    const p = glassTime / 0.5;
                    const ease = easeOutBack(p);
                    items.itemGlass.position.set(0.5 - ease * 0.3, -3 + ease * 4.5, 6);
                    items.itemGlass.rotation.set(0, 0, 0);
                } else if (glassTime < 2.0) {
                    const hover = Math.sin((glassTime - 0.5) * 3);
                    items.itemGlass.position.set(Math.sin(time) * 0.3, 1.5 + Math.cos(time * 2) * 0.1, 6);
                    items.itemGlass.rotation.z = hover * 0.1;
                    items.itemGlass.rotation.x = -0.2;
                } else {
                    items.itemGlass.position.y -= 0.15;
                    items.itemGlass.visible = false; // Early hide
                }
            } else {
                // DEALER uses glass - Improved with Arc
                items.itemGlass.scale.setScalar(1.0);
                if (glassTime < 0.6) {
                    const p = glassTime / 0.6;
                    const ease = easeOutBack(p);
                    // Arc from right side
                    items.itemGlass.position.set(3.0 * (1 - ease), -2 + ease * 4.6, -4.0 + ease * 1); // Target Y approx 2.6
                    items.itemGlass.rotation.set(-0.2, 0.5 * (1 - ease), 0);
                } else if (glassTime < 2.0) {
                    // Hover at eye level (2.6)
                    items.itemGlass.position.set(
                        Math.sin(time * 2) * 0.1,
                        2.6 + Math.sin(glassTime * 3) * 0.1,
                        -3.0
                    );
                    items.itemGlass.rotation.set(-0.3, Math.sin(glassTime * 2) * 0.2, 0);
                } else {
                    const p = (glassTime - 2.0) / 0.4;
                    items.itemGlass.position.y = 2.6 - p * 6;
                    items.itemGlass.position.x = p * 4; // Throw away
                    if (glassTime > 2.3) items.itemGlass.visible = false;
                }
            }
        } else {
            items.itemGlass.visible = false;
        }

        // BEER ANIMATION
        if (animState.triggerDrink < scene.userData.lastDrink) scene.userData.lastDrink = animState.triggerDrink;
        if (animState.triggerDrink > scene.userData.lastDrink) {
            scene.userData.lastDrink = animState.triggerDrink;
            scene.userData.drinkStart = time;
            audioManager.playSound('beer');
        }
        const drinkTime = time - (scene.userData.drinkStart || -999);
        if (drinkTime >= 0 && drinkTime < 3.5) {
            items.itemBeer.visible = true;
            // Larger for player
            items.itemBeer.scale.setScalar(2.2);

            if (isPlayerTurn) {
                if (drinkTime < 0.6) {
                    const p = drinkTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemBeer.position.set(1.5 - ease * 1.2, -3 + ease * 4.5, 5);
                    items.itemBeer.rotation.set(0, 0, ease * 0.2);
                } else if (drinkTime < 2.5) {
                    const sipPhase = (drinkTime - 0.6) / 1.9;
                    const sipP = Math.min(1, sipPhase);
                    // Shake with sip
                    items.itemBeer.position.set(0.3 + (Math.random() - 0.5) * 0.02, 1.5 + Math.sin(drinkTime * 10) * 0.05, 5);
                    const tiltAmount = 0.4 + Math.sin(sipPhase * Math.PI) * 1.2;
                    items.itemBeer.rotation.set(tiltAmount, 0, 0.1);
                    camera.rotation.x = -0.2 * Math.sin(sipPhase * Math.PI); // Head tilt
                } else {
                    items.itemBeer.position.y -= 0.5; // Fast drop
                    if (drinkTime > 2.8) items.itemBeer.visible = false;
                    camera.rotation.x *= 0.9;
                }
            } else {
                // DEALER drinking beer - Organic Arc
                items.itemBeer.scale.setScalar(1.0);
                if (drinkTime < 0.6) {
                    const p = drinkTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemBeer.position.set(2.0 * (1 - ease), -2 + ease * 4.6, -4.0); // Target Y ~2.6
                    items.itemBeer.rotation.set(-0.3, 0, -0.5 * (1 - ease));
                } else if (drinkTime < 2.5) {
                    const tiltP = Math.min(1, (drinkTime - 0.6) / 0.5);
                    // Crushing can shake
                    const shake = Math.sin(time * 50) * 0.02;
                    items.itemBeer.position.set(0 + shake, 2.6 + shake, -4.0);
                    items.itemBeer.rotation.set(-0.3 - tiltP * 1.5, 0, 0);
                } else {
                    const p = (drinkTime - 2.5) / 1.0;
                    items.itemBeer.position.y = 2.6 - p * 6;
                    items.itemBeer.position.x = -p * 3; // Toss aside
                    items.itemBeer.rotation.z += 0.2;
                    if (drinkTime > 3.0) items.itemBeer.visible = false;
                }
            }
        } else {
            items.itemBeer.visible = false;
        }

        // RACK ANIMATION
        if (animState.triggerRack < scene.userData.lastRack) scene.userData.lastRack = animState.triggerRack;
        if (animState.triggerRack > scene.userData.lastRack) {
            scene.userData.lastRack = animState.triggerRack;
            scene.userData.rackStart = time;
        }
        const rackTime = time - (scene.userData.rackStart || -999);
        if (rackTime < 0.4) {
            context.gunGroup.position.z += (rackTime < 0.15) ? 0.35 : -0.15; // Snappier
            context.gunGroup.rotation.z += (rackTime < 0.15) ? 0.15 : -0.05;
        }

        // CIGARETTE
        if (animState.triggerHeal < scene.userData.lastHeal) scene.userData.lastHeal = animState.triggerHeal;
        if (animState.triggerHeal > scene.userData.lastHeal) {
            scene.userData.lastHeal = animState.triggerHeal;
            scene.userData.healStart = time;
            audioManager.playSound('cig');
        }
        const healTime = time - (scene.userData.healStart || -999);
        if (healTime >= 0 && healTime < 4.0) {
            items.itemCigs.visible = true;
            if (isPlayerTurn) {
                items.itemCigs.scale.setScalar(2.0);
                if (healTime < 0.8) {
                    const p = healTime / 0.8;
                    const ease = easeOutBack(p);
                    items.itemCigs.position.set(2.0 * (1 - ease) + 0.5, -3 + ease * 4.5, 4);
                    items.itemCigs.rotation.set(0.2, -0.3 + (1 - ease), 0);
                } else if (healTime < 3.0) {
                    items.itemCigs.position.set(0.5, 1.5 + Math.sin(time) * 0.05, 4);
                    items.itemCigs.rotation.set(0.3 + Math.sin(time * 5) * 0.05, -0.2, 0.1);

                    const tip = items.itemCigs.getObjectByName("CIG_TIP") as THREE.Mesh;
                    if (tip) {
                        const intensity = (Math.sin(time * 20) + 1) * 0.5;
                        (tip.material as THREE.MeshBasicMaterial).color.setHSL(0.04, 1.0, 0.3 + intensity * 0.7);
                    }
                    const smokePool = items.itemCigs.getObjectByName("SMOKE_POOL");
                    if (smokePool) {
                        smokePool.children.forEach((p, i) => {
                            const mesh = p as THREE.Mesh;
                            const offset = (time * 2 + i) % 5;
                            if (offset < 2.0) {
                                mesh.visible = true;
                                (mesh.material as THREE.Material).opacity = 1.0 - (offset / 2.0);
                                mesh.position.set(0, offset * 0.5, offset * 0.2);
                                mesh.scale.setScalar(1 + offset);
                            } else {
                                mesh.visible = false;
                            }
                        });
                    }
                    camera.rotation.z = Math.sin(time) * 0.005;
                } else {
                    items.itemCigs.visible = false;
                }
            } else {
                items.itemCigs.scale.setScalar(2.0);
                if (healTime < 0.6) {
                    const p = healTime / 0.6;
                    const ease = easeOutBack(p); // Smooth raise
                    // Start right, move center
                    items.itemCigs.position.set(2.0 * (1 - ease), -2 + ease * 4.6, -4.0); // Target Y ~2.6
                    items.itemCigs.rotation.set(0, 0.2, 0.3 * (1 - ease));
                } else if (healTime < 3.0) {
                    items.itemCigs.position.set(0, 2.6 + Math.sin(healTime * 2) * 0.1, -4.0);
                    items.itemCigs.rotation.set(0, 0.2 + Math.sin(time * 2) * 0.1, 0.3);

                    const tip = items.itemCigs.getObjectByName("CIG_TIP") as THREE.Mesh;
                    if (tip) {
                        const intensity = (Math.sin(time * 15) + 1) * 0.5;
                        (tip.material as THREE.MeshBasicMaterial).color.setHSL(0.05, 1.0, 0.3 + intensity * 0.7);
                    }

                    const smokePool = items.itemCigs.getObjectByName("SMOKE_POOL");
                    if (smokePool) {
                        smokePool.children.forEach((p, i) => {
                            const mesh = p as THREE.Mesh;
                            const offset = (time * 2 + i) % 5;
                            if (offset < 2.0) {
                                mesh.visible = true;
                                (mesh.material as THREE.Material).opacity = 1.0 - (offset / 2.0);
                                mesh.position.set(0, offset * 0.5, -offset * 0.2);
                                mesh.scale.setScalar(1 + offset);
                            } else {
                                mesh.visible = false;
                            }
                        });
                    }
                } else {
                    const p = (healTime - 3.0) / 0.5;
                    items.itemCigs.position.y = 2.6 - p * 6;
                    items.itemCigs.position.x = -p * 2;
                    if (healTime > 3.3) items.itemCigs.visible = false;
                }
            }
        } else {
            items.itemCigs.visible = false;
        }

        // SAW ANIMATION
        if (animState.triggerSparks < scene.userData.lastSaw) scene.userData.lastSaw = animState.triggerSparks;
        if (animState.isSawing || (animState.triggerSparks > scene.userData.lastSaw)) {
            if (animState.triggerSparks > scene.userData.lastSaw) {
                scene.userData.lastSaw = animState.triggerSparks;
                audioManager.playSound('saw');
            }
            items.itemSaw.visible = true;
            items.itemSaw.position.copy(context.gunGroup.position);
            // More aggressive sawing motion
            const sawCycle = Math.sin(time * 45);

            if (isPlayerTurn) {
                // Optimization: reused vector
                _v1.set(0.5 + sawCycle * 0.4, 0.5 + Math.abs(sawCycle) * 0.1, 2.0);
                items.itemSaw.position.add(_v1);
                items.itemSaw.rotation.set(Math.PI / 2, 0, Math.PI / 2 + sawCycle * 0.1);
            } else {
                _v1.set(-0.5 + sawCycle * 0.4, 0.5 + Math.abs(sawCycle) * 0.1, -2.0);
                items.itemSaw.position.add(_v1);
                items.itemSaw.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - sawCycle * 0.1);
            }
        } else {
            items.itemSaw.visible = false;
        }

        // CUFFS ANIMATION
        if (animState.triggerCuff < scene.userData.lastCuff) scene.userData.lastCuff = animState.triggerCuff;
        if (animState.triggerCuff > scene.userData.lastCuff) {
            scene.userData.lastCuff = animState.triggerCuff;
            scene.userData.cuffStart = time;
            audioManager.playSound('handcuffed');
        }
        const cuffTime = time - (scene.userData.cuffStart || -999);

        if (cuffTime < 1.8) {
            items.itemCuffs.visible = true;
            if (isPlayerTurn) {
                _v1.set(4, -4, 8); // Start wide
                _v2.set(0, 2, -6);  // End at opponent
            } else {
                _v1.set(-4, -2, -4.0); // Start wide
                _v2.set(0, 0, 8); // End at player (on table/hands)
            }

            if (cuffTime < 1.0) {
                const p = cuffTime / 1.0;
                const ease = easeOutBack(p);
                items.itemCuffs.position.lerpVectors(_v1, _v2, ease);
                items.itemCuffs.position.y += Math.sin(ease * Math.PI) * 4.0; // High arc
                const scalePulse = 1.0 + Math.sin(ease * Math.PI) * 0.5;
                items.itemCuffs.scale.setScalar((isPlayerTurn ? 1.0 : 1.3) * scalePulse);
                items.itemCuffs.rotation.x = p * Math.PI * 4; // Fast spin
                items.itemCuffs.rotation.z = p * Math.PI * 2;
            } else {
                items.itemCuffs.visible = false;
            }
        } else {
            items.itemCuffs.visible = false;
        }

        // PHONE ANIMATION
        if (animState.triggerPhone < scene.userData.lastPhone) scene.userData.lastPhone = animState.triggerPhone;
        if (animState.triggerPhone > scene.userData.lastPhone) {
            scene.userData.lastPhone = animState.triggerPhone;
            scene.userData.phoneStart = time;
            items.itemPhone.visible = true;
            audioManager.playSound('phone');
        }
        const phoneTime = time - (scene.userData.phoneStart || -999);
        if (phoneTime < 3.5) {
            items.itemPhone.visible = true;
            items.itemPhone.scale.setScalar(1.8);
            const screen = items.itemPhone.getObjectByName('PHONE_SCREEN') as THREE.Mesh;

            if (isPlayerTurn) {
                if (phoneTime < 0.6) {
                    const p = phoneTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemPhone.position.set(0.2, -3 + ease * 4.5, 3.5);
                    items.itemPhone.rotation.set(0.8 - ease * 0.3, 0, -0.2);
                } else if (phoneTime < 3.0) {
                    items.itemPhone.position.set(0.2, 1.5 + Math.sin(time * 2) * 0.03, 3.5);
                    items.itemPhone.rotation.set(0.5, 0.1, -0.15);
                    if (screen) {
                        const glowPhase = (phoneTime - 0.5) / 2.5;
                        const mat = screen.material as THREE.MeshBasicMaterial;
                        if (glowPhase < 0.2) mat.color.setHex(0x003366);
                        else if (glowPhase < 0.8) {
                            mat.color.setHex((time * 10) % 2 > 1 ? 0x00ff00 : 0x004400); // Digital flickering
                        } else mat.color.setHex(0x00aa00);
                    }
                } else {
                    items.itemPhone.visible = false;
                }
            } else {
                items.itemPhone.scale.setScalar(2.5);
                if (phoneTime < 0.6) {
                    const p = phoneTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemPhone.position.set(2 * (1 - ease), -1 + ease * 3.6, -4.0); // Y ~ 2.6
                    items.itemPhone.rotation.set(0.5, 0, 0);
                } else if (phoneTime < 2.5) {
                    const floatY = Math.sin(phoneTime * 2) * 0.1;
                    items.itemPhone.position.set(0, 2.6 + floatY, -4.0);
                    items.itemPhone.rotation.set(0.4, 0, 0);
                    if (screen) {
                        const mat = screen.material as THREE.MeshBasicMaterial;
                        // Flicker
                        mat.color.setHex((time * 15) % 2 > 1 ? 0x00ff44 : 0x002211);
                    }
                } else {
                    const p = (phoneTime - 2.5) / 0.5;
                    items.itemPhone.position.y = 2.6 - p * 6;
                    items.itemPhone.position.x = -p * 3;
                    if (phoneTime > 2.8) items.itemPhone.visible = false;
                }
            }
        } else {
            items.itemPhone.visible = false;
        }

        // INVERTER ANIMATION
        if (animState.triggerInverter < scene.userData.lastInverter) scene.userData.lastInverter = animState.triggerInverter;
        if (animState.triggerInverter > scene.userData.lastInverter) {
            scene.userData.lastInverter = animState.triggerInverter;
            scene.userData.inverterStart = time;
            items.itemInverter.visible = true;
            scene.userData.cameraShake = 0.4;
            audioManager.playSound('inverter');
        }
        const invTime = time - (scene.userData.inverterStart || -999);
        if (invTime < 2.5) {
            items.itemInverter.visible = true;
            if (isPlayerTurn) {
                if (invTime < 0.6) {
                    const p = invTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemInverter.position.set(0, -3 + ease * 4.5, 6);
                    items.itemInverter.rotation.y = invTime * 15; // Fast spin
                } else if (invTime < 2.0) {
                    const pulseY = 1.5 + Math.sin(invTime * 15) * 0.1;
                    items.itemInverter.position.set(0, pulseY, 6);
                    items.itemInverter.rotation.y += 0.5;
                    if (invTime > 0.8 && invTime < 1.5) {
                        scene.userData.cameraShake = 0.25;
                        camera.position.x += (Math.random() - 0.5) * 0.1;
                    }
                } else {
                    items.itemInverter.visible = false;
                }
            } else {
                items.itemInverter.scale.setScalar(2.0);
                if (invTime < 0.6) {
                    const p = invTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemInverter.position.set(3 * (1 - ease), -1 + ease * 3.6, -4.0); // Y ~ 2.6
                    items.itemInverter.rotation.y = invTime * 10;
                } else if (invTime < 1.8) {
                    const spinSpeed = 0.6;
                    items.itemInverter.position.set(0, 2.6 + Math.sin(invTime * 10) * 0.2, -4.0);
                    items.itemInverter.rotation.y += spinSpeed;
                    if (invTime > 0.8 && invTime < 1.5) {
                        scene.userData.cameraShake = 0.2;
                    }
                } else {
                    const p = (invTime - 1.8) / 0.5;
                    items.itemInverter.position.y = 2.6 - p * 6;
                    items.itemInverter.position.x = -p * 3;
                    if (invTime > 2.2) items.itemInverter.visible = false;
                }
            }
        } else {
            items.itemInverter.visible = false;
        }

        // CHOKE ANIMATION
        if (animState.triggerChoke < (scene.userData.lastChoke || 0)) scene.userData.lastChoke = animState.triggerChoke;
        if (animState.triggerChoke > (scene.userData.lastChoke || 0)) {
            scene.userData.lastChoke = animState.triggerChoke;
            scene.userData.chokeStart = time;
            // No item model for Choke currently? Assuming generic notification or maybe gun movement?
            // "Choke" is a mod. Maybe just sound and message.
            audioManager.playSound('choke');
        }

        // ADRENALINE ANIMATION
        if (animState.triggerAdrenaline < scene.userData.lastAdrenaline) scene.userData.lastAdrenaline = animState.triggerAdrenaline;
        if (animState.triggerAdrenaline > scene.userData.lastAdrenaline) {
            scene.userData.lastAdrenaline = animState.triggerAdrenaline;
            scene.userData.adrStart = time;
            items.itemAdrenaline.visible = true;
            audioManager.playSound('adrenaline');
        }
        const adrTime = time - (scene.userData.adrStart || -999);
        if (adrTime < 2.5) {
            items.itemAdrenaline.visible = true;
            if (isPlayerTurn) {
                if (adrTime < 0.5) {
                    const p = adrTime / 0.5;
                    const ease = easeOutBack(p);
                    items.itemAdrenaline.position.set(2.0 - ease * 1.5, -3 + ease * 4.5, 7);
                    items.itemAdrenaline.rotation.set(-0.5 + ease * 0.3, 0, -0.5 + ease * 0.3);
                } else if (adrTime < 1.2) {
                    items.itemAdrenaline.position.set(0.5, 1.5, 7);
                    items.itemAdrenaline.rotation.set(-0.2, 0, -0.2);
                    // Jab effect
                    items.itemAdrenaline.rotation.z = Math.PI / 2 * (1 - Math.exp(-(adrTime - 0.5) * 10));
                } else if (adrTime < 2.0) {
                    items.itemAdrenaline.position.set(0.5, 1.2, 7);
                    camera.position.x += (Math.random() - 0.5) * 0.2;
                    camera.position.y += (Math.random() - 0.5) * 0.15;
                } else {
                    items.itemAdrenaline.visible = false;
                }
            } else {
                items.itemAdrenaline.scale.setScalar(2.0);
                if (adrTime < 0.6) {
                    const p = adrTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemAdrenaline.position.set(2.0 * (1 - ease) + 0.5, -1 + ease * 3.6, -4.0); // Y ~ 2.6
                    items.itemAdrenaline.rotation.set(0.3, 0, 0.3);
                } else if (adrTime < 1.8) {
                    items.itemAdrenaline.position.set(0.5, 2.6 + Math.sin(adrTime * 5) * 0.2, -4.0);
                    items.itemAdrenaline.rotation.z = Math.PI / 2;
                    if (adrTime > 0.8) scene.userData.cameraShake = 0.15;
                } else {
                    const p = (adrTime - 1.8) / 0.5;
                    items.itemAdrenaline.position.y = 2.6 - p * 6;
                    items.itemAdrenaline.position.x = -p * 3;
                    if (adrTime > 2.2) items.itemAdrenaline.visible = false;
                }
            }
        } else {
            items.itemAdrenaline.visible = false;
        }

        // REMOTE ANIMATION
        if (animState.triggerRemote < (scene.userData.lastRemote || 0)) scene.userData.lastRemote = animState.triggerRemote;
        if (animState.triggerRemote > (scene.userData.lastRemote || 0)) {
            scene.userData.lastRemote = animState.triggerRemote;
            scene.userData.remoteStart = time;
            items.itemRemote.visible = true;
            audioManager.playSound('remote');
        }
        const remTime = time - (scene.userData.remoteStart || -999);
        if (remTime < 2.5) {
            items.itemRemote.visible = true;
            if (isPlayerTurn) {
                if (remTime < 0.5) {
                    const p = remTime / 0.5;
                    const ease = easeOutBack(p);
                    items.itemRemote.position.set(0.2 - ease * 0.1, -3 + ease * 4.5, 6); // Rise up
                    items.itemRemote.rotation.set(-0.2 + ease * 0.1, 0, 0);
                } else if (remTime < 1.5) {
                    // Hover and Click effect
                    items.itemRemote.position.set(0.1, 1.5 + Math.sin(time * 2) * 0.05, 6);
                    if (remTime > 0.8 && remTime < 1.0) {
                        // Click visual - button press (simulate by shake or slight depress)
                        items.itemRemote.position.y -= 0.05;
                    }
                } else {
                    items.itemRemote.visible = false;
                }
            } else {
                items.itemRemote.scale.setScalar(2.0);
                if (remTime < 0.6) {
                    const p = remTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemRemote.position.set(2.0 * (1 - ease), -1 + ease * 3.6, -4.0);
                    items.itemRemote.rotation.set(0.1, 0, 0);
                } else if (remTime < 1.8) {
                    items.itemRemote.position.set(0, 2.6 + Math.sin(remTime * 4) * 0.1, -4.0);
                } else {
                    const p = (remTime - 1.8) / 0.5;
                    items.itemRemote.position.y = 2.6 - p * 6;
                    items.itemRemote.position.x = -p * 3;
                    if (remTime > 2.2) items.itemRemote.visible = false;
                }
            }
        } else {
            items.itemRemote.visible = false;
        }

        // BIG INVERTER ANIMATION
        if (animState.triggerBigInverter < (scene.userData.lastBigInverter || 0)) scene.userData.lastBigInverter = animState.triggerBigInverter;
        if (animState.triggerBigInverter > (scene.userData.lastBigInverter || 0)) {
            scene.userData.lastBigInverter = animState.triggerBigInverter;
            scene.userData.bigInverterStart = time;
            items.itemBigInverter.visible = true;
            // Stronger shake
            scene.userData.cameraShake = 1.0;
            audioManager.playSound('big_inverter');
        }
        const bigInvTime = time - (scene.userData.bigInverterStart || -999);
        if (bigInvTime < 3.0) { // S Slightly longer
            items.itemBigInverter.visible = true;
            if (isPlayerTurn) {
                if (bigInvTime < 0.6) {
                    const p = bigInvTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemBigInverter.position.set(0, -3 + ease * 4.5, 6);
                    items.itemBigInverter.rotation.y = bigInvTime * 20; // Faster spin
                } else if (bigInvTime < 2.5) {
                    const pulseY = 1.5 + Math.sin(bigInvTime * 25) * 0.15;
                    items.itemBigInverter.position.set(0, pulseY, 6);
                    items.itemBigInverter.rotation.y += 0.8;

                    if (bigInvTime > 0.8 && bigInvTime < 2.0) {
                        scene.userData.cameraShake = 0.4;
                        camera.position.x += (Math.random() - 0.5) * 0.2;
                        camera.position.y += (Math.random() - 0.5) * 0.2;
                    }
                } else {
                    items.itemBigInverter.visible = false;
                }
            } else {
                items.itemBigInverter.scale.setScalar(2.0);
                if (bigInvTime < 0.6) {
                    const p = bigInvTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemBigInverter.position.set(3 * (1 - ease), -1 + ease * 3.6, -4.0);
                    items.itemBigInverter.rotation.y = bigInvTime * 15;
                } else if (bigInvTime < 2.2) {
                    const spinSpeed = 0.8;
                    items.itemBigInverter.position.set(0, 2.6 + Math.sin(bigInvTime * 15) * 0.25, -4.0);
                    items.itemBigInverter.rotation.y += spinSpeed;
                    if (bigInvTime > 0.8 && bigInvTime < 2.0) {
                        scene.userData.cameraShake = 0.3;
                    }
                } else {
                    const p = (bigInvTime - 2.2) / 0.5;
                    items.itemBigInverter.position.y = 2.6 - p * 6;
                    items.itemBigInverter.position.x = -p * 3;
                    if (bigInvTime > 2.8) items.itemBigInverter.visible = false;
                }
            }
        } else {
            items.itemBigInverter.visible = false;
        }

        // BLOOD CONTRACT ANIMATION
        if (animState.triggerContract < (scene.userData.lastContract || 0)) scene.userData.lastContract = animState.triggerContract;
        if (animState.triggerContract > (scene.userData.lastContract || 0)) {
            scene.userData.lastContract = animState.triggerContract;
            scene.userData.contractStart = time;
            items.itemContract.visible = true;
            audioManager.playSound('contract');
        }
        const conTime = time - (scene.userData.contractStart || -999);
        if (conTime < 3.0) {
            items.itemContract.visible = true;
            if (isPlayerTurn) {
                if (conTime < 0.8) {
                    const p = conTime / 0.8;
                    const ease = easeOutBack(p);
                    items.itemContract.position.set(0.5, -3 + ease * 4.0, 5);
                    items.itemContract.rotation.set(0.1, 0, 0);
                } else if (conTime < 2.2) {
                    items.itemContract.position.set(0.5, 1.0 + Math.sin(time) * 0.05, 5);
                    // Signing effect? Or dissolving?
                    // Let's make it burn / dissolve
                    items.itemContract.rotation.y = Math.sin(time);
                    items.itemContract.scale.setScalar(2.5 - (conTime - 0.8) * 0.5);
                } else {
                    items.itemContract.visible = false;
                }
            } else {
                items.itemContract.scale.setScalar(3.5);
                if (conTime < 0.6) {
                    const p = conTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemContract.position.set(2 * (1 - ease), -1 + ease * 3.6, -4.0);
                } else if (conTime < 2.0) {
                    items.itemContract.position.set(0, 2.6, -4.0);
                    items.itemContract.rotation.y += 0.05;
                } else {
                    const p = (conTime - 2.0) / 0.5;
                    items.itemContract.position.y = 2.6 - p * 6;
                    if (conTime > 2.5) items.itemContract.visible = false;
                }
            }
        } else {
            items.itemContract.visible = false;
        }

        // CHOKE ANIMATION (Attach Sequence)
        if (animState.triggerChoke < (scene.userData.lastChoke || 0)) scene.userData.lastChoke = animState.triggerChoke;
        if (animState.triggerChoke > (scene.userData.lastChoke || 0)) {
            scene.userData.lastChoke = animState.triggerChoke;
            scene.userData.chokeStart = time;
            // audioManager.playSound('choke'); // Handled in game actions? No, moved here.
            audioManager.playSound('choke');
        }

        const chokeTime = time - (scene.userData.chokeStart || -999);
        if (chokeTime < 2.2) {
            const gun = context.gunGroup;
            if (gun && context.chokeMesh) {
                context.chokeMesh.visible = true;

                // Phase 1: Rotate Gun 90deg & Slide Choke In (0.0 - 0.5s)
                if (chokeTime < 0.5) {
                    const p = chokeTime / 0.5;
                    const ease = (1 - Math.pow(1 - p, 3)); // Cubic ease out

                    // Rotate Gun Sideways (Z-axis)
                    gun.rotation.z = ease * (Math.PI / 2);

                    // Slide Choke from front
                    const targetZ = props.isSawed ? 8.4 : 10.9;
                    const startZ = targetZ + 4.0;
                    context.chokeMesh.position.z = startZ - (startZ - targetZ) * ease;
                    context.chokeMesh.scale.setScalar(ease);
                }
                // Phase 2: Screw In (0.5 - 1.6s)
                else if (chokeTime < 1.6) {
                    gun.rotation.z = Math.PI / 2; // Hold horizontal
                    const targetZ = props.isSawed ? 8.4 : 10.9;
                    context.chokeMesh.position.z = targetZ;
                    context.chokeMesh.scale.setScalar(1);

                    // Rotation for screwing effect
                    const screwP = (chokeTime - 0.5);
                    context.chokeMesh.rotation.z = screwP * Math.PI * 6; // Fast spin
                }
                // Phase 3: Return Gun to Upright (1.6 - 2.0s)
                else {
                    const p = (chokeTime - 1.6) / 0.4; // 0.4s return
                    const ease = (1 - Math.pow(1 - p, 2));

                    gun.rotation.z = (1 - ease) * (Math.PI / 2);

                    const targetZ = props.isSawed ? 8.4 : 10.9;
                    context.chokeMesh.position.z = targetZ;
                    context.chokeMesh.rotation.z = 0;
                }
            }
        }
        // Ensure gun rotation resets if animation interrupted or finished
        else if (context.gunGroup && context.gunGroup.rotation.z !== 0) {
            // Smoothly reset if lingering (or snap if time passed)
            // Ideally snap to 0 to prevent drift
            context.gunGroup.rotation.z = 0;
        }
        const now = time;
        const cleanupThreshold = 5.0;

        if (scene.userData.glassStart && (now - scene.userData.glassStart) > cleanupThreshold) {
            items.itemGlass.visible = false;
        }
        if (scene.userData.drinkStart && (now - scene.userData.drinkStart) > cleanupThreshold) {
            items.itemBeer.visible = false;
        }
        if (scene.userData.healStart && (now - scene.userData.healStart) > cleanupThreshold) {
            items.itemCigs.visible = false;
        }
        if (scene.userData.cuffStart && (now - scene.userData.cuffStart) > cleanupThreshold) {
            items.itemCuffs.visible = false;
        }
        if (scene.userData.phoneStart && (now - scene.userData.phoneStart) > cleanupThreshold) {
            items.itemPhone.visible = false;
        }
        if (scene.userData.inverterStart && (now - scene.userData.inverterStart) > cleanupThreshold) {
            items.itemInverter.visible = false;
        }
        if (scene.userData.adrStart && (now - scene.userData.adrStart) > cleanupThreshold) {
            items.itemAdrenaline.visible = false;
        }
        if (scene.userData.remoteStart && (now - scene.userData.remoteStart) > cleanupThreshold) {
            items.itemRemote.visible = false;
        }
        if (scene.userData.bigInverterStart && (now - scene.userData.bigInverterStart) > cleanupThreshold) {
            items.itemBigInverter.visible = false;
        }
        if (!animState.isSawing && scene.userData.lastSaw === animState.triggerSparks) {
            items.itemSaw.visible = false;
        }

        updateItemLight();
    }
}
