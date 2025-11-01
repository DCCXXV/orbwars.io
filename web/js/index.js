import { Application, Container, Graphics, Text } from "pixi.js";
import { NetworkManager } from "./network.js";
import { Renderer } from "./renderer.js";

const app = new Application();
await app.init({
    background: "#F9FBFF",
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
});

document.body.appendChild(app.canvas);

const world = new Container();
app.stage.addChild(world);

const grid = new Graphics();
const worldSize = 8000;
const gridSize = 40;

for (let x = -worldSize; x < worldSize; x += gridSize) {
    grid.moveTo(x, -worldSize);
    grid.lineTo(x, worldSize);
}
for (let y = -worldSize; y < worldSize; y += gridSize) {
    grid.moveTo(-worldSize, y);
    grid.lineTo(worldSize, y);
}

grid.stroke({ width: 1, color: 0xccccff, alpha: 0.5 });
world.addChild(grid);

let score = 0;

const leaderArrowContainer = new Container();
const leaderArrow = new Graphics();
const leaderArrowText = new Text({
    text: "",
    style: {
        fontFamily: "Virgil",
        fontSize: 16,
        fill: 0xff6666,
        align: "center",
        fontWeight: "bold",
    },
});

leaderArrowContainer.addChild(leaderArrow);
leaderArrowContainer.addChild(leaderArrowText);
app.stage.addChild(leaderArrowContainer);

function drawLeaderArrow(
    myPlayer,
    leaderPlayer,
    myPlayerID,
    worldScale,
    worldOffsetX,
    worldOffsetY,
) {
    leaderArrow.clear();
    leaderArrowText.text = "";

    if (!leaderPlayer || leaderPlayer.id === myPlayerID) {
        leaderArrowContainer.visible = false;
        return;
    }

    leaderArrowContainer.visible = true;

    const dx = leaderPlayer.x - myPlayer.x;
    const dy = leaderPlayer.y - myPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const leaderScreenX = leaderPlayer.x * worldScale + worldOffsetX;
    const leaderScreenY = leaderPlayer.y * worldScale + worldOffsetY;

    const margin = 100;
    const isOnScreen =
        leaderScreenX > margin &&
        leaderScreenX < app.screen.width - margin &&
        leaderScreenY > margin &&
        leaderScreenY < app.screen.height - margin;

    if (isOnScreen) {
        leaderArrowContainer.visible = false;
        return;
    }

    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;

    const arrowDistance = Math.min(centerX - margin, centerY - margin);

    const arrowX = centerX + Math.cos(angle) * arrowDistance;
    const arrowY = centerY + Math.sin(angle) * arrowDistance;

    const arrowSize = 20;
    const arrowWidth = 15;

    leaderArrow.moveTo(0, 0);
    leaderArrow.lineTo(-arrowSize, -arrowWidth / 2);
    leaderArrow.lineTo(-arrowSize * 0.6, 0);
    leaderArrow.lineTo(-arrowSize, arrowWidth / 2);
    leaderArrow.lineTo(0, 0);
    leaderArrow.fill({ color: 0xff6666, alpha: 0.8 });

    leaderArrow.circle(0, 0, arrowSize * 0.3);
    leaderArrow.fill({ color: 0xffffff, alpha: 0.9 });

    leaderArrowContainer.position.set(arrowX, arrowY);
    leaderArrowContainer.rotation = angle;

    const distanceKm = Math.floor(distance / 100);
    leaderArrowText.text = `${distanceKm}`;
    leaderArrowText.position.set(-arrowSize - 25, -10);
    leaderArrowText.rotation = -angle;
    leaderArrowText.anchor.set(0.5);
}

const leaderboardContainer = new Container();
const leaderboardBg = new Graphics();
const leaderboardTitle = new Text({
    text: "LEADERBOARD",
    style: {
        fontFamily: "Virgil",
        fontSize: 22,
        fill: 0x333333,
        align: "center",
        fontWeight: "bold",
    },
});

leaderboardContainer.addChild(leaderboardBg);
leaderboardContainer.addChild(leaderboardTitle);
app.stage.addChild(leaderboardContainer);

const leaderboardEntries = [];
const maxLeaderboardEntries = 10;

const normalStyle = {
    fontFamily: "Virgil",
    fontSize: 18,
    fill: 0x333333,
    align: "left",
};

