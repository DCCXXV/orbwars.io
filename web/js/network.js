export class NetworkManager {
    constructor(onGameState, onCardOffer) {
        this.ws = null;
        this.connected = false;
        this.onGameState = onGameState;
        this.onCardOffer = onCardOffer;
        this.myPlayerID = null;
    }

    connect() {
        this.ws = new WebSocket("ws://localhost:6767/ws");

        this.ws.onopen = () => {
            console.log("conected to server");
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
            console.log("disconected from server");
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
