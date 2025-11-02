import { Graphics, Container } from "pixi.js";

export class Renderer {
    constructor(app, world) {
        this.app = app;
        this.world = world;

        this.playerGraphics = new Map();
        this.pelletGraphics = new Map();
        this.localPlayerGraphic = null;
        this.localPlayerAuraGraphic = null;

        this.myPlayerID = null;

        this.time = 0;
        this.animationFrame = 0;

        this.cachedSin = 0;
        this.cachedCos = 0;
        this.cachedPulse = 0;
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
        this.time = Date.now();
        this.animationFrame++;

        this.cachedSin = Math.sin(this.time * 0.003);
        this.cachedCos = Math.cos(this.time * 0.003);
        this.cachedPulse = 0.12 + this.cachedSin * 0.04;

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
                    lastCardsHash: 0,
                    lastRedraw: 0,
                    lastAuraFrame: 0,
                    cachedLayers: null,
                };
                this.playerGraphics.set(player.id, graphic);
            }

            graphic.container.position.set(player.x, player.y);

            if (this.animationFrame - graphic.lastAuraFrame > 2) {
                graphic.auraGraphics.clear();
                this.renderPlayerAuras(player, graphic.auraGraphics);
                this.renderBarrier(player, graphic.auraGraphics);
                this.renderActiveEffects(player, graphic.auraGraphics);
                graphic.lastAuraFrame = this.animationFrame;
            }

            const cardsHash = this.hashCards(player.applied_cards);

            if (cardsHash !== graphic.lastCardsHash) {
                graphic.cachedLayers = this.getCardEffectLayers(
                    player.applied_cards || [],
                );
                graphic.lastCardsHash = cardsHash;
            }

            const hasAnimated =
                graphic.cachedLayers &&
                graphic.cachedLayers.borders.some(
                    (b) => b.style === "wavy" || b.style === "chaotic",
                );

            const needsRedraw =
                graphic.lastSize !== player.size ||
                cardsHash !== graphic.lastCardsHash ||
                (hasAnimated && this.time - graphic.lastRedraw > 300);

            if (needsRedraw) {
                graphic.circle.clear();

                const layers = graphic.cachedLayers;

                if (layers && layers.fills.length > 0) {
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
                            this.time,
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
                graphic.lastRedraw = this.time;
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

    hashCards(cards) {
        if (!cards || cards.length === 0) return 0;
        let hash = 0;
        for (let i = 0; i < cards.length; i++) {
            const str = cards[i];
            for (let j = 0; j < str.length; j++) {
                hash = (hash << 5) - hash + str.charCodeAt(j);
                hash = hash & hash;
            }
        }
        return hash;
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
            },
            toxic: {
                tint: 0x77ff77,
                alpha: 0.45,
                border: { color: 0x44dd44, width: 2, style: "dashed" },
                aura: { color: 0x77ff77, radius: 6, alpha: 0.15 },
            },
            fire: {
                tint: 0xff7733,
                alpha: 0.5,
                border: { color: 0xff4400, width: 2, style: "wavy" },
                aura: { color: 0xff7733, radius: 8, alpha: 0.2 },
            },
            flame: {
                tint: 0xff7733,
                alpha: 0.5,
                border: { color: 0xff4400, width: 2, style: "wavy" },
                aura: { color: 0xff7733, radius: 8, alpha: 0.2 },
            },
            ice: {
                tint: 0x77ddff,
                alpha: 0.4,
                border: { color: 0x4499ff, width: 2, style: "zigzag" },
                aura: { color: 0x77ddff, radius: 7, alpha: 0.18 },
            },
            frost: {
                tint: 0x77ddff,
                alpha: 0.4,
                border: { color: 0x4499ff, width: 2, style: "zigzag" },
                aura: { color: 0x77ddff, radius: 7, alpha: 0.18 },
            },
            lightning: {
                tint: 0xffff44,
                alpha: 0.35,
                border: { color: 0xffdd00, width: 3, style: "chaotic" },
                aura: { color: 0xffff44, radius: 10, alpha: 0.12 },
            },
            storm: {
                tint: 0xffff44,
                alpha: 0.35,
                border: { color: 0xffdd00, width: 3, style: "chaotic" },
                aura: { color: 0xffff44, radius: 10, alpha: 0.12 },
            },
            blood: {
                tint: 0xcc3333,
                alpha: 0.55,
                border: { color: 0xaa0000, width: 2, style: "dripping" },
                aura: { color: 0xcc3333, radius: 5, alpha: 0.2 },
            },
            vampire: {
                tint: 0xcc3333,
                alpha: 0.55,
                border: { color: 0xaa0000, width: 2, style: "dripping" },
                aura: { color: 0xcc3333, radius: 5, alpha: 0.2 },
            },
            shadow: {
                tint: 0x554477,
                alpha: 0.6,
                border: { color: 0x332255, width: 3, style: "smoky" },
                aura: { color: 0x554477, radius: 12, alpha: 0.25 },
            },
            dark: {
                tint: 0x554477,
                alpha: 0.6,
                border: { color: 0x332255, width: 3, style: "smoky" },
                aura: { color: 0x554477, radius: 12, alpha: 0.25 },
            },
            holy: {
                tint: 0xffffaa,
                alpha: 0.42,
                border: { color: 0xffff66, width: 3, style: "glowing" },
                aura: { color: 0xffffaa, radius: 15, alpha: 0.15 },
            },
            divine: {
                tint: 0xffffaa,
                alpha: 0.42,
                border: { color: 0xffff66, width: 3, style: "glowing" },
                aura: { color: 0xffffaa, radius: 15, alpha: 0.15 },
            },
            earth: {
                tint: 0x996633,
                alpha: 0.48,
                border: { color: 0x774422, width: 3, style: "rocky" },
                aura: { color: 0x996633, radius: 6, alpha: 0.22 },
            },
            stone: {
                tint: 0x996633,
                alpha: 0.48,
                border: { color: 0x774422, width: 3, style: "rocky" },
                aura: { color: 0x996633, radius: 6, alpha: 0.22 },
            },
            wind: {
                tint: 0xaaffee,
                alpha: 0.35,
                border: { color: 0x77ddcc, width: 2, style: "swirling" },
                aura: { color: 0xaaffee, radius: 14, alpha: 0.12 },
            },
            air: {
                tint: 0xaaffee,
                alpha: 0.35,
                border: { color: 0x77ddcc, width: 2, style: "swirling" },
                aura: { color: 0xaaffee, radius: 14, alpha: 0.12 },
            },
            arcane: {
                tint: 0xff66ff,
                alpha: 0.4,
                border: { color: 0xdd44dd, width: 2, style: "mystical" },
                aura: { color: 0xff66ff, radius: 10, alpha: 0.18 },
            },
            magic: {
                tint: 0xff66ff,
                alpha: 0.4,
                border: { color: 0xdd44dd, width: 2, style: "mystical" },
                aura: { color: 0xff66ff, radius: 10, alpha: 0.18 },
            },
            ocean: {
                tint: 0x3377ff,
                alpha: 0.45,
                border: { color: 0x2255dd, width: 2, style: "flowing" },
                aura: { color: 0x3377ff, radius: 9, alpha: 0.16 },
            },
            water: {
                tint: 0x3377ff,
                alpha: 0.45,
                border: { color: 0x2255dd, width: 2, style: "flowing" },
                aura: { color: 0x3377ff, radius: 9, alpha: 0.16 },
            },
            metal: {
                tint: 0xcccccc,
                alpha: 0.5,
                border: { color: 0x999999, width: 3, style: "metallic" },
                aura: { color: 0xcccccc, radius: 5, alpha: 0.2 },
            },
            steel: {
                tint: 0xcccccc,
                alpha: 0.5,
                border: { color: 0x999999, width: 3, style: "metallic" },
                aura: { color: 0xcccccc, radius: 5, alpha: 0.2 },
            },
            nature: {
                tint: 0x66dd66,
                alpha: 0.43,
                border: { color: 0x44bb44, width: 2, style: "organic" },
                aura: { color: 0x66dd66, radius: 11, alpha: 0.17 },
            },
            life: {
                tint: 0x66dd66,
                alpha: 0.43,
                border: { color: 0x44bb44, width: 2, style: "organic" },
                aura: { color: 0x66dd66, radius: 11, alpha: 0.17 },
            },
            berserker: {
                tint: 0xff4444,
                alpha: 0.55,
                border: { color: 0xdd2222, width: 3, style: "aggressive" },
                aura: { color: 0xff4444, radius: 8, alpha: 0.22 },
            },
            rage: {
                tint: 0xff4444,
                alpha: 0.55,
                border: { color: 0xdd2222, width: 3, style: "aggressive" },
                aura: { color: 0xff4444, radius: 8, alpha: 0.22 },
            },
            guardian: {
                tint: 0x4488ff,
                alpha: 0.48,
                border: { color: 0x2266dd, width: 4, style: "shield" },
                aura: { color: 0x4488ff, radius: 6, alpha: 0.2 },
            },
            shield: {
                tint: 0x4488ff,
                alpha: 0.48,
                border: { color: 0x2266dd, width: 4, style: "shield" },
                aura: { color: 0x4488ff, radius: 6, alpha: 0.2 },
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
            const nameLower = cardName.toLowerCase();
            let matched = false;

            for (const [keyword, effect] of Object.entries(effectDefinitions)) {
                if (nameLower.includes(keyword)) {
                    layers.fills.push({
                        tint: effect.tint,
                        alpha: effect.alpha,
                    });
                    layers.borders.push(effect.border);
                    layers.auras.push(effect.aura);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                layers.fills.push({ tint: 0x7777cc, alpha: 0.6 });
                layers.borders.push({
                    color: 0x5555aa,
                    width: 2,
                    style: "solid",
                });
            }
        }

        return layers;
    }

    drawStyledBorder(graphics, x, y, baseRadius, borderDef, time, offset) {
        const actualRadius = baseRadius + offset;
        const segments = 32;
        const angleStep = (Math.PI * 2) / segments;

        switch (borderDef.style) {
            case "dashed": {
                const dashLength = 8;
                const gapLength = 6;
                const circumference = 2 * Math.PI * actualRadius;
                const totalDashGap = dashLength + gapLength;
                const numDashes = Math.floor(circumference / totalDashGap);

                for (let i = 0; i < numDashes; i++) {
                    const startAngle =
                        ((i * totalDashGap) / circumference) * Math.PI * 2;
                    const endAngle =
                        startAngle + (dashLength / circumference) * Math.PI * 2;

                    const x1 = x + Math.cos(startAngle) * actualRadius;
                    const y1 = y + Math.sin(startAngle) * actualRadius;
                    const x2 = x + Math.cos(endAngle) * actualRadius;
                    const y2 = y + Math.sin(endAngle) * actualRadius;

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;
            }

            case "wavy": {
                graphics.moveTo(x + actualRadius, y);

                const waveAmp = 3;
                const waveFreq = 8;
                const timeOffset = time * 0.002;

                for (let i = 1; i <= segments; i++) {
                    const angle = i * angleStep;
                    const wave =
                        Math.sin(angle * waveFreq + timeOffset) * waveAmp;
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
            }

            case "zigzag": {
                const zigzagSize = 4;
                const pointsPerSide = 12;

                for (let i = 0; i < pointsPerSide; i++) {
                    const angle = i * ((Math.PI * 2) / pointsPerSide);
                    const nextAngle = (i + 1) * ((Math.PI * 2) / pointsPerSide);

                    const outR = actualRadius + zigzagSize;
                    const inR = actualRadius;

                    const x1 = x + Math.cos(angle) * outR;
                    const y1 = y + Math.sin(angle) * outR;
                    const x2 = x + Math.cos((angle + nextAngle) / 2) * inR;
                    const y2 = y + Math.sin((angle + nextAngle) / 2) * inR;

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;
            }

            case "chaotic": {
                const seed = Math.floor(time / 100);
                const random = (i) => {
                    const s = Math.sin((seed + i) * 12.9898) * 43758.5453;
                    return s - Math.floor(s);
                };

                graphics.moveTo(x + actualRadius, y);

                for (let i = 1; i <= segments; i++) {
                    const angle = i * angleStep;
                    const chaos = (random(i) - 0.5) * 6;
                    const r = actualRadius + chaos;
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
            }

            case "dripping": {
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });

                const numDrips = 6;
                for (let i = 0; i < numDrips; i++) {
                    const angle =
                        (i / numDrips) * Math.PI * 2 +
                        Math.sin(time * 0.001 + i) * 0.2;
                    const dripLength = 5 + Math.sin(time * 0.002 + i * 2) * 3;
                    const startX = x + Math.cos(angle) * actualRadius;
                    const startY = y + Math.sin(angle) * actualRadius;
                    const endX =
                        x + Math.cos(angle) * (actualRadius + dripLength);
                    const endY =
                        y + Math.sin(angle) * (actualRadius + dripLength);

                    graphics.moveTo(startX, startY);
                    graphics.lineTo(endX, endY);
                }
                graphics.stroke({
                    width: borderDef.width - 1,
                    color: borderDef.color,
                });
                break;
            }

            case "smoky": {
                const numLayers = 3;
                for (let layer = 0; layer < numLayers; layer++) {
                    const layerAlpha = 0.3 - layer * 0.08;
                    const layerRadius = actualRadius + layer * 2;

                    graphics.moveTo(x + layerRadius, y);

                    for (let i = 1; i <= segments; i++) {
                        const angle = i * angleStep;
                        const noise =
                            Math.sin(angle * 5 + time * 0.001 + layer) * 2;
                        const r = layerRadius + noise;
                        graphics.lineTo(
                            x + Math.cos(angle) * r,
                            y + Math.sin(angle) * r,
                        );
                    }
                    graphics.stroke({
                        width: borderDef.width,
                        color: borderDef.color,
                        alpha: layerAlpha,
                    });
                }
                break;
            }

            case "glowing": {
                const glowLayers = 3;
                for (let i = 0; i < glowLayers; i++) {
                    const glowRadius = actualRadius + i * 2;
                    const glowAlpha = 0.4 / (i + 1);
                    graphics.circle(x, y, glowRadius);
                    graphics.stroke({
                        width: borderDef.width + i,
                        color: borderDef.color,
                        alpha: glowAlpha,
                    });
                }
                break;
            }

            case "rocky": {
                const numRocks = 16;
                for (let i = 0; i < numRocks; i++) {
                    const angle = (i / numRocks) * Math.PI * 2;
                    const nextAngle = ((i + 1) / numRocks) * Math.PI * 2;
                    const rockSize = 3 + (i % 3);
                    const r =
                        actualRadius + (i % 2 === 0 ? rockSize : -rockSize);

                    const x1 = x + Math.cos(angle) * r;
                    const y1 = y + Math.sin(angle) * r;
                    const x2 = x + Math.cos(nextAngle) * r;
                    const y2 = y + Math.sin(nextAngle) * r;

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;
            }

            case "swirling": {
                const numSwirls = 3;
                for (let swirl = 0; swirl < numSwirls; swirl++) {
                    const swirlOffset =
                        (swirl / numSwirls) * Math.PI * 2 + time * 0.001;
                    graphics.moveTo(
                        x + Math.cos(swirlOffset) * actualRadius,
                        y + Math.sin(swirlOffset) * actualRadius,
                    );

                    for (let i = 1; i <= segments; i++) {
                        const angle = i * angleStep + swirlOffset;
                        const spiral = Math.sin(angle * 3) * 2;
                        const r = actualRadius + spiral;
                        graphics.lineTo(
                            x + Math.cos(angle) * r,
                            y + Math.sin(angle) * r,
                        );
                    }
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                    alpha: 0.6,
                });
                break;
            }

            case "mystical": {
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });

                const numStars = 8;
                for (let i = 0; i < numStars; i++) {
                    const angle = (i / numStars) * Math.PI * 2 + time * 0.002;
                    const starSize = 5;
                    const cx = x + Math.cos(angle) * actualRadius;
                    const cy = y + Math.sin(angle) * actualRadius;

                    for (let j = 0; j < 4; j++) {
                        const starAngle = angle + (j / 4) * Math.PI * 2;
                        graphics.moveTo(cx, cy);
                        graphics.lineTo(
                            cx + Math.cos(starAngle) * starSize,
                            cy + Math.sin(starAngle) * starSize,
                        );
                    }
                }
                graphics.stroke({ width: 1, color: borderDef.color });
                break;
            }

            case "flowing": {
                graphics.moveTo(x + actualRadius, y);

                const flowSpeed = time * 0.003;
                for (let i = 1; i <= segments; i++) {
                    const angle = i * angleStep;
                    const flow =
                        Math.sin(angle * 4 + flowSpeed) * 2 +
                        Math.cos(angle * 2 - flowSpeed) * 1;
                    const r = actualRadius + flow;
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
            }

            case "metallic": {
                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });

                const numShines = 4;
                for (let i = 0; i < numShines; i++) {
                    const angle = (i / numShines) * Math.PI * 2 + time * 0.0005;
                    const shineRadius = actualRadius - 2;
                    const shineLength = 8;

                    const sx = x + Math.cos(angle) * shineRadius;
                    const sy = y + Math.sin(angle) * shineRadius;
                    const ex =
                        x + Math.cos(angle) * (shineRadius + shineLength);
                    const ey =
                        y + Math.sin(angle) * (shineRadius + shineLength);

                    graphics.moveTo(sx, sy);
                    graphics.lineTo(ex, ey);
                }
                graphics.stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
                break;
            }

            case "organic": {
                graphics.moveTo(x + actualRadius, y);

                for (let i = 1; i <= segments; i++) {
                    const angle = i * angleStep;
                    const organic =
                        Math.sin(angle * 7) * 2 +
                        Math.sin(angle * 3 + time * 0.001) * 1.5;
                    const r = actualRadius + organic;
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
            }

            case "aggressive": {
                const numSpikes = 12;
                for (let i = 0; i < numSpikes; i++) {
                    const angle = (i / numSpikes) * Math.PI * 2;
                    const spikeLength = 6 + Math.sin(time * 0.005 + i) * 2;

                    const baseX = x + Math.cos(angle) * actualRadius;
                    const baseY = y + Math.sin(angle) * actualRadius;
                    const tipX =
                        x + Math.cos(angle) * (actualRadius + spikeLength);
                    const tipY =
                        y + Math.sin(angle) * (actualRadius + spikeLength);

                    graphics.moveTo(baseX, baseY);
                    graphics.lineTo(tipX, tipY);
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });

                graphics.circle(x, y, actualRadius);
                graphics.stroke({
                    width: borderDef.width - 1,
                    color: borderDef.color,
                });
                break;
            }

            case "shield": {
                const numPanels = 8;
                for (let i = 0; i < numPanels; i++) {
                    const angle = (i / numPanels) * Math.PI * 2;
                    const nextAngle = ((i + 1) / numPanels) * Math.PI * 2;
                    const midAngle = (angle + nextAngle) / 2;

                    const x1 = x + Math.cos(angle) * actualRadius;
                    const y1 = y + Math.sin(angle) * actualRadius;
                    const x2 = x + Math.cos(nextAngle) * actualRadius;
                    const y2 = y + Math.sin(nextAngle) * actualRadius;
                    const xm = x + Math.cos(midAngle) * (actualRadius + 3);
                    const ym = y + Math.sin(midAngle) * (actualRadius + 3);

                    graphics.moveTo(x1, y1);
                    graphics.lineTo(xm, ym);
                    graphics.lineTo(x2, y2);
                }
                graphics.stroke({
                    width: borderDef.width,
                    color: borderDef.color,
                });
                break;
            }

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
            this._cachedCardsHash = 0;
            this._lastSize = 0;
            this._lastRedraw = 0;
            this._lastAuraFrame = 0;
        }

        this.localPlayerGraphic.position.set(player.x, player.y);
        this.localPlayerAuraGraphic.position.set(player.x, player.y);

        if (this.animationFrame - this._lastAuraFrame > 2) {
            this.localPlayerAuraGraphic.clear();
            this.renderPlayerAuras(player, this.localPlayerAuraGraphic);
            this.renderBarrier(player, this.localPlayerAuraGraphic);
            this.renderActiveEffects(player, this.localPlayerAuraGraphic);
            this._lastAuraFrame = this.animationFrame;
        }

        const cardsHash = this.hashCards(appliedCards);

        if (this._cachedCardsHash !== cardsHash) {
            this._cachedLayers = this.getCardEffectLayers(appliedCards);
            this._cachedCardsHash = cardsHash;
        }

        const hasAnimated =
            this._cachedLayers &&
            this._cachedLayers.borders.some(
                (b) => b.style === "wavy" || b.style === "chaotic",
            );

        const needsRedraw =
            this._lastSize !== player.size ||
            cardsHash !== this._cachedCardsHash ||
            (hasAnimated && this.time - this._lastRedraw > 300);

        if (needsRedraw) {
            this.localPlayerGraphic.clear();

            const layers = this._cachedLayers;

            if (layers && layers.fills.length > 0) {
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

                for (const fill of layers.fills) {
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
                        this.time,
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

            this._lastSize = player.size;
            this._lastRedraw = this.time;
        }
    }

    renderPlayerAuras(player, graphics) {
        if (!player.auras || player.auras.length === 0) return;

        const pulseAlpha = this.cachedPulse;
        const ringOffset = Math.sin(this.time * 0.005) * 2;

        for (const aura of player.auras) {
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

            const ringRadius = aura.radius - 3 + ringOffset;
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
        const rotationPhase = this.time * 0.001;

        for (let i = 0; i < hexCount; i++) {
            const angle = i * angleStep + rotationPhase;
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

        const particleCount = 3;
        const rotationPhase = this.time * 0.002;

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

            for (let i = 0; i < particleCount; i++) {
                const angle =
                    (rotationPhase + i * ((Math.PI * 2) / particleCount)) %
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
