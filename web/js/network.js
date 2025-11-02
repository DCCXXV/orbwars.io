export class NetworkManager {
    constructor(onGameState, onCardOffer) {
        this.ws = null;
        this.connected = false;
        this.onGameState = onGameState;
        this.onCardOffer = onCardOffer;
        this.myPlayerID = null;
    }

    connect() {
        const protocol = location.protocol === "https:" ? "wss" : "ws";

        const host = location.hostname;
        const port =
            location.hostname === "localhost" ||
            location.hostname === "127.0.0.1"
                ? 6767
                : location.port || 443;

        const url = `${protocol}://${host}:${port}/ws`;
        console.log("[WS] Connecting to", url);

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log("connected to server");
            this.connected = true;
        };

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
        };

        this.ws.onerror = (error) => {
            console.error("websocket error", error);
        };

        this.ws.onclose = () => {
            console.log("disconnected from server");
            this.connected = false;
            this.myPlayerID = null;
            setTimeout(() => this.connect(), 3000);
        };
    }

    handleMessage(msg) {
        switch (msg.type) {
            case "welcome":
                this.myPlayerID = msg.data.player_id;
                console.log("my id: ", this.myPlayerID);
                break;

            case "game_state":
                this.onGameState(msg.data);
                break;

            case "card_offer":
                this.onCardOffer(msg.data.cards);
                break;

            default:
                console.log("unkown message:", msg);
        }
    }

    sendInput(keys) {
        if (!this.connected) return;

        this.ws.send(
            JSON.stringify({
                type: "input",
                data: keys,
            }),
        );
    }

    sendCardChoice(cardID) {
        if (!this.connected) return;

        this.ws.send(
            JSON.stringify({
                type: "card_choice",
                data: { card_id: cardID },
            }),
        );
    }
}