const highlightStyle = {
    fontFamily: "Virgil",
    fontSize: 18,
    fill: 0xcc7777,
    align: "left",
    fontWeight: "bold",
};

for (let i = 0; i < maxLeaderboardEntries + 1; i++) {
    const entryText = new Text({
        text: "",
        style: normalStyle,
    });
    leaderboardEntries.push(entryText);
    leaderboardContainer.addChild(entryText);
}

function updateLeaderboard(players, myPlayerID) {
    const sortedPlayers = [...players]
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.id.localeCompare(b.id);
        })
        .map((p, index) => ({
            player_id: p.id,
            score: p.score,
            rank: index + 1,
        }));

    const width = 300;
    const headerHeight = 40;
    const entryHeight = 30;
    const padding = 15;

    const x = app.screen.width - width - 20;
    const y = 20;

    leaderboardContainer.position.set(x, y);

    const top10 = sortedPlayers.slice(0, 10);

    const myEntry = sortedPlayers.find((e) => e.player_id === myPlayerID);
    const showMyEntry = myEntry && myEntry.rank > 10;

    const totalEntries = top10.length + (showMyEntry ? 1 : 0);
    const totalHeight = headerHeight + totalEntries * entryHeight + padding * 2;

    leaderboardBg.clear();
    leaderboardBg.rect(0, 0, width, totalHeight);
    leaderboardBg.fill({ color: 0xffffff, alpha: 0.5 });
    leaderboardBg.stroke({ width: 2, color: 0x777777 });

    leaderboardTitle.position.set(width / 2, padding);
    leaderboardTitle.anchor.set(0.5, 0);

    top10.forEach((entry, index) => {
        const entryText = leaderboardEntries[index];
        const isMe = entry.player_id === myPlayerID;

        const playerLabel =
            entry.player_id.substring(0, 12) +
            (entry.player_id.length > 12 ? "..." : "");
        entryText.text = `#${entry.rank}  ${playerLabel}  ${entry.score}`;

        entryText.position.set(
            padding,
            headerHeight + index * entryHeight + padding,
        );
        entryText.anchor.set(0, 0);

        if (isMe) {
            entryText.style = highlightStyle;
        } else {
            entryText.style = normalStyle;
        }

        entryText.visible = true;
    });

    if (showMyEntry) {
        const dotsIndex = top10.length;
        const myIndex = top10.length;

        const dotsText = leaderboardEntries[dotsIndex];
        dotsText.text = "...";
        dotsText.position.set(
            width / 2,
            headerHeight + dotsIndex * entryHeight + padding,
        );
        dotsText.anchor.set(0.5, 0);
        dotsText.style = { ...normalStyle, fill: 0x777777 };
        dotsText.visible = true;

        const myText = leaderboardEntries[myIndex];
        const playerLabel =
            myEntry.player_id.substring(0, 12) +
            (myEntry.player_id.length > 12 ? "..." : "");
        myText.text = `#${myEntry.rank}  ${playerLabel}  ${myEntry.score}`;
        myText.position.set(
            padding,
            headerHeight + (dotsIndex + 1) * entryHeight + padding,
        );
        myText.anchor.set(0, 0);
        myText.style = highlightStyle;
        myText.visible = true;
    }

    const usedEntries = top10.length + (showMyEntry ? 2 : 0);
    for (let i = usedEntries; i < leaderboardEntries.length; i++) {
        leaderboardEntries[i].visible = false;
    }

    return sortedPlayers.length > 0 ? sortedPlayers[0] : null;
}
const setProgressContainer = new Container();
const setProgressBg = new Graphics();
const setProgressTitle = new Text({
    text: "CARD SETS",
    style: {
        fontFamily: "Virgil",
        fontSize: 20,
        fill: 0x333333,
        align: "center",
        fontWeight: "bold",
    },
});

setProgressContainer.addChild(setProgressBg);
setProgressContainer.addChild(setProgressTitle);
app.stage.addChild(setProgressContainer);

const setProgressEntries = [];
const maxSetEntries = 4;

for (let i = 0; i < maxSetEntries; i++) {
    const entryText = new Text({
        text: "",
        style: {
            fontFamily: "Virgil",
            fontSize: 16,
            fill: 0x333333,
            align: "left",
        },
    });
    setProgressEntries.push(entryText);
    setProgressContainer.addChild(entryText);
}

