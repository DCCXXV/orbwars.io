import { Graphics, Container, Text } from "pixi.js";

export class Renderer {
    constructor(app, world) {
        this.app = app;
        this.world = world;

        this.playerGraphics = new Map();
        this.pelletGraphics = new Map();
        this.localPlayerGraphic = null;
        this.localPlayerAuraGraphic = null;

        this.myPlayerID = null;
    }

    setMyPlayerID(id) {
        this.myPlayerID = id;

        if (this.playerGraphics.has(id)) {
            const graphic = this.playerGraphics.get(id);
            graphic.container.destroy();
            this.playerGraphics.delete(id);
        }
    }

    render(gameState) {
        this.renderPlayers(gameState.players);
        this.renderPellets(gameState.pellets);
    }

    renderPlayers(players) {
        const currentIDs = new Set(players.map((p) => p.id));

        for (const [id, graphic] of this.playerGraphics) {
            if (!currentIDs.has(id)) {
                graphic.container.destroy();
                this.playerGraphics.delete(id);
            }
        }

        for (const player of players) {
            if (player.id === this.myPlayerID) {
                continue;
            }

            let graphic = this.playerGraphics.get(player.id);

            if (!graphic) {
                const container = new Container();
                const circle = new Graphics();
                const healthBarBg = new Graphics();
                const healthBarFill = new Graphics();
                const healthBarTiers = new Graphics();
                s;
                const auraGraphics = new Graphics();

                container.addChild(auraGraphics);
                container.addChild(circle);
                container.addChild(healthBarBg);
                container.addChild(healthBarFill);
                container.addChild(healthBarTiers);
                this.world.addChild(container);

                graphic = {
                    container,
                    circle,
                    healthBarBg,
                    healthBarFill,
                    healthBarTiers,
                    auraGraphics,
                    lastSize: 0,
                    lastHealth: 0,
                    lastMaxHealth: 0,
                    lastCards: "",
                    lastRedraw: 0,
                };
                this.playerGraphics.set(player.id, graphic);
            }

            graphic.container.position.set(player.x, player.y);

            graphic.auraGraphics.clear();
            this.renderPlayerAuras(player, graphic.auraGraphics);
            this.renderBarrier(player, graphic.auraGraphics);
            this.renderActiveEffects(player, graphic.auraGraphics);

            const cardsKey = JSON.stringify(player.applied_cards || []);
            const time = Date.now();
            const layers = this.getCardEffectLayers(player.applied_cards || []);
            const hasAnimatedBorders = layers.borders.some(
                (b) => b.style === "wavy" || b.style === "chaotic",
            );

            const needsRedraw =
                graphic.lastSize !== player.size ||
                graphic.lastCards !== cardsKey ||
                (hasAnimatedBorders && time - graphic.lastRedraw > 300);

            if (needsRedraw) {
                graphic.circle.clear();

                if (layers.fills.length > 0) {
                    for (let i = layers.auras.length - 1; i >= 0; i--) {
                        const aura = layers.auras[i];
                        graphic.circle.circle(0, 0, player.size + aura.radius);
                        graphic.circle.fill({
                            color: aura.color,
                            alpha: aura.alpha,
                        });
                    }

                    for (const fill of layers.fills) {
                        graphic.circle.circle(0, 0, player.size);
                        graphic.circle.fill({
                            color: fill.tint,
                            alpha: fill.alpha,
                        });
                    }

                    let borderOffset = 0;
                    for (const border of layers.borders) {
                        this.drawStyledBorder(
                            graphic.circle,
                            0,
                            0,
                            player.size,
                            border,
                            time,
                            borderOffset,
                        );
                        borderOffset += border.width + 1;
                    }

                    graphic.circle.circle(0, 0, player.size * 0.35);
                    graphic.circle.fill({ color: 0xffffff, alpha: 0.12 });
                } else {
                    graphic.circle.circle(0, 0, player.size);
                    graphic.circle.stroke({ width: 2, color: 0x777777 });
                }

                graphic.lastSize = player.size;
                graphic.lastCards = cardsKey;
                graphic.lastRedraw = time;
            }

            if (
                graphic.lastHealth !== player.health ||
                graphic.lastMaxHealth !== player.max_health
            ) {
                const barWidth = player.size * 1.5;
                const barHeight = 6;
                const yOffset = -player.size - 15;

                graphic.healthBarBg.position.set(-barWidth / 2, yOffset);
                graphic.healthBarFill.position.set(-barWidth / 2, yOffset);
                graphic.healthBarTiers.position.set(-barWidth / 2, yOffset);

                graphic.healthBarBg.clear();
                graphic.healthBarBg.rect(0, 0, barWidth, barHeight);
                graphic.healthBarBg.fill({ color: 0xcc7777, alpha: 1 });

                const healthPercent = player.health / player.max_health;
                const fillWidth = barWidth * healthPercent;

                graphic.healthBarFill.clear();
                graphic.healthBarFill.rect(0, 0, fillWidth, barHeight);
                graphic.healthBarFill.fill({ color: 0x77cc77 });

                graphic.healthBarTiers.clear();
                const hpPerTier = 100;
                const numTiers = Math.floor(player.max_health / hpPerTier);

                for (let i = 1; i <= numTiers; i++) {
                    const tierHP = i * hpPerTier;
                    const tierPercent = tierHP / player.max_health;
                    const tierX = barWidth * tierPercent;

                    graphic.healthBarTiers.moveTo(tierX, 0);
                    graphic.healthBarTiers.lineTo(tierX, barHeight);
                    graphic.healthBarTiers.stroke({
                        width: 2,
                        color: 0x333333,
                        alpha: 0.6,
                    });
                }

                graphic.lastHealth = player.health;
                graphic.lastMaxHealth = player.max_health;
            }
        }
    }

