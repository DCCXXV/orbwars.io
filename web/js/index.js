import { Application, Container, Graphics, Text } from "pixi.js";

let allCards = [];
const app = new Application();
await app.init({
    background: "#F9FBFF",
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
});

async function loadCards() {
    const res = await fetch("/js/cards.json");
    allCards = await res.json();
    console.log("Cartas cargadas:", allCards.length);
}

await loadCards();

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

let playerSize = 40;

const player = new Graphics().circle(0, 0, playerSize).stroke({
    width: 2,
    color: 0x7777cc,
});

player.position.set(app.screen.width / 2, app.screen.height / 2);
world.addChild(player);

const pellets = [];
const pelletCount = worldSize / 2;

const pelletSize = 4;

function spawnPellet() {
    const pellet = new Graphics().circle(0, 0, pelletSize).fill(0x7777cc);

    pellet.x = (Math.random() - 0.5) * worldSize * 2;
    pellet.y = (Math.random() - 0.5) * worldSize * 2;

    world.addChild(pellet);
    pellets.push(pellet);
}

for (let i = 0; i < pelletCount; i++) {
    spawnPellet();
}

let score = 0;

const scoreLabel = new Text({
    text: `Puntuación: ${score}`,
    style: {
        fontFamily: "Virgil",
        fontSize: 24,
        fill: 0xcc7777,
        align: "left",
    },
});

scoreLabel.position.set(app.screen.width - 200, 40);

app.stage.addChild(scoreLabel);

let cardsToSpawn = [];
function showCardSelection() {
    cardsToSpawn.forEach((c) => app.stage.removeChild(c));
    cardsToSpawn = [];
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 3);
    let offset = -320;
    chosen.forEach((card, i) => {
        const cardContainer = new Container();

        const cardBase = new Graphics()
            .rect(0, 0, 300, 500)
            .fill(0xf9fbff)
            .stroke({ width: 2, color: 0x7777cc });
        cardContainer.addChild(cardBase);

        const title = new Text({
            text: card.name,
            style: {
                fontFamily: "Virgil",
                fontSize: 24,
                fill: 0x7777cc,
                align: "center",
            },
        });
        title.position.set(20, 20);
        cardContainer.addChild(title);

        const rarityText = new Text({
            text: `${card.rarity}`,
            style: {
                fontFamily: "Virgil",
                fontSize: 18,
                fill: 0x777777,
            },
        });
        rarityText.position.set(30, 70);
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
            app.screen.width / 2 - cardBase.width / 2 + offset,
            app.screen.height / 2 - cardBase.height / 2,
        );

        cardContainer.eventMode = "static";
        cardContainer.cursor = "pointer";
        cardContainer.on("pointerdown", () => applyCard(card));

        app.stage.addChild(cardContainer);
        cardsToSpawn.push(cardContainer);

        offset += cardBase.width + 20;
    });
}

function applyCard(card) {
    card.effects.forEach((effect) => {
        switch (effect.stat) {
            case "speed":
                playerSpeed *= effect.modifier;
                break;
            case "playerSize":
                playerSize *= effect.modifier;
                player.clear();
                player.circle(0, 0, playerSize).stroke({
                    width: 2,
                    color: 0x7777cc,
                });
                break;
        }
    });
    cardsToSpawn.forEach((c) => app.stage.removeChild(c));
    cardsToSpawn = [];
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

let playerSpeed = 5;

app.ticker.add(() => {
    if (keys.w) player.y -= playerSpeed;
    if (keys.a) player.x -= playerSpeed;
    if (keys.s) player.y += playerSpeed;
    if (keys.d) player.x += playerSpeed;

    const radius = playerSize;
    player.x = Math.max(
        -worldSize + radius,
        Math.min(worldSize - radius, player.x),
    );
    player.y = Math.max(
        -worldSize + radius,
        Math.min(worldSize - radius, player.y),
    );

    const zoom = 1 + (40 / playerSize) * 0.3;
    world.scale.set(zoom);
    world.x = -player.x * zoom + app.screen.width / 2;
    world.y = -player.y * zoom + app.screen.height / 2;

    for (let i = pellets.length - 1; i >= 0; i--) {
        const pellet = pellets[i];
        const dx = player.x - pellet.x;
        const dy = player.y - pellet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < playerSize + pelletSize) {
            score += 1;

            if (score < 1000) scoreLabel.text = `Puntuación: ${score}`;
            else scoreLabel.text = `Puntuación: ${score / 1000}k`;

            if (score == 10 || score == 30 || score == 70) showCardSelection();

            world.removeChild(pellet);
            pellets.splice(i, 1);

            spawnPellet();
        }
    }
});