function updateSetProgress(appliedCards) {
    const sets = {
        "Berserker Set": {
            parts: [
                "Berserker's Rage I",
                "Berserker's Rage II",
                "Berserker's Rage III",
            ],
            owned: 0,
            color: 0xdd3333,
        },
        "Guardian Set": {
            parts: [
                "Guardian's Shield I",
                "Guardian's Shield II",
                "Guardian's Shield III",
            ],
            owned: 0,
            color: 0x3333dd,
        },
        "Toxic Set": {
            parts: ["Toxic Touch I", "Toxic Touch II", "Toxic Touch III"],
            owned: 0,
            color: 0x33dd33,
        },
        "Vampire Set": {
            parts: ["Blood Hunger I", "Blood Hunger II", "Blood Hunger III"],
            owned: 0,
            color: 0xdd33dd,
        },
    };

    for (const cardName of appliedCards) {
        for (const setName in sets) {
            if (sets[setName].parts.includes(cardName)) {
                sets[setName].owned++;
            }
        }
    }

    const activeSets = Object.entries(sets).filter(
        ([_, data]) => data.owned > 0,
    );

    if (activeSets.length === 0) {
        setProgressContainer.visible = false;
        return;
    }

    setProgressContainer.visible = true;

    const width = 280;
    const headerHeight = 35;
    const entryHeight = 28;
    const padding = 12;

    const x = 20;
    const y = 20;

    setProgressContainer.position.set(x, y);

    const totalHeight =
        headerHeight + activeSets.length * entryHeight + padding * 2;

    setProgressBg.clear();
    setProgressBg.rect(0, 0, width, totalHeight);
    setProgressBg.fill({ color: 0xffffff, alpha: 0.5 });
    setProgressBg.stroke({ width: 2, color: 0x777777 });

    setProgressTitle.position.set(width / 2, padding);
    setProgressTitle.anchor.set(0.5, 0);

    activeSets.forEach(([setName, data], index) => {
        const entryText = setProgressEntries[index];
        const shortName = setName.replace(" Set", "");
        const isComplete = data.owned === 3;

        entryText.text = `${shortName}: ${data.owned}/3 ${isComplete ? "✓" : ""}`;
        entryText.position.set(
            padding,
            headerHeight + index * entryHeight + padding,
        );
        entryText.anchor.set(0, 0);
        entryText.style.fill = isComplete ? data.color : 0x666666;
        entryText.style.fontWeight = isComplete ? "bold" : "normal";
        entryText.visible = true;
    });

    for (let i = activeSets.length; i < setProgressEntries.length; i++) {
        setProgressEntries[i].visible = false;
    }
}

const healthBarContainer = new Container();
const healthBarBg = new Graphics();
const healthBarFill = new Graphics();
const healthText = new Text({
    text: "100 / 100",
    style: {
        fontFamily: "Virgil",
        fontSize: 20,
        fill: 0x333333,
        align: "center",
    },
});

healthBarContainer.addChild(healthBarBg);
healthBarContainer.addChild(healthBarFill);
healthBarContainer.addChild(healthText);
app.stage.addChild(healthBarContainer);

function updateHealthBar(health, maxHealth) {
    const barWidth = 400;
    const barHeight = 30;
    const x = app.screen.width / 2 - barWidth / 2;
    const y = app.screen.height - 60;

    healthBarContainer.position.set(x, y);

    healthBarBg.clear();
    healthBarBg.rect(0, 0, barWidth, barHeight);
    healthBarBg.fill({ color: 0x777777, alpha: 0.5 });

    const healthPercent = health / maxHealth;
    const fillWidth = barWidth * healthPercent;

    let color = 0x77cc77;
    if (healthPercent < 0.35) color = 0xff3377;

    healthBarFill.clear();
    healthBarFill.rect(0, 0, fillWidth, barHeight);
    healthBarFill.fill({ color });

    healthText.text = `${Math.ceil(health)} / ${maxHealth}`;
    healthText.position.set(barWidth / 2, barHeight / 2);
    healthText.anchor.set(0.5);
}

let cardsToSpawn = [];

