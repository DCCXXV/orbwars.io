package game

import (
	"github.com/google/uuid"
)

type Pellet struct {
	ID    string
	X     float64
	Y     float64
	Size  float64
	Value int
}

func NewPellet(x, y float64) *Pellet {
	return &Pellet{
		ID:    uuid.New().String(),
		X:     x,
		Y:     y,
		Size:  4,
		Value: 1,
	}
}
