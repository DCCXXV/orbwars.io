import { Application, Container, Graphics } from "pixi.js";

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

const worldSize = 4000;
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

const player = new Graphics().circle(0, 0, 40).fill(0xffffff).stroke({
    width: 2,
    color: 0x666666,
});

player.position.set(app.screen.width / 2, app.screen.height / 2);
world.addChild(player);

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
});