function showCardSelection(cards) {
    cardsToSpawn.forEach((c) => app.stage.removeChild(c));
    cardsToSpawn = [];

    const cardWidth = 300;
    const cardHeight = 500;
    const spacing = 20;
    const totalWidth = cardWidth * 3 + spacing * 2;
    let offsetX = (app.screen.width - totalWidth) / 2;

    const rarityStyles = {
        common: {
            bg: 0xf9fbff,
            border: 0x7777cc,
            borderWidth: 2,
            titleColor: 0x7777cc,
        },
        uncommon: {
            bg: 0xf0fff0,
            border: 0x77cc77,
            borderWidth: 3,
            titleColor: 0x55aa55,
        },
        rare: {
            bg: 0xfff8e7,
            border: 0xffaa33,
            borderWidth: 3,
            titleColor: 0xdd8811,
        },
        epic: {
            bg: 0xfff0ff,
            border: 0xcc77cc,
            borderWidth: 4,
            titleColor: 0xaa55aa,
        },
        legendary: {
            bg: 0xffeeee,
            border: 0xff7777,
            borderWidth: 4,
            titleColor: 0xdd3333,
        },
    };

    cards.forEach((card) => {
        const cardContainer = new Container();
        const rarity = card.rarity.toLowerCase();
        const style = rarityStyles[rarity] || rarityStyles.common;

        const cardBase = new Graphics()
            .rect(0, 0, cardWidth, cardHeight)
            .fill(style.bg)
            .stroke({ width: style.borderWidth, color: style.border });
        cardContainer.addChild(cardBase);

        if (rarity === "epic" || rarity === "legendary") {
            const innerBorder = new Graphics()
                .rect(10, 10, cardWidth - 20, cardHeight - 20)
                .stroke({ width: 1, color: style.border, alpha: 0.5 });
            cardContainer.addChild(innerBorder);
        }

        const title = new Text({
            text: card.name,
            style: {
                fontFamily: "Virgil",
                fontSize: 24,
                fill: style.titleColor,
                align: "center",
                fontWeight: rarity === "legendary" ? "bold" : "normal",
            },
        });
        title.position.set(20, 20);
        cardContainer.addChild(title);

        const rarityText = new Text({
            text: card.rarity.toUpperCase(),
            style: {
                fontFamily: "Virgil",
                fontSize: 18,
                fill: style.titleColor,
                fontWeight: "bold",
            },
        });
        rarityText.position.set(20, 70);
        cardContainer.addChild(rarityText);

        const desc = new Text({
            text: card.description,
            style: {
                fontFamily: "Virgil",
                fontSize: 20,
                fill: 0x222222,
                wordWrap: true,
                wordWrapWidth: 260,
                lineHeight: 26,
            },
        });
        desc.position.set(20, 120);
        cardContainer.addChild(desc);

        cardContainer.position.set(
            offsetX,
            app.screen.height / 2 - cardHeight / 2,
        );

        cardContainer.eventMode = "static";
        cardContainer.cursor = "pointer";
        cardContainer.on("pointerdown", () => {
            network.sendCardChoice(card.id);
            cardsToSpawn.forEach((c) => app.stage.removeChild(c));
            cardsToSpawn = [];
        });

        app.stage.addChild(cardContainer);
        cardsToSpawn.push(cardContainer);

        offsetX += cardWidth + spacing;
    });
}

const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
};

window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) keys[key] = true;
});

window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) keys[key] = false;
});

const localPlayer = {
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    speed: 5,
    targetSpeed: 5,
    baseSpeed: 5,
    size: 40,
    health: 100,
    maxHealth: 100,
    damage: 10,
    appliedCards: [],
    barrier: 0,
    maxBarrier: 0,
    auras: [],
    active_effects: [],
    slowEffect: 0,
};

const prediction = {
    enabled: true,
    lastServerX: 0,
    lastServerY: 0,
    serverUpdateTime: 0,
};

const renderer = new Renderer(app, world);

function calculateSpeedFromCards(appliedCards) {
    let speedMultiplier = 1.0;

    const speedCards = {
        "swift step": 1.2,
        lightweight: 1.25,
        bulky: 0.85,
        sturdy: 0.9,
        nimble: 1.35,
        hungry: 0.9,
        berserker: 1.2,
        fortified: 0.75,
        speedster: 1.5,
        fool: 1.8,
        chariot: 2.2,
        death: 1.5,
        aries: 1.6,
        virgo: 1.35,
        libra: 1.35,
        sagittarius: 1.8,
        aquarius: 1.5,
        wheel: 1.6,
        world: 1.5,
    };

    const setsOwned = {
        berserker: 0,
    };

    for (const cardName of appliedCards) {
        const lower = cardName.toLowerCase();

        for (const [key, modifier] of Object.entries(speedCards)) {
            if (lower.includes(key)) {
                speedMultiplier *= modifier;
                break;
            }
        }

        if (lower.includes("berserker's rage")) {
            setsOwned.berserker++;
        }
    }

    if (setsOwned.berserker === 2) {
        speedMultiplier *= 1.1;
    } else if (setsOwned.berserker === 3) {
        speedMultiplier *= 1.5;
    }

    return Math.round(5 * speedMultiplier);
}