    renderPellets(pellets) {
        const currentIDs = new Set(pellets.map((p) => p.id));

        for (const [id, graphic] of this.pelletGraphics) {
            if (!currentIDs.has(id)) {
                graphic.destroy();
                this.pelletGraphics.delete(id);
            }
        }

        for (const pellet of pellets) {
            let graphic = this.pelletGraphics.get(pellet.id);

            if (!graphic) {
                graphic = new Graphics();
                graphic.circle(0, 0, pellet.size);
                graphic.fill({ color: 0x7777cc, alpha: 0.5 });
                this.world.addChild(graphic);
                this.pelletGraphics.set(pellet.id, graphic);
            }

            graphic.position.set(pellet.x, pellet.y);
        }
    }

    getCardEffectLayers(appliedCards) {
        const effectDefinitions = {
            poison: {
                tint: 0x77ff77,
                alpha: 0.45,
                border: { color: 0x44dd44, width: 2, style: "dashed" },
                aura: { color: 0x77ff77, radius: 6, alpha: 0.15 },
                priority: 1,
            },
            executioner: {
                tint: 0xff4444,
                alpha: 0.5,
                border: { color: 0xdd0000, width: 3, style: "solid" },
                aura: { color: 0xff0000, radius: 8, alpha: 0.2 },
                priority: 2,
            },
            frost: {
                tint: 0x77ccff,
                alpha: 0.35,
                border: { color: 0x3399ff, width: 2, style: "dashed" },
                aura: { color: 0xaaddff, radius: 10, alpha: 0.12 },
                priority: 1,
            },
            inferno: {
                tint: 0xff9944,
                alpha: 0.55,
                border: { color: 0xff6600, width: 3, style: "wavy" },
                aura: { color: 0xff6600, radius: 7, alpha: 0.18 },
                priority: 3,
            },
            shadow: {
                tint: 0x333333,
                alpha: 0.4,
                border: { color: 0x000000, width: 3, style: "solid" },
                aura: { color: 0x000000, radius: 9, alpha: 0.25 },
                priority: 2,
            },
            divine: {
                tint: 0xffffaa,
                alpha: 0.5,
                border: { color: 0xffdd00, width: 3, style: "double" },
                aura: { color: 0xffff00, radius: 12, alpha: 0.2 },
                priority: 3,
            },
            chaos: {
                tint: 0xff77ff,
                alpha: 0.45,
                border: { color: 0xdd00dd, width: 2, style: "chaotic" },
                aura: { color: 0xff00ff, radius: 8, alpha: 0.16 },
                priority: 2,
            },
            fool: {
                tint: 0xffcc44,
                alpha: 0.4,
                border: { color: 0xffaa00, width: 3, style: "chaotic" },
                aura: { color: 0xffdd77, radius: 8, alpha: 0.15 },
                priority: 4,
            },
            magician: {
                tint: 0x8844ff,
                alpha: 0.5,
                border: { color: 0x6622dd, width: 3, style: "mystic" },
                aura: { color: 0xaa77ff, radius: 10, alpha: 0.18 },
                priority: 4,
            },
            priestess: {
                tint: 0xaaddff,
                alpha: 0.45,
                border: { color: 0x77bbff, width: 4, style: "divine" },
                aura: { color: 0xcceeff, radius: 12, alpha: 0.2 },
                priority: 5,
            },
            emperor: {
                tint: 0xdd8844,
                alpha: 0.55,
                border: { color: 0xbb5522, width: 4, style: "royal" },
                aura: { color: 0xffaa66, radius: 14, alpha: 0.22 },
                priority: 5,
            },
            chariot: {
                tint: 0xff6666,
                alpha: 0.5,
                border: { color: 0xdd3333, width: 3, style: "speed" },
                aura: { color: 0xff8888, radius: 10, alpha: 0.18 },
                priority: 4,
            },
            hermit: {
                tint: 0x886644,
                alpha: 0.45,
                border: { color: 0x664422, width: 3, style: "mystic" },
                aura: { color: 0xaa8866, radius: 11, alpha: 0.2 },
                priority: 4,
            },
            wheel: {
                tint: 0xffaa44,
                alpha: 0.5,
                border: { color: 0xff8822, width: 4, style: "spinning" },
                aura: { color: 0xffcc66, radius: 12, alpha: 0.2 },
                priority: 5,
            },
            death: {
                tint: 0x222222,
                alpha: 0.6,
                border: { color: 0x000000, width: 4, style: "skull" },
                aura: { color: 0x444444, radius: 13, alpha: 0.25 },
                priority: 5,
            },
            devil: {
                tint: 0xaa2222,
                alpha: 0.6,
                border: { color: 0x880000, width: 4, style: "demonic" },
                aura: { color: 0xcc4444, radius: 15, alpha: 0.25 },
                priority: 6,
            },
            tower: {
                tint: 0x666666,
                alpha: 0.55,
                border: { color: 0x444444, width: 5, style: "crumbling" },
                aura: { color: 0x888888, radius: 16, alpha: 0.23 },
                priority: 5,
            },
            star: {
                tint: 0xeeffff,
                alpha: 0.45,
                border: { color: 0xccffff, width: 4, style: "starlight" },
                aura: { color: 0xffffff, radius: 14, alpha: 0.2 },
                priority: 5,
            },
            world: {
                tint: 0x8888ff,
                alpha: 0.55,
                border: { color: 0x6666dd, width: 5, style: "cosmic" },
                aura: { color: 0xaaaaff, radius: 18, alpha: 0.25 },
                priority: 6,
            },
            aries: {
                tint: 0xff5544,
                alpha: 0.5,
                border: { color: 0xdd3322, width: 3, style: "ram" },
                aura: { color: 0xff7766, radius: 9, alpha: 0.17 },
                priority: 3,
            },
            taurus: {
                tint: 0x88aa66,
                alpha: 0.5,
                border: { color: 0x668844, width: 3, style: "solid" },
                aura: { color: 0xaaccaa, radius: 10, alpha: 0.18 },
                priority: 3,
            },
            gemini: {
                tint: 0xffaa88,
                alpha: 0.45,
                border: { color: 0xdd8866, width: 3, style: "twin" },
                aura: { color: 0xffccaa, radius: 9, alpha: 0.16 },
                priority: 3,
            },
            cancer: {
                tint: 0x99ddff,
                alpha: 0.5,
                border: { color: 0x77bbdd, width: 3, style: "shell" },
                aura: { color: 0xbbddff, radius: 10, alpha: 0.18 },
                priority: 3,
            },
            leo: {
                tint: 0xffcc44,
                alpha: 0.55,
                border: { color: 0xddaa22, width: 4, style: "mane" },
                aura: { color: 0xffdd66, radius: 11, alpha: 0.2 },
                priority: 3,
            },
            virgo: {
                tint: 0xccaa99,
                alpha: 0.45,
                border: { color: 0xaa8877, width: 3, style: "precise" },
                aura: { color: 0xeeccbb, radius: 8, alpha: 0.15 },
                priority: 3,
            },
            libra: {
                tint: 0xccbbaa,
                alpha: 0.5,
                border: { color: 0xaa9988, width: 3, style: "balanced" },
                aura: { color: 0xeeddcc, radius: 9, alpha: 0.17 },
                priority: 3,
            },
            scorpio: {
                tint: 0x994466,
                alpha: 0.5,
                border: { color: 0x772244, width: 3, style: "sting" },
                aura: { color: 0xbb6688, radius: 10, alpha: 0.18 },
                priority: 3,
            },
            sagittarius: {
                tint: 0x8866cc,
                alpha: 0.5,
                border: { color: 0x6644aa, width: 3, style: "arrow" },
                aura: { color: 0xaa88ee, radius: 10, alpha: 0.17 },
                priority: 3,
            },
            capricorn: {
                tint: 0x667788,
                alpha: 0.5,
                border: { color: 0x445566, width: 3, style: "goat" },
                aura: { color: 0x8899aa, radius: 9, alpha: 0.17 },
                priority: 3,
            },
            aquarius: {
                tint: 0x66ccee,
                alpha: 0.5,
                border: { color: 0x44aacc, width: 3, style: "wave" },
                aura: { color: 0x88ddff, radius: 11, alpha: 0.18 },
                priority: 3,
            },
            pisces: {
                tint: 0x99bbdd,
                alpha: 0.45,
                border: { color: 0x7799bb, width: 3, style: "fish" },
                aura: { color: 0xbbddff, radius: 9, alpha: 0.16 },
                priority: 3,
            },
        };

        const layers = {
            fills: [],
            borders: [],
            auras: [],
        };

        if (!appliedCards || appliedCards.length === 0) {
            return layers;
        }

        for (const cardName of appliedCards) {
            const cardLower = cardName.toLowerCase();
            for (const [key, effect] of Object.entries(effectDefinitions)) {
                if (cardLower.includes(key)) {
                    layers.fills.push({
                        tint: effect.tint,
                        alpha: effect.alpha,
                        priority: effect.priority,
                    });
                    layers.borders.push({
                        ...effect.border,
                        priority: effect.priority,
                    });
                    layers.auras.push({
                        ...effect.aura,
                        priority: effect.priority,
                    });
                    break;
                }
            }
        }

        layers.fills.sort((a, b) => a.priority - b.priority);
        layers.borders.sort((a, b) => a.priority - b.priority);
        layers.auras.sort((a, b) => a.priority - b.priority);

        return layers;
    }

