import * as THREE from 'three';
import { SceneContext, SceneProps } from '../../types';
import { audioManager } from '../audioManager';
import { createCardTexture } from '../three/items';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _vBullet = new THREE.Vector3();

export function updateParticles(p: THREE.Points, limit: number) {
    const pos = p.geometry.attributes.position.array as Float32Array;
    const vel = p.geometry.attributes.velocity.array as Float32Array;
    for (let i = 0; i < pos.length / 3; i++) {
        const idx = i * 3;
        pos[idx] += vel[idx]; pos[idx + 1] += vel[idx + 1]; pos[idx + 2] += vel[idx + 2];
        if (Math.abs(pos[idx]) > limit) pos[idx] *= -0.9;
        if (Math.abs(pos[idx + 1]) > 15) pos[idx + 1] *= -0.9;
        if (Math.abs(pos[idx + 2]) > 20) pos[idx + 2] *= -0.9;
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

            const phase = props.gameState?.phase;
            const selectedCardIndex = props.gameState?.selectedCardIndex;
            const turnOwner = props.turnOwner;

            // Check if card selection reveal is active
            if (phase === 'CARD_SELECT' && selectedCardIndex !== null && selectedCardIndex !== undefined && context.itemDeckCards) {
                const selectedCard = context.itemDeckCards[selectedCardIndex];
                if (selectedCard && selectedCard.visible) {
                    const isPlayer = turnOwner === 'PLAYER';
                    items.itemLight.position.copy(selectedCard.position);
                    items.itemLight.position.z += isPlayer ? 0.95 : -0.95; // Spotlight directly in front of the card
                    items.itemLight.position.y += 0.1; // Slightly centered
                    items.itemLight.color.setHex(0xe9d5ff); // Magical light purple/gold spotlight
                    items.itemLight.intensity = 35.0; // High intensity for readability
                    items.itemLight.distance = 12;
                    return;
                }
            }

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
            else if (items.itemRemote.visible) activeItem = items.itemRemote;
            else if (items.itemBigInverter.visible) activeItem = items.itemBigInverter;
            else if (items.itemContract.visible) activeItem = items.itemContract;
            else if (items.itemLuckycharm.visible) activeItem = items.itemLuckycharm;
            else if (items.itemFlashbang.visible) activeItem = items.itemFlashbang;
            else if (items.itemCrusher.visible) activeItem = items.itemCrusher;
            else if (items.itemTotem.visible) activeItem = items.itemTotem;
            else if (items.itemMirror.visible) activeItem = items.itemMirror;

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
        if (scene.userData.lastTotem === undefined) scene.userData.lastTotem = animState.triggerTotem || 0;
        if (scene.userData.lastMirror === undefined) scene.userData.lastMirror = animState.triggerMirror || 0;
        if (scene.userData.lastRack === undefined) scene.userData.lastRack = animState.triggerRack;
        if (scene.userData.lastGlass === undefined) scene.userData.lastGlass = animState.triggerGlass;
        if (scene.userData.lastPhone === undefined) scene.userData.lastPhone = animState.triggerPhone;
        if (scene.userData.lastInverter === undefined) scene.userData.lastInverter = animState.triggerInverter;
        if (scene.userData.lastAdrenaline === undefined) scene.userData.lastAdrenaline = animState.triggerAdrenaline;
        if (scene.userData.lastLuckycharm === undefined) scene.userData.lastLuckycharm = animState.triggerLuckycharm;
        if (scene.userData.lastDeckCard === undefined) scene.userData.lastDeckCard = animState.triggerDeckCard || 0;

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

        // LUCKYCHARM ANIMATION
        if (animState.triggerLuckycharm < (scene.userData.lastLuckycharm || 0)) scene.userData.lastLuckycharm = animState.triggerLuckycharm;
        if (animState.triggerLuckycharm > (scene.userData.lastLuckycharm || 0)) {
            scene.userData.lastLuckycharm = animState.triggerLuckycharm;
            scene.userData.luckycharmStart = time;
            items.itemLuckycharm.visible = true;
            audioManager.playSound('luckycharm');
        }
        const lcTime = time - (scene.userData.luckycharmStart || -999);
        if (lcTime < 2.5) {
            items.itemLuckycharm.visible = true;
            items.itemLuckycharm.scale.setScalar(2.0);
            if (isPlayerTurn) {
                if (lcTime < 0.6) {
                    const p = lcTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemLuckycharm.position.set(0, -3 + ease * 4.5, 6);
                    items.itemLuckycharm.rotation.y = lcTime * 15; // Spin up
                } else if (lcTime < 2.0) {
                    const pulseY = 1.5 + Math.sin(lcTime * 10) * 0.1;
                    items.itemLuckycharm.position.set(0, pulseY, 6);
                    items.itemLuckycharm.rotation.y += 0.05;
                } else {
                    items.itemLuckycharm.visible = false;
                }
            } else {
                if (lcTime < 0.6) {
                    const p = lcTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemLuckycharm.position.set(3 * (1 - ease), -1 + ease * 3.6, -4.0);
                    items.itemLuckycharm.rotation.y = lcTime * 10;
                } else if (lcTime < 1.8) {
                    items.itemLuckycharm.position.set(0, 2.6 + Math.sin(lcTime * 5) * 0.15, -4.0);
                    items.itemLuckycharm.rotation.y += 0.05;
                } else {
                    const p = (lcTime - 1.8) / 0.5;
                    items.itemLuckycharm.position.y = 2.6 - p * 6;
                    items.itemLuckycharm.position.x = -p * 3;
                    if (lcTime > 2.2) items.itemLuckycharm.visible = false;
                }
            }
        } else {
            items.itemLuckycharm.visible = false;
        }

        // FLASHBANG ANIMATION
        if (animState.triggerFlashbang < (scene.userData.lastFlashbang || 0)) scene.userData.lastFlashbang = animState.triggerFlashbang;
        if (animState.triggerFlashbang > (scene.userData.lastFlashbang || 0)) {
            scene.userData.lastFlashbang = animState.triggerFlashbang;
            scene.userData.flashbangStart = time;
            scene.userData.flashbangDetonated = false;
            items.itemFlashbang.visible = true;
            items.itemFlashbang.rotation.set(0, 0, 0);
        }
        const fbTime = time - (scene.userData.flashbangStart || -999);
        if (fbTime < 2.5) {
            items.itemFlashbang.visible = fbTime < 1.5; // Explodes and disappears at 1.5s
            items.itemFlashbang.scale.setScalar(2.0);

            // Detonate screen shake and play sound at 1.5s
            if (fbTime >= 1.5 && !scene.userData.flashbangDetonated) {
                scene.userData.flashbangDetonated = true;
                scene.userData.cameraShake = 1.8;
                audioManager.playSound('flashbang');
            }

            if (isPlayerTurn) {
                if (fbTime < 0.6) {
                    const p = fbTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemFlashbang.position.set(0, -3 + ease * 4.5, 6.0);
                    items.itemFlashbang.rotation.y = fbTime * 15;
                    items.itemFlashbang.rotation.x = 0;
                    items.itemFlashbang.rotation.z = 0;
                } else if (fbTime < 1.5) {
                    // Cook/shake in front of camera
                    const shakeX = Math.sin(fbTime * 50) * 0.03;
                    const shakeY = Math.cos(fbTime * 45) * 0.03;
                    items.itemFlashbang.position.set(shakeX, 1.5 + shakeY, 6.0);
                    items.itemFlashbang.rotation.y += 0.1;
                    items.itemFlashbang.rotation.x = 0;
                    items.itemFlashbang.rotation.z = 0;
                }
            } else {
                // Dealer turn
                if (fbTime < 0.6) {
                    const p = fbTime / 0.6;
                    const ease = easeOutBack(p);
                    items.itemFlashbang.position.set(3 * (1 - ease), -1 + ease * 3.6, -4.0);
                    items.itemFlashbang.rotation.y = fbTime * 10;
                    items.itemFlashbang.rotation.x = 0;
                    items.itemFlashbang.rotation.z = 0;
                } else if (fbTime < 1.5) {
                    const shakeX = Math.sin(fbTime * 50) * 0.03;
                    items.itemFlashbang.position.set(shakeX, 2.6, -4.0);
                    items.itemFlashbang.rotation.y += 0.1;
                    items.itemFlashbang.rotation.x = 0;
                    items.itemFlashbang.rotation.z = 0;
                }
            }
        } else {
            items.itemFlashbang.visible = false;
        }

        // CRUSHER ANIMATION
        if (animState.triggerCrusher < (scene.userData.lastCrusher || 0)) scene.userData.lastCrusher = animState.triggerCrusher;
        if (animState.triggerCrusher > (scene.userData.lastCrusher || 0)) {
            scene.userData.lastCrusher = animState.triggerCrusher;
            scene.userData.crusherStart = time;
            scene.userData.crusherSlammed = false;
            items.itemCrusher.visible = true;
            items.itemCrusher.rotation.set(0, 0, 0);
        }
        const crusherTime = time - (scene.userData.crusherStart || -999);
        if (crusherTime < 2.2) {
            items.itemCrusher.visible = true;

            // Handle positions and movements
            if (isPlayerTurn) {
                // Player crushes Dealer's item. Hammer slams down on Dealer's side.
                if (crusherTime < 0.8) {
                    // Wind up: rise up and tilt back
                    const p = crusherTime / 0.8;
                    const ease = easeOutBack(p);
                    items.itemCrusher.position.set(0, -3 + ease * 7.5, -3.0 - p * 3.0); // Rise and pull back
                    items.itemCrusher.rotation.x = -p * 1.5; // Tilt back
                    items.itemCrusher.rotation.y = 0;
                    items.itemCrusher.rotation.z = 0;
                } else if (crusherTime < 1.1) {
                    // Hover and shake before slamming
                    const shakeX = Math.sin(crusherTime * 60) * 0.05;
                    const shakeY = Math.cos(crusherTime * 50) * 0.05;
                    items.itemCrusher.position.set(shakeX, 4.5 + shakeY, -6.0);
                    items.itemCrusher.rotation.x = -1.5;
                } else if (crusherTime < 1.35) {
                    // Fast slam down!
                    const p = (crusherTime - 1.1) / 0.25;
                    const curY = 4.5 - p * 4.4;
                    const curZ = -6.0 - p * 1.5;
                    items.itemCrusher.position.set(0, curY, curZ);
                    items.itemCrusher.rotation.x = -1.5 + p * 2.0; // Rotate forward to hit flat

                    // Detonate slam at impact point (t = 1.3s or p = 0.8)
                    if (crusherTime >= 1.3 && !scene.userData.crusherSlammed) {
                        scene.userData.crusherSlammed = true;
                        scene.userData.cameraShake = 2.2;
                        audioManager.playSound('crusher');
                    }
                } else {
                    // Stay down on the table, then fade out (slowly sink)
                    const p = (crusherTime - 1.35) / 0.85;
                    items.itemCrusher.position.set(0, 0.1 - p * 4.0, -7.5);
                    items.itemCrusher.rotation.x = 0.5;
                }
            } else {
                // Dealer crushes Player's item. Hammer slams down on Player's side.
                if (crusherTime < 0.8) {
                    // Wind up: rise up and tilt back
                    const p = crusherTime / 0.8;
                    const ease = easeOutBack(p);
                    items.itemCrusher.position.set(0, -3 + ease * 6.5, 2.0 + p * 2.5); // Rise and pull back towards player camera
                    items.itemCrusher.rotation.x = p * 1.5; // Tilt back
                    items.itemCrusher.rotation.y = Math.PI; // Face the camera
                    items.itemCrusher.rotation.z = 0;
                } else if (crusherTime < 1.1) {
                    // Hover and shake
                    const shakeX = Math.sin(crusherTime * 60) * 0.05;
                    const shakeY = Math.cos(crusherTime * 50) * 0.05;
                    items.itemCrusher.position.set(shakeX, 3.5 + shakeY, 4.5);
                    items.itemCrusher.rotation.x = 1.5;
                    items.itemCrusher.rotation.y = Math.PI;
                } else if (crusherTime < 1.35) {
                    // Fast slam down!
                    const p = (crusherTime - 1.1) / 0.25;
                    const curY = 3.5 - p * 4.8;
                    const curZ = 4.5 + p * 1.2;
                    items.itemCrusher.position.set(0, curY, curZ);
                    items.itemCrusher.rotation.x = 1.5 - p * 2.0;
                    items.itemCrusher.rotation.y = Math.PI;

                    if (crusherTime >= 1.3 && !scene.userData.crusherSlammed) {
                        scene.userData.crusherSlammed = true;
                        scene.userData.cameraShake = 2.2;
                        audioManager.playSound('crusher');
                    }
                } else {
                    const p = (crusherTime - 1.35) / 0.85;
                    items.itemCrusher.position.set(0, -1.3 - p * 4.0, 5.7);
                    items.itemCrusher.rotation.x = -0.5;
                    items.itemCrusher.rotation.y = Math.PI;
                }
            }
        } else {
            items.itemCrusher.visible = false;
        }

        // TOTEM ANIMATION
        const totemTriggerVal = animState.triggerTotem || 0;
        if (totemTriggerVal < (scene.userData.lastTotem || 0)) scene.userData.lastTotem = totemTriggerVal;
        if (totemTriggerVal > (scene.userData.lastTotem || 0)) {
            scene.userData.lastTotem = totemTriggerVal;
            scene.userData.totemStart = time;
            items.itemTotem.visible = true;
            items.itemTotem.rotation.set(0, 0, 0);
            items.itemTotem.scale.setScalar(0.01);
        }
        const totemTime = time - (scene.userData.totemStart || -999);
        if (totemTime < 2.8) {
            items.itemTotem.visible = true;
            items.itemTotem.rotation.y = time * 6.5;

            const isPlayerTarget = animState.totemTarget === 'PLAYER';

            if (isPlayerTarget) {
                if (totemTime < 0.6) {
                    const p = totemTime / 0.6;
                    const scale = p * 3.2;
                    items.itemTotem.position.set(0, -1.2 + p * 3.2, 5.2);
                    items.itemTotem.scale.setScalar(scale);
                } else if (totemTime < 1.8) {
                    const hover = Math.sin(time * 10) * 0.12;
                    const shakeX = (Math.random() - 0.5) * 0.04;
                    const shakeY = (Math.random() - 0.5) * 0.04;
                    items.itemTotem.position.set(shakeX, 2.0 + hover + shakeY, 5.2);
                    items.itemTotem.scale.setScalar(3.2 + Math.sin(time * 18) * 0.15);
                } else {
                    const p = (totemTime - 1.8) / 1.0;
                    items.itemTotem.position.set(0, 2.0 - p * 3.0, 5.2);
                    items.itemTotem.scale.setScalar(Math.max(0.001, 3.2 * (1 - p)));
                }
            } else {
                if (totemTime < 0.6) {
                    const p = totemTime / 0.6;
                    const scale = p * 3.2;
                    items.itemTotem.position.set(0, -1.2 + p * 3.2, -2.2);
                    items.itemTotem.scale.setScalar(scale);
                } else if (totemTime < 1.8) {
                    const hover = Math.sin(time * 10) * 0.12;
                    const shakeX = (Math.random() - 0.5) * 0.04;
                    const shakeY = (Math.random() - 0.5) * 0.04;
                    items.itemTotem.position.set(shakeX, 2.0 + hover + shakeY, -2.2);
                    items.itemTotem.scale.setScalar(3.2 + Math.sin(time * 18) * 0.15);
                } else {
                    const p = (totemTime - 1.8) / 1.0;
                    items.itemTotem.position.set(0, 2.0 - p * 3.0, -2.2);
                    items.itemTotem.scale.setScalar(Math.max(0.001, 3.2 * (1 - p)));
                }
            }
        } else {
            items.itemTotem.visible = false;
        }

        // MIRROR ANIMATION
        const mirrorTriggerVal = animState.triggerMirror || 0;
        if (mirrorTriggerVal < (scene.userData.lastMirror || 0)) scene.userData.lastMirror = mirrorTriggerVal;
        if (mirrorTriggerVal > (scene.userData.lastMirror || 0)) {
            scene.userData.lastMirror = mirrorTriggerVal;
            scene.userData.mirrorStart = time;
            items.itemMirror.visible = true;
            items.itemMirror.rotation.set(0, 0, 0);
            items.itemMirror.scale.setScalar(0.01);
        }
        const mirrorTime = time - (scene.userData.mirrorStart || -999);
        if (mirrorTime < 2.5) {
            items.itemMirror.visible = true;
            items.itemMirror.rotation.y = time * 8.0;
            items.itemMirror.rotation.x = Math.sin(time * 4.0) * 0.3;
            
            const isPlayerTarget = isPlayerTurn;
            const targetZ = isPlayerTarget ? 5.2 : -2.2;
            
            if (mirrorTime < 0.6) {
                const p = mirrorTime / 0.6;
                const scale = p * 3.2;
                items.itemMirror.position.set(0, -1.2 + p * 3.2, targetZ);
                items.itemMirror.scale.setScalar(scale);
            } else if (mirrorTime < 1.7) {
                const hover = Math.sin(time * 10) * 0.12;
                const shakeX = (Math.random() - 0.5) * 0.04;
                const shakeY = (Math.random() - 0.5) * 0.04;
                items.itemMirror.position.set(shakeX, 2.0 + hover + shakeY, targetZ);
                items.itemMirror.scale.setScalar(3.2 + Math.sin(time * 18) * 0.15);
            } else {
                const p = (mirrorTime - 1.7) / 0.8;
                items.itemMirror.position.set(0, 2.0 - p * 3.0, targetZ);
                items.itemMirror.scale.setScalar(Math.max(0.001, 3.2 * (1 - p)));
            }
        } else {
            items.itemMirror.visible = false;
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
        if (scene.userData.luckycharmStart && (now - scene.userData.luckycharmStart) > cleanupThreshold) {
            items.itemLuckycharm.visible = false;
        }
        if (scene.userData.flashbangStart && (now - scene.userData.flashbangStart) > cleanupThreshold) {
            items.itemFlashbang.visible = false;
        }
        if (scene.userData.crusherStart && (now - scene.userData.crusherStart) > cleanupThreshold) {
            items.itemCrusher.visible = false;
        }
        if (scene.userData.mirrorStart && (now - scene.userData.mirrorStart) > cleanupThreshold) {
            items.itemMirror.visible = false;
        }
        // TAROT DECK CARD ANIMATION
        if (context.itemDeckCards) {
            const phase = props.gameState.phase;
            const deckCards = props.gameState.deckCards;
            const selectedCardIndex = props.gameState.selectedCardIndex;
            const turnOwner = props.gameState.turnOwner;

            // Phase change detection for CARD_SELECT
            if (scene.userData.lastPhaseAnimation !== phase) {
                if (phase === 'CARD_SELECT') {
                    scene.userData.cardSelectStart = time;
                    scene.userData.cardSelectChosenStart = null;
                    scene.userData.cardSwapped = {};
                    
                    // Reset visibility and scale
                    context.itemDeckCards.forEach((cardGroup, idx) => {
                        cardGroup.visible = true;
                        cardGroup.scale.set(0.001, 0.001, 0.001);
                        
                        // Initial position flat on table in a 2x3 grid
                        const isPlayer = turnOwner === 'PLAYER';
                        const r = Math.floor(idx / 3);
                        const c = idx % 3;
                        const startX = (c - 1) * 1.35;
                        const startZ = (isPlayer ? 2.2 : -2.2) + (r - 0.5) * 1.8 * (isPlayer ? 1 : -1);
                        cardGroup.position.set(startX, -0.95, startZ);
                        
                        // Face down: flat on table (rot X = Math.PI / 2 showing the gold-maroon back)
                        cardGroup.rotation.set(Math.PI / 2, 0, 0);

                        // Reset materials back to back texture
                        const mesh = cardGroup.getObjectByName('CARD_MESH') as THREE.Mesh;
                        if (mesh && Array.isArray(mesh.material) && deckCards && deckCards[idx]) {
                            const name = deckCards[idx].name;
                            const frontTex = createCardTexture(name, false);
                            const backTex = createCardTexture(name, true);
                            
                            mesh.material[4] = new THREE.MeshStandardMaterial({
                                map: frontTex,
                                roughness: 0.8,
                                metalness: 0.0,
                                emissive: new THREE.Color(0xffffff),
                                emissiveIntensity: 0.2,
                                side: THREE.DoubleSide
                            });
                            mesh.material[5] = new THREE.MeshStandardMaterial({
                                map: backTex,
                                roughness: 0.95,
                                metalness: 0.0,
                                emissive: new THREE.Color(0x000000),
                                emissiveIntensity: 0.0,
                                side: THREE.DoubleSide
                            });
                        }
                    });
                } else {
                    // Hide cards if we exit CARD_SELECT phase
                    context.itemDeckCards.forEach(cardGroup => {
                        cardGroup.visible = false;
                    });
                }
                scene.userData.lastPhaseAnimation = phase;
            }

            if (phase === 'CARD_SELECT' && deckCards) {
                const cardSelectTime = time - (scene.userData.cardSelectStart || time);

                if (selectedCardIndex !== null && selectedCardIndex !== undefined) {
                    if (scene.userData.cardSelectChosenStart === null || scene.userData.cardSelectChosenStart === undefined) {
                        scene.userData.cardSelectChosenStart = time;
                    }
                }

                const chosenTime = scene.userData.cardSelectChosenStart !== null && scene.userData.cardSelectChosenStart !== undefined
                    ? time - scene.userData.cardSelectChosenStart
                    : -1;

                context.itemDeckCards.forEach((cardGroup, idx) => {
                    if (idx >= deckCards.length) {
                        cardGroup.visible = false;
                        return;
                    }
                    cardGroup.visible = true;

                    const isPlayer = turnOwner === 'PLAYER';
                    const r = Math.floor(idx / 3);
                    const c = idx % 3;
                    const startX = (c - 1) * 1.35;
                    const startZ = (isPlayer ? 2.2 : -2.2) + (r - 0.5) * 1.8 * (isPlayer ? 1 : -1);

                    const mesh = cardGroup.getObjectByName('CARD_MESH') as THREE.Mesh;
                    const backMat = mesh && Array.isArray(mesh.material) ? (mesh.material[5] as THREE.MeshStandardMaterial) : null;
                    const frontMat = mesh && Array.isArray(mesh.material) ? (mesh.material[4] as THREE.MeshStandardMaterial) : null;

                    const isHovered = scene.userData.hoveredCardIndex === idx;

                    if (selectedCardIndex === null || selectedCardIndex === undefined) {
                        // Rise / Hover state
                        let targetScale = 1.25;
                        let targetEmissive = 0.0;

                        if (isHovered) {
                            targetScale = 1.42;
                            targetEmissive = 0.8;
                            if (backMat) {
                                backMat.emissive.setHex(0xa855f7); // Purple glow
                            }
                        }

                        if (cardGroup.userData.currentScale === undefined) cardGroup.userData.currentScale = 1.25;
                        if (cardGroup.userData.currentEmissive === undefined) cardGroup.userData.currentEmissive = 0.0;

                        cardGroup.userData.currentScale = THREE.MathUtils.lerp(cardGroup.userData.currentScale, targetScale, 0.15);
                        cardGroup.userData.currentEmissive = THREE.MathUtils.lerp(cardGroup.userData.currentEmissive, targetEmissive, 0.15);

                        if (backMat) {
                            backMat.emissiveIntensity = cardGroup.userData.currentEmissive;
                        }

                        if (cardSelectTime < 0.8) {
                            const p = cardSelectTime / 0.8;
                            const scale = p * cardGroup.userData.currentScale;
                            cardGroup.scale.setScalar(scale);
                            cardGroup.position.y = -0.95 + p * 1.15;
                        } else {
                            cardGroup.scale.setScalar(cardGroup.userData.currentScale);
                            const hover = Math.sin(time * 3 + idx * 1.5) * 0.04;
                            cardGroup.position.y = 0.2 + hover;
                        }
                        cardGroup.position.x = startX;
                        cardGroup.position.z = startZ;
                        cardGroup.rotation.set(Math.PI / 2, 0, 0);
                    } else {
                        // Card has been selected
                        if (idx === selectedCardIndex) {
                            const targetZ = isPlayer ? 2.5 : -2.5;
                            const targetPos = new THREE.Vector3(0, 1.8, targetZ);
                            const startPos = new THREE.Vector3(startX, 0.2, startZ);

                            // Make sure revealed card is lit up from within
                            if (frontMat) {
                                frontMat.emissive.setHex(0x111111);
                                frontMat.emissiveIntensity = 0.1;
                            }

                            if (chosenTime < 1.8) {
                                const p = chosenTime / 1.8;
                                cardGroup.position.lerpVectors(startPos, targetPos, p);
                                
                                cardGroup.rotation.x = Math.PI / 2 - p * (Math.PI / 2);
                                cardGroup.rotation.y = p * Math.PI + (isPlayer ? 0 : Math.PI);
                                cardGroup.rotation.z = 0;
                                
                                if (p > 0.4 && !scene.userData.cardSwapped[idx]) {
                                    if (mesh && Array.isArray(mesh.material)) {
                                        mesh.material[5] = mesh.material[4];
                                        scene.userData.cardSwapped[idx] = true;
                                    }
                                }
                            } else {
                                cardGroup.position.copy(targetPos);
                                cardGroup.position.y += Math.sin(time * 2.0) * 0.05;
                                cardGroup.rotation.x = 0;
                                cardGroup.rotation.y = isPlayer ? Math.PI : 0;
                                cardGroup.rotation.z = 0;

                                if (mesh && Array.isArray(mesh.material) && !scene.userData.cardSwapped[idx]) {
                                    mesh.material[5] = mesh.material[4];
                                    scene.userData.cardSwapped[idx] = true;
                                }
                            }
                        } else {
                            if (chosenTime < 0.6) {
                                const p = chosenTime / 0.6;
                                cardGroup.scale.setScalar(1.25 * (1 - p));
                                cardGroup.position.y = 0.2 - p * 1.15;
                            } else {
                                cardGroup.scale.setScalar(0.001);
                                cardGroup.visible = false;
                            }
                        }
                    }
                });
            }
        }

        updateItemLight();
    }
}
