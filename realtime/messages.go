package realtime

import (
	"github.com/DCCXXV/orbwars.io/game"
)

type ClientMessage struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type InputMessage struct {
	W bool `json:"w"`
	A bool `json:"a"`
	S bool `json:"s"`
	D bool `json:"d"`
}

type CardChoiceMessage struct {
	CardID uint64 `json:"card_id"`
}

type ServerMessage struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type GameStateMessage struct {
	Players []game.Player `json:"players"`
	Pellets []game.Pellet `json:"pellets"`
}

type AuraDTO struct {
	Type     string  `json:"type"`
	Radius   float64 `json:"radius"`
	Strength int     `json:"strength"`
}

type ActiveEffectDTO struct {
	Type      string  `json:"type"`
	Remaining float64 `json:"remaining"`
}

type PlayerDTO struct {
	ID            string            `json:"id"`
	X             float64           `json:"x"`
	Y             float64           `json:"y"`
	Size          int               `json:"size"`
	Speed         int               `json:"speed"`
	Score         int               `json:"score"`
	Health        int               `json:"health"`
	MaxHealth     int               `json:"max_health"`
	Damage        int               `json:"damage"`
	Barrier       int               `json:"barrier"`
	MaxBarrier    int               `json:"max_barrier"`
	NextCardScore int               `json:"next_card_score"`
	CardsPending  bool              `json:"cards_pending"`
	AppliedCards  []string          `json:"applied_cards"`
	Auras         []AuraDTO         `json:"auras"`
	ActiveEffects []ActiveEffectDTO `json:"active_effects"`
}

type PelletDTO struct {
	ID   string  `json:"id"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Size float64 `json:"size"`
}

type GameStateData struct {
	Players []PlayerDTO `json:"players"`
	Pellets []PelletDTO `json:"pellets"`
}

type CardOfferData struct {
	Cards []game.Card `json:"cards"`
}