let leaderPlayer = null;

const network = new NetworkManager(
    (gameState) => {
        renderer.render(gameState);

        if (network.myPlayerID) {
            const serverPlayer = gameState.players.find(
                (p) => p.id === network.myPlayerID,
            );

            if (serverPlayer) {
                const now = Date.now();
                const timeSinceUpdate = now - prediction.serverUpdateTime;

                const calculatedSpeed = calculateSpeedFromCards(
                    serverPlayer.applied_cards || [],
                );
                if (localPlayer.targetSpeed !== calculatedSpeed) {
                    localPlayer.targetSpeed = calculatedSpeed;
                }

                if (timeSinceUpdate > 100) {
                    const predictedX = localPlayer.x + localPlayer.velocityX;
                    const predictedY = localPlayer.y + localPlayer.velocityY;

                    localPlayer.x = predictedX;
                    localPlayer.y = predictedY;
                } else {
                    const dx = serverPlayer.x - localPlayer.x;
                    const dy = serverPlayer.y - localPlayer.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    const baseLerp = 0.2;
                    const distanceFactor = Math.min(distance / 50, 1.0);
                    const lerpFactor = baseLerp + distanceFactor * 0.3;

                    localPlayer.x += dx * lerpFactor;
                    localPlayer.y += dy * lerpFactor;
                }

                prediction.lastServerX = serverPlayer.x;
                prediction.lastServerY = serverPlayer.y;
                prediction.serverUpdateTime = now;

                score = serverPlayer.score;
                localPlayer.health = serverPlayer.health;
                localPlayer.maxHealth = serverPlayer.max_health;
                localPlayer.damage = serverPlayer.damage;
                localPlayer.appliedCards = serverPlayer.applied_cards || [];
                localPlayer.size = serverPlayer.size;
                localPlayer.barrier = serverPlayer.barrier || 0;
                localPlayer.maxBarrier = serverPlayer.max_barrier || 0;
                localPlayer.auras = serverPlayer.auras || [];
                localPlayer.active_effects = serverPlayer.active_effects || [];

                updateHealthBar(localPlayer.health, localPlayer.maxHealth);
                updateBarrierBar(localPlayer.barrier, localPlayer.maxBarrier);
                updateSetProgress(localPlayer.appliedCards);
            }

            const topPlayer = updateLeaderboard(
                gameState.players,
                network.myPlayerID,
            );

            if (topPlayer) {
                leaderPlayer = gameState.players.find(
                    (p) => p.id === topPlayer.player_id,
                );
            }
        }

        if (network.myPlayerID && !renderer.myPlayerID) {
            renderer.setMyPlayerID(network.myPlayerID);

            const myPlayer = gameState.players.find(
                (p) => p.id === network.myPlayerID,
            );
            if (myPlayer) {
                localPlayer.x = myPlayer.x;
                localPlayer.y = myPlayer.y;
                localPlayer.speed = calculateSpeedFromCards(
                    myPlayer.applied_cards || [],
                );
                localPlayer.targetSpeed = localPlayer.speed;
                localPlayer.health = myPlayer.health;
                localPlayer.maxHealth = myPlayer.max_health;
                localPlayer.damage = myPlayer.damage;
                localPlayer.barrier = myPlayer.barrier || 0;
                localPlayer.maxBarrier = myPlayer.max_barrier || 0;

                updateBarrierBar(localPlayer.barrier, localPlayer.maxBarrier);
            }
        }
    },
    (cards) => {
        showCardSelection(cards);
    },
);

network.connect();

