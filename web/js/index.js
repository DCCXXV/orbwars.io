import { Application, Container, Graphics, Text } from "pixi.js";

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

let playerSize = 40;

const player = new Graphics().circle(0, 0, playerSize).fill(0xffffff).stroke({
    width: 2,
    color: 0x666666,
});

player.position.set(app.screen.width / 2, app.screen.height / 2);
world.addChild(player);

const pellets = [];
const pelletCount = worldSize / 2;

const pelletSize = 5;

function spawnPellet() {
    const pellet = new Graphics().circle(0, 0, pelletSize).fill(0x666666);

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
    text: `Score: ${score}`,
    style: {
        fontFamily: "Virgil",
        fontSize: 24,
        fill: 0x000000,
        align: "left",
    },
});
scoreLabel.position.set(app.screen.width - 150, 40);

app.stage.addChild(scoreLabel);

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

const speed = 5;

app.ticker.add(() => {
    if (keys.w) player.y -= speed;
    if (keys.a) player.x -= speed;
    if (keys.s) player.y += speed;
    if (keys.d) player.x += speed;

    const radius = 40;
    player.x = Math.max(
        -worldSize + radius,
        Math.min(worldSize - radius, player.x),
    );
    player.y = Math.max(
        -worldSize + radius,
        Math.min(worldSize - radius, player.y),
    );

    world.x = -player.x + app.screen.width / 2;
    world.y = -player.y + app.screen.height / 2;

    for (let i = pellets.length - 1; i >= 0; i--) {
        const pellet = pellets[i];

        const dx = player.x - pellet.x;
        const dy = player.y - pellet.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < playerSize + pelletSize) {
            score += 1;
            scoreLabel.text = `Score: ${score}`;
            console.log("Score: ", score);

            if (score % 10 == 0) {
                console.log("Cards!");
            }

            world.removeChild(pellet);
            pellets.splice(i, 1);
            spawnPellet();
        }
    }
});
