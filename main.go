package main

import (
	"log"
	"net/http"
	"time"

	"github.com/DCCXXV/orbwars.io/game"
	"github.com/DCCXXV/orbwars.io/realtime"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	if err := game.LoadCards("./cards.json"); err != nil {
		log.Fatal("Error when loading cards:", err)
	}
	log.Println("Cards loaded succesfully")

	worldSize := 8000.0
	world := game.NewWorld(worldSize)
	log.Println("World created with", len(world.Pellets), "pellets")

	hub := realtime.NewHub(world)
	go hub.Run()
	log.Println("Websockets hub started")

	go startGameLoop(world)
	log.Println("Gameloop started")

	go startBroadcasting(hub)
	log.Println("Broadcasting started")

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/ws", func(w http.ResponseWriter, req *http.Request) {
		handleWebSocket(hub, w, req)
	})

	r.Handle("/*", http.FileServer(http.Dir("./web")))

	log.Println("Server running on http://localhost:6767")
	if err := http.ListenAndServe(":6767", r); err != nil {
		log.Fatal("Error when starting the server", err)
	}
}

func handleWebSocket(hub *realtime.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error when making upgrade", err)
		return
	}

	clientID := generateClientID()
	client := &realtime.Client{
		ID:   clientID,
		Conn: conn,
		Send: make(chan []byte, 256),
		Hub:  hub,
	}

	hub.Register <- client
	log.Printf("Client connected: %s", clientID)

	go client.WritePump()
	go client.ReadPump()
}

func startGameLoop(world *game.World) {
	ticker := time.NewTicker(16 * time.Millisecond)
	defer ticker.Stop()

	lastTime := time.Now()

	for range ticker.C {
		now := time.Now()
		deltaTime := now.Sub(lastTime).Seconds()
		lastTime = now

		world.Update(deltaTime)
	}
}

func startBroadcasting(hub *realtime.Hub) {
	ticker := time.NewTicker(time.Second / 30)
	defer ticker.Stop()

	for range ticker.C {
		hub.BroadcastGameState()
	}
}

func generateClientID() string {
	return uuid.New().String()
}