function updateLocalPlayer() {
    const speedDiff = localPlayer.targetSpeed - localPlayer.speed;
    if (Math.abs(speedDiff) > 0.1) {
        localPlayer.speed += speedDiff * 0.15;
    } else {
        localPlayer.speed = localPlayer.targetSpeed;
    }

    let targetVelX = 0;
    let targetVelY = 0;

    const effectiveSpeed = localPlayer.speed * (1.0 - localPlayer.slowEffect);

    if (keys.w) targetVelY -= effectiveSpeed;
    if (keys.s) targetVelY += effectiveSpeed;
    if (keys.a) targetVelX -= effectiveSpeed;
    if (keys.d) targetVelX += effectiveSpeed;

    const baseAccel = 0.2;
    const speedRatio = localPlayer.speed / 5;
    const accel = Math.min(0.5, baseAccel + speedRatio * 0.05);

    localPlayer.velocityX += (targetVelX - localPlayer.velocityX) * accel;
    localPlayer.velocityY += (targetVelY - localPlayer.velocityY) * accel;

    localPlayer.velocityX = Math.round(localPlayer.velocityX * 100) / 100;
    localPlayer.velocityY = Math.round(localPlayer.velocityY * 100) / 100;

    localPlayer.x += localPlayer.velocityX;
    localPlayer.y += localPlayer.velocityY;

    localPlayer.x = Math.round(localPlayer.x * 10) / 10;
    localPlayer.y = Math.round(localPlayer.y * 10) / 10;

    const radius = localPlayer.size;
    localPlayer.x = Math.max(
        -worldSize + radius,
        Math.min(worldSize - radius, localPlayer.x),
    );
    localPlayer.y = Math.max(
        -worldSize + radius,
        Math.min(worldSize - radius, localPlayer.y),
    );
}

let lastInputSend = 0;

app.ticker.add(() => {
    updateLocalPlayer();
    renderer.renderLocalPlayer(localPlayer, localPlayer.appliedCards || []);
    updateCameraLocal();

    if (leaderPlayer && network.myPlayerID) {
        drawLeaderArrow(
            localPlayer,
            leaderPlayer,
            network.myPlayerID,
            world.scale.x,
            world.x,
            world.y,
        );
    }

    const now = Date.now();
    const speedRatio = localPlayer.speed / 5;
    const inputInterval = Math.max(16, 50 - speedRatio * 15);
    if (now - lastInputSend > inputInterval) {
        network.sendInput(keys);
        lastInputSend = now;
    }
});

function updateCameraLocal() {
    if (!network.myPlayerID) return;

    const zoomFactor = Math.max(
        0.5,
        Math.min(2.0, 1 + (40 / localPlayer.size) * 0.3),
    );
    world.scale.set(zoomFactor);
    world.x = -localPlayer.x * zoomFactor + app.screen.width / 2;
    world.y = -localPlayer.y * zoomFactor + app.screen.height / 2;
}

window.addEventListener("resize", () => {
    updateHealthBar(localPlayer.health, localPlayer.maxHealth);
});

const barrierBarContainer = new Container();
const barrierBarBg = new Graphics();
const barrierBarFill = new Graphics();
const barrierText = new Text({
    text: "",
    style: {
        fontFamily: "Virgil",
        fontSize: 18,
        fill: 0x4488ff,
        align: "center",
    },
});

barrierBarContainer.addChild(barrierBarBg);
barrierBarContainer.addChild(barrierBarFill);
barrierBarContainer.addChild(barrierText);
app.stage.addChild(barrierBarContainer);

function updateBarrierBar(barrier, maxBarrier) {
    if (maxBarrier <= 0) {
        barrierBarContainer.visible = false;
        return;
    }

    barrierBarContainer.visible = true;

    const barWidth = 400;
    const barHeight = 20;
    const x = app.screen.width / 2 - barWidth / 2;
    const y = app.screen.height - 100;

    barrierBarContainer.position.set(x, y);

    barrierBarBg.clear();
    barrierBarBg.rect(0, 0, barWidth, barHeight);
    barrierBarBg.fill({ color: 0x333366, alpha: 0.5 });

    const barrierPercent = barrier / maxBarrier;
    const fillWidth = barWidth * barrierPercent;

    barrierBarFill.clear();
    barrierBarFill.rect(0, 0, fillWidth, barHeight);
    barrierBarFill.fill({ color: 0x4488ff });

    barrierText.text = `BARRIER: ${Math.ceil(barrier)} / ${maxBarrier}`;
    barrierText.position.set(barWidth / 2, barHeight / 2);
    barrierText.anchor.set(0.5);
}

updateHealthBar(localPlayer.health, localPlayer.maxHealth);
updateSetProgress([]);