    drawStyledBorder(graphics, x, y, radius, borderDef, time, offset = 0) {
        const segments = 64;
        const angleStep = (Math.PI * 2) / segments;
        const actualRadius = radius + offset;

        switch (borderDef.style) {
            case "dashed":
                for (let i = 0; i < segments; i++) {
                    if (i % 4 < 2) {
                        const angle1 = i * angleStep;
                        const angle2 = (i + 1) * angleStep;
                        const x1 = x + Math.cos(angle1) * actualRadius;
                        const y1 = y + Math.sin(angle1) * actualRadius;
                        const x2 = x + Math.cos(angle2) * actualRadius;
                        const y2 = y + Math.sin(angle2) * actualRadius;

                        graphics.moveTo(x1, y1);
                        graphics.lineTo(x2, y2);
                    }
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "double":
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                graphics.circle(x, y, actualRadius - 4);
                graphics.stroke({
                    width: borderDef.width - 1,
                    color: borderDef.color,
                    alpha: 0.6,
                });
                break;

            case "wavy":
                graphics.moveTo(x + actualRadius, y);
                for (let i = 0; i <= segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    const wave = Math.sin(angle * 8 + time * 0.005) * 2;
                    const r = actualRadius + wave;
                    const px = x + Math.cos(angle) * r;
                    const py = y + Math.sin(angle) * r;
                    graphics.lineTo(px, py);
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "chaotic":
                for (let i = 0; i < segments; i++) {
                    const angle1 = i * angleStep;
                    const angle2 = (i + 1) * angleStep;
                    const offset1 = Math.sin(i * 0.5 + time * 0.003) * 3;
                    const offset2 = Math.sin((i + 1) * 0.5 + time * 0.003) * 3;
                    const x1 = x + Math.cos(angle1) * (actualRadius + offset1);
                    const y1 = y + Math.sin(angle1) * (actualRadius + offset1);
                    const x2 = x + Math.cos(angle2) * (actualRadius + offset2);
                    const y2 = y + Math.sin(angle2) * (actualRadius + offset2);

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "mystic":
                for (let i = 0; i < segments; i++) {
                    if (i % 3 === 0) {
                        const angle = i * angleStep;
                        const starRadius = actualRadius + 4;
                        const x1 = x + Math.cos(angle) * actualRadius;
                        const y1 = y + Math.sin(angle) * actualRadius;
                        const x2 = x + Math.cos(angle) * starRadius;
                        const y2 = y + Math.sin(angle) * starRadius;

                        graphics.moveTo(x1, y1);
                        graphics.lineTo(x2, y2);
                    }
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "divine":
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                    alpha: 0.8,
                });
                const pulse = Math.sin(time * 0.004) * 3;
                graphics.circle(x, y, actualRadius + pulse);
                graphics.stroke({
                    width: borderDef.width - 1,
                    color: 0xffffff,
                    alpha: 0.4,
                });
                break;

            case "royal":
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const crownRadius = actualRadius + 5;
                    const x1 = x + Math.cos(angle) * actualRadius;
                    const y1 = y + Math.sin(angle) * actualRadius;
                    const x2 = x + Math.cos(angle) * crownRadius;
                    const y2 = y + Math.sin(angle) * crownRadius;

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "speed":
                for (let i = 0; i < segments; i++) {
                    const angle = i * angleStep;
                    const speedOffset = Math.sin(angle * 4 - time * 0.01) * 4;
                    const r = actualRadius + speedOffset;
                    const x1 = x + Math.cos(angle) * r;
                    const y1 = y + Math.sin(angle) * r;

                    if (i % 4 === 0) {
                        graphics.moveTo(x1, y1);
                    } else {
                        graphics.lineTo(x1, y1);
                    }
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "spinning":
                const spinOffset = time * 0.003;
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2 + spinOffset;
                    const x1 = x + Math.cos(angle) * (actualRadius - 3);
                    const y1 = y + Math.sin(angle) * (actualRadius - 3);
                    const x2 = x + Math.cos(angle) * (actualRadius + 3);
                    const y2 = y + Math.sin(angle) * (actualRadius + 3);

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "skull":
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + time * 0.001;
                    const x1 = x + Math.cos(angle) * actualRadius;
                    const y1 = y + Math.sin(angle) * actualRadius;
                    const x2 = x + Math.cos(angle) * (actualRadius + 5);
                    const y2 = y + Math.sin(angle) * (actualRadius + 5);

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                }
                graphics.stroke({
                    width: 2,
                    color: borderDef.color,
                    alpha: 0.6,
                });
                break;

            case "demonic":
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const hornRadius = actualRadius + 8;
                    const x1 = x + Math.cos(angle) * actualRadius;
                    const y1 = y + Math.sin(angle) * actualRadius;
                    const x2 = x + Math.cos(angle) * hornRadius;
                    const y2 = y + Math.sin(angle) * hornRadius;

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                graphics.circle(x, y, actualRadius - 3);
                graphics.stroke({
                    width: 2,
                    color: 0xff0000,
                    alpha: 0.5,
                });
                break;

            case "crumbling":
                for (let i = 0; i < segments; i++) {
                    if (Math.random() > 0.3) {
                        const angle1 = i * angleStep;
                        const angle2 = (i + 1) * angleStep;
                        const offset = Math.random() * 3;
                        const x1 =
                            x + Math.cos(angle1) * (actualRadius + offset);
                        const y1 =
                            y + Math.sin(angle1) * (actualRadius + offset);
                        const x2 =
                            x + Math.cos(angle2) * (actualRadius + offset);
                        const y2 =
                            y + Math.sin(angle2) * (actualRadius + offset);

                        graphics.moveTo(x1, y1);
                        graphics.lineTo(x2, y2);
                    }
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "starlight":
                const twinkle = Math.sin(time * 0.005);
                for (let i = 0; i < 16; i++) {
                    const angle = (i / 16) * Math.PI * 2;
                    const starDist = actualRadius + 3 + twinkle * 2;
                    const x1 = x + Math.cos(angle) * starDist;
                    const y1 = y + Math.sin(angle) * starDist;

                    graphics.circle(x1, y1, 1.5);
                    graphics.fill({
                        color: 0xffffff,
                        alpha: 0.8 + twinkle * 0.2,
                    });
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "cosmic":
                for (let i = 0; i < 24; i++) {
                    const angle = (i / 24) * Math.PI * 2 + time * 0.002;
                    const orbitRadius =
                        actualRadius + Math.sin(i + time * 0.003) * 5;
                    const x1 = x + Math.cos(angle) * orbitRadius;
                    const y1 = y + Math.sin(angle) * orbitRadius;

                    graphics.circle(x1, y1, 2);
                    graphics.fill({
                        color: [0x8888ff, 0xff88ff, 0x88ffff][i % 3],
                        alpha: 0.6,
                    });
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "ram":
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const hornCurve = actualRadius + 6;
                    graphics.moveTo(
                        x + Math.cos(angle) * actualRadius,
                        y + Math.sin(angle) * actualRadius,
                    );
                    graphics.lineTo(
                        x + Math.cos(angle + 0.3) * hornCurve,
                        y + Math.sin(angle + 0.3) * hornCurve,
                    );
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "twin":
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                graphics.circle(x, y, actualRadius - 6);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                    alpha: 0.5,
                });
                break;

            case "shell":
                for (let i = 0; i < segments; i++) {
                    const angle = i * angleStep;
                    const shellRadius = actualRadius + Math.sin(i * 0.5) * 3;
                    const x1 = x + Math.cos(angle) * shellRadius;
                    const y1 = y + Math.sin(angle) * shellRadius;

                    if (i === 0) {
                        graphics.moveTo(x1, y1);
                    } else {
                        graphics.lineTo(x1, y1);
                    }
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "mane":
                for (let i = 0; i < 16; i++) {
                    const angle = (i / 16) * Math.PI * 2;
                    const maneLength = actualRadius + 5 + Math.random() * 3;
                    graphics.moveTo(
                        x + Math.cos(angle) * actualRadius,
                        y + Math.sin(angle) * actualRadius,
                    );
                    graphics.lineTo(
                        x + Math.cos(angle) * maneLength,
                        y + Math.sin(angle) * maneLength,
                    );
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "precise":
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    graphics.moveTo(
                        x + Math.cos(angle) * (actualRadius - 3),
                        y + Math.sin(angle) * (actualRadius - 3),
                    );
                    graphics.lineTo(
                        x + Math.cos(angle) * (actualRadius + 3),
                        y + Math.sin(angle) * (actualRadius + 3),
                    );
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "balanced":
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                graphics.moveTo(x - actualRadius, y);
                graphics.lineTo(x + actualRadius, y);
                graphics.moveTo(x, y - actualRadius);
                graphics.lineTo(x, y + actualRadius);
                graphics.stroke({
                    width: 2,
                    color: borderDef.color,
                    alpha: 0.6,
                });
                break;

            case "sting":
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                const stingAngle = time * 0.004;
                graphics.moveTo(x, y);
                graphics.lineTo(
                    x + Math.cos(stingAngle) * (actualRadius + 8),
                    y + Math.sin(stingAngle) * (actualRadius + 8),
                );
                graphics.stroke({
                    width: 3,
                    color: borderDef.color,
                });
                break;

            case "arrow":
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2 - time * 0.003;
                    graphics.moveTo(x, y);
                    graphics.lineTo(
                        x + Math.cos(angle) * actualRadius,
                        y + Math.sin(angle) * actualRadius,
                    );
                    graphics.lineTo(
                        x + Math.cos(angle + 0.2) * (actualRadius * 0.8),
                        y + Math.sin(angle + 0.2) * (actualRadius * 0.8),
                    );
                    graphics.moveTo(
                        x + Math.cos(angle) * actualRadius,
                        y + Math.sin(angle) * actualRadius,
                    );
                    graphics.lineTo(
                        x + Math.cos(angle - 0.2) * (actualRadius * 0.8),
                        y + Math.sin(angle - 0.2) * (actualRadius * 0.8),
                    );
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "goat":
                for (let i = 0; i < 2; i++) {
                    const angle = Math.PI * 0.25 + i * Math.PI;
                    graphics.moveTo(
                        x + Math.cos(angle) * actualRadius,
                        y + Math.sin(angle) * actualRadius,
                    );
                    graphics.lineTo(
                        x + Math.cos(angle - 0.5) * (actualRadius + 7),
                        y + Math.sin(angle - 0.5) * (actualRadius + 7),
                    );
                }
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "wave":
                graphics.moveTo(x + actualRadius, y);
                for (let i = 0; i <= segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    const wave = Math.sin(angle * 6 + time * 0.005) * 3;
                    const r = actualRadius + wave;
                    graphics.lineTo(
                        x + Math.cos(angle) * r,
                        y + Math.sin(angle) * r,
                    );
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;

            case "fish":
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                for (let i = 0; i < 2; i++) {
                    const angle = i * Math.PI;
                    const fishAngle = angle + Math.sin(time * 0.004) * 0.3;
                    graphics.moveTo(
                        x + Math.cos(fishAngle) * actualRadius,
                        y + Math.sin(fishAngle) * actualRadius,
                    );
                    graphics.lineTo(
                        x + Math.cos(fishAngle + 0.5) * (actualRadius + 5),
                        y + Math.sin(fishAngle + 0.5) * (actualRadius + 5),
                    );
                    graphics.lineTo(
                        x + Math.cos(fishAngle - 0.5) * (actualRadius + 5),
                        y + Math.sin(fishAngle - 0.5) * (actualRadius + 5),
                    );
                }
                graphics.stroke({
                    width: 2,
                    color: borderDef.color,
                });
                break;

            default:
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
        }
    }

    renderLocalPlayer(player, appliedCards = []) {
        if (!this.localPlayerGraphic) {
            this.localPlayerGraphic = new Graphics();
            this.localPlayerAuraGraphic = new Graphics();
            this.world.addChild(this.localPlayerAuraGraphic);
            this.world.addChild(this.localPlayerGraphic);
            this._cachedLayers = null;
            this._cachedCardsKey = "";
        }

        this.localPlayerGraphic.position.set(player.x, player.y);
        this.localPlayerAuraGraphic.position.set(player.x, player.y);

        this.localPlayerAuraGraphic.clear();
        this.renderPlayerAuras(player, this.localPlayerAuraGraphic);
        this.renderBarrier(player, this.localPlayerAuraGraphic);
        this.renderActiveEffects(player, this.localPlayerAuraGraphic);

        const cardsKey = JSON.stringify(appliedCards);
        const time = Date.now();

        if (this._cachedCardsKey !== cardsKey) {
            this._cachedLayers = this.getCardEffectLayers(appliedCards);
            this._cachedCardsKey = cardsKey;
            this._hasAnimatedBorders = this._cachedLayers.borders.some(
                (b) => b.style === "wavy" || b.style === "chaotic",
            );
        }

        const needsRedraw =
            this.localPlayerGraphic._lastSize !== player.size ||
            this._cachedCardsKey !==
                (this.localPlayerGraphic._lastCardsKey || "") ||
            (this._hasAnimatedBorders &&
                time - (this.localPlayerGraphic._lastRedraw || 0) > 300);

        if (needsRedraw) {
            this.localPlayerGraphic.clear();

            const layers = this._cachedLayers;

            if (layers.fills.length > 0) {
                for (let i = layers.auras.length - 1; i >= 0; i--) {
                    const aura = layers.auras[i];
                    this.localPlayerGraphic.circle(
                        0,
                        0,
                        player.size + aura.radius,
                    );
                    this.localPlayerGraphic.fill({
                        color: aura.color,
                        alpha: aura.alpha,
                    });
                }

                for (let i = 0; i < layers.fills.length; i++) {
                    const fill = layers.fills[i];
                    this.localPlayerGraphic.circle(0, 0, player.size);
                    this.localPlayerGraphic.fill({
                        color: fill.tint,
                        alpha: fill.alpha,
                    });
                }

                let borderOffset = 0;
                for (const border of layers.borders) {
                    this.drawStyledBorder(
                        this.localPlayerGraphic,
                        0,
                        0,
                        player.size,
                        border,
                        time,
                        borderOffset,
                    );
                    borderOffset += border.width + 1;
                }

                this.localPlayerGraphic.circle(0, 0, player.size * 0.35);
                this.localPlayerGraphic.fill({ color: 0xffffff, alpha: 0.12 });
            } else {
                this.localPlayerGraphic.circle(0, 0, player.size);
                this.localPlayerGraphic.stroke({ width: 2, color: 0x7777cc });
            }

            this.localPlayerGraphic._lastSize = player.size;
            this.localPlayerGraphic._lastCardsKey = this._cachedCardsKey;
            this.localPlayerGraphic._lastRedraw = time;
        }
    }

    renderPlayerAuras(player, graphics) {
        if (!player.auras || player.auras.length === 0) return;

        const time = Date.now();

        for (const aura of player.auras) {
            const pulseAlpha = 0.12 + Math.sin(time * 0.003) * 0.04;

            let color = 0xffffff;
            switch (aura.type) {
                case "damage":
                    color = 0x000000;
                    break;
                case "slow":
                    color = 0x4444ff;
                    break;
                case "poison":
                    color = 0x44ff44;
                    break;
                case "lifesteal":
                    color = 0xff0000;
                    break;
            }

            graphics.circle(0, 0, aura.radius);
            graphics.fill({ color, alpha: pulseAlpha });

            const ringRadius = aura.radius - 3 + Math.sin(time * 0.005) * 2;
            graphics.circle(0, 0, ringRadius);
            graphics.stroke({ width: 2, color, alpha: pulseAlpha * 2.5 });
        }
    }

    renderBarrier(player, graphics) {
        if (!player.barrier || player.barrier <= 0 || !player.max_barrier)
            return;

        const barPercent = player.barrier / player.max_barrier;
        const hexCount = 8;
        const angleStep = (Math.PI * 2) / hexCount;
        const time = Date.now();

        for (let i = 0; i < hexCount; i++) {
            const angle = i * angleStep + time * 0.001;
            const distance = player.size + 12;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            graphics.circle(x, y, 6);
            graphics.fill({ color: 0x4488ff, alpha: barPercent * 0.6 });

            graphics.circle(x, y, 6);
            graphics.stroke({
                width: 2,
                color: 0x88bbff,
                alpha: barPercent * 0.8,
            });
        }
    }

    renderActiveEffects(player, graphics) {
        if (!player.active_effects || player.active_effects.length === 0)
            return;

        const time = Date.now();

        for (const effect of player.active_effects) {
            let color = 0xffffff;
            switch (effect.type) {
                case "poison":
                    color = 0x44ff44;
                    break;
                case "burn":
                    color = 0xff4444;
                    break;
                case "regen":
                    color = 0x44ffff;
                    break;
            }

            const particleCount = 3;
            for (let i = 0; i < particleCount; i++) {
                const angle =
                    (time * 0.002 + i * ((Math.PI * 2) / particleCount)) %
                    (Math.PI * 2);
                const radius = player.size * 0.6;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                graphics.circle(x, y, 3);
                graphics.fill({ color, alpha: 0.6 });
            }
        }
    }
}
