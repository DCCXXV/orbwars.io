package realtime

import (
	"encoding/json"
	"log"
	"time"

	"github.com/DCCXXV/orbwars.io/game"
)

type Hub struct {
	Clients map[string]*Client

	World *game.World

	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan []byte
}

func NewHub(world *game.World) *Hub {
	return &Hub{
		Clients:    make(map[string]*Client),
		World:      world,
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan []byte, 256),
	}
}

func (h *Hub) Run() {
	cardCheckTicker := time.NewTicker(500 * time.Millisecond)
	defer cardCheckTicker.Stop()

	for {
		select {
		case client := <-h.Register:
			h.Clients[client.ID] = client
			h.World.AddPlayer(client.ID)
			log.Printf("Player joined %s (%d total)", client.ID, len(h.Clients))

			welcomeMsg := ServerMessage{
				Type: "welcome",
				Data: map[string]string{"player_id": client.ID},
			}
			if data, err := json.Marshal(welcomeMsg); err == nil {
				client.Send <- data
			}

		case client := <-h.Unregister:
			if _, ok := h.Clients[client.ID]; ok {
				delete(h.Clients, client.ID)
				close(client.Send)
				h.World.RemovePlayer(client.ID)
				log.Printf("Player disconnected: %s (%d left)", client.ID, len(h.Clients))
			}

		case message := <-h.Broadcast:
			for _, client := range h.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.Clients, client.ID)
				}
			}

		case <-cardCheckTicker.C:
			h.checkCardOffers()
		}
	}
}

func (h *Hub) HandleMessage(client *Client, msg ClientMessage) {
	switch msg.Type {
	case "input":
		data, err := json.Marshal(msg.Data)
		if err != nil {
			return
		}

		var input game.PlayerInput
		if err := json.Unmarshal(data, &input); err != nil {
			log.Println("Error parsing input", err)
			return
		}

		h.World.SetPlayerInput(client.ID, input)

	case "card_choice":
		data, err := json.Marshal(msg.Data)
		if err != nil {
			log.Println("Error parsing card choice:", err)
			return
		}

		var choice CardChoiceMessage
		if err := json.Unmarshal(data, &choice); err != nil {
			log.Println("Error unmarshaling card choice:", err)
			return
		}

		h.HandleCardChoice(client.ID, choice.CardID)
		log.Printf("Card %d selected by: %s", choice.CardID, client.ID)
	}
}

func (h *Hub) HandleCardChoice(playerID string, cardID uint64) {
	h.World.Mu.Lock()
	defer h.World.Mu.Unlock()

	player, ok := h.World.Players[playerID]
	if !ok {
		log.Printf("Player %s not found for card choice", playerID)
		return
	}

	card := game.GetCardByID(cardID)
	if card == nil {
		log.Printf("Card %d not found", cardID)
		return
	}

	for _, effect := range card.Effects {
		player.ApplyCardEffect(effect)
	}

	player.AppliedCards = append(player.AppliedCards, card.Name)
	player.CalculateSetBonuses()
	player.UpdateNextCardScore()

	log.Printf("Player %s applied card '%s', next threshold: %d",
		playerID, card.Name, player.NextCardScore)
}

func (h *Hub) CheckAndOfferCards(playerID string) {
	h.World.Mu.Lock()
	player, ok := h.World.Players[playerID]
	if !ok {
		h.World.Mu.Unlock()
		return
	}

	if !player.ShouldOfferCards() {
		h.World.Mu.Unlock()
		return
	}

	player.CardsPending = true
	appliedCards := make([]string, len(player.AppliedCards))
	copy(appliedCards, player.AppliedCards)
	h.World.Mu.Unlock()

	cards := game.GetRandomCards(3, appliedCards)

	if len(cards) == 0 {
		log.Printf("No cards available for player %s", playerID)
		return
	}

	msg := ServerMessage{
		Type: "card_offer",
		Data: CardOfferData{
			Cards: cards,
		},
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Println("Error marshaling card offer:", err)
		return
	}

	if client, ok := h.Clients[playerID]; ok {
		select {
		case client.Send <- msgBytes:
			log.Printf("Card offer sent to player %s", playerID)
		default:
			log.Printf("Failed to send card offer to player %s", playerID)
		}
	}
}

func (h *Hub) BroadcastGameState() {
	state := h.getGameState()

	msg := ServerMessage{
		Type: "game_state",
		Data: state,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Println("Error serializing state:", err)
		return
	}

	h.Broadcast <- data
}

func (h *Hub) checkCardOffers() {
	h.World.Mu.RLock()
	playersToOffer := make([]string, 0)

	for id, p := range h.World.Players {
		if p.ShouldOfferCards() {
			playersToOffer = append(playersToOffer, id)
		}
	}
	h.World.Mu.RUnlock()

	for _, playerID := range playersToOffer {
		h.CheckAndOfferCards(playerID)
	}
}

func (h *Hub) getGameState() GameStateData {
	h.World.Mu.RLock()
	defer h.World.Mu.RUnlock()

	players := make([]PlayerDTO, 0, len(h.World.Players))
	for _, p := range h.World.Players {
		auraData := make([]AuraDTO, len(p.Auras))
		for i, aura := range p.Auras {
			auraData[i] = AuraDTO{
				Type:     aura.Type,
				Radius:   aura.Radius,
				Strength: aura.Strength,
			}
		}

		effectData := make([]ActiveEffectDTO, len(p.ActiveEffects))
		for i, effect := range p.ActiveEffects {
			effectData[i] = ActiveEffectDTO{
				Type:      effect.Type,
				Remaining: effect.Remaining,
			}
		}

		players = append(players, PlayerDTO{
			ID:            p.ID,
			X:             p.X,
			Y:             p.Y,
			Size:          p.Size,
			Speed:         p.Speed,
			Score:         p.Score,
			Health:        p.Health,
			MaxHealth:     p.MaxHealth,
			Damage:        p.Damage,
			Barrier:       p.Barrier,
			MaxBarrier:    p.MaxBarrier,
			NextCardScore: p.NextCardScore,
			CardsPending:  p.CardsPending,
			AppliedCards:  p.AppliedCards,
			Auras:         auraData,
			ActiveEffects: effectData,
		})
	}

	pellets := make([]PelletDTO, 0, len(h.World.Pellets))
	for _, pel := range h.World.Pellets {
		pellets = append(pellets, PelletDTO{
			ID:   pel.ID,
			X:    pel.X,
			Y:    pel.Y,
			Size: pel.Size,
		})
	}

	return GameStateData{
		Players: players,
		Pellets: pellets,
	}
}
