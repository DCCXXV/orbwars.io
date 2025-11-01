package game

import (
	"math/rand"
	"sync"
	"time"
)

type World struct {
	Players   map[string]*Player
	Pellets   map[string]*Pellet
	WorldSize float64
	Mu        sync.RWMutex
}

func NewWorld(worldSize float64) *World {
	world := &World{
		Players:   make(map[string]*Player),
		Pellets:   make(map[string]*Pellet),
		WorldSize: worldSize,
	}

	for range int(worldSize / 2) {
		world.SpawnPellet()
	}

	return world
}

func (w *World) AddPlayer(id string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	x := rand.Float64()*w.WorldSize - w.WorldSize/2
	y := rand.Float64()*w.WorldSize - w.WorldSize/2

	w.Players[id] = NewPlayer(id, x, y)
}

func (w *World) RemovePlayer(id string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	delete(w.Players, id)
}

func (w *World) SetPlayerInput(id string, input PlayerInput) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	if player, ok := w.Players[id]; ok {
		player.SetInput(input)
	}
}

func (w *World) Update(deltaTime float64) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	for _, player := range w.Players {
		if player.IsAlive() {
			player.Update(deltaTime)
			w.clampPlayer(player)
		}
	}

	alivePlayers := make([]*Player, 0, len(w.Players))
	for _, p := range w.Players {
		if p.IsAlive() {
			alivePlayers = append(alivePlayers, p)
		}
	}

	for _, player := range alivePlayers {
		player.UpdateAuras(deltaTime, alivePlayers)
	}

	w.checkPvPCollisions()

	for _, player := range w.Players {
		if !player.IsAlive() {
			continue
		}

		for pelletID, pellet := range w.Pellets {
			if player.CanEatPellet(pellet) {
				player.Score += pellet.Value
				if player.Health < player.MaxHealth {
					player.Health += float64(pellet.Value)
				}
				delete(w.Pellets, pelletID)
				w.SpawnPellet()
			}
		}
	}
}

func (w *World) checkPvPCollisions() {
	players := make([]*Player, 0, len(w.Players))
	for _, p := range w.Players {
		if p.IsAlive() {
			players = append(players, p)
		}
	}

	for i := 0; i < len(players); i++ {
		for j := i + 1; j < len(players); j++ {
			p1 := players[i]
			p2 := players[j]

			if p1.IsCollidingWith(p2) && p1.CollisionCooldown <= 0 && p2.CollisionCooldown <= 0 {
				p1Died := p1.TakeDamage(p2.Damage)
				p2Died := p2.TakeDamage(p1.Damage)

				p1.CollisionCooldown = 0.5
				p2.CollisionCooldown = 0.5

				if p1Died {
					p2.Score += p1.Score
					p2.Speed += p2.Speed * 0.1
					p2.Damage += p2.Damage * 0.1
					p2.MaxHealth += p2.MaxHealth * 0.1
					p2.Health = p2.MaxHealth
					p2.Size += p2.Size * 0.1

					x := rand.Float64()*w.WorldSize - w.WorldSize/2
					y := rand.Float64()*w.WorldSize - w.WorldSize/2
					p1.Respawn(x, y)
				}
				if p2Died {
					p1.Score += p2.Score
					p1.Speed += p1.Speed * 0.1
					p1.Damage += p1.Damage * 0.1
					p1.MaxHealth += p1.MaxHealth * 0.1
					p1.Health = p1.MaxHealth
					p1.Size += p1.Size * 0.1

					x := rand.Float64()*w.WorldSize - w.WorldSize/2
					y := rand.Float64()*w.WorldSize - w.WorldSize/2
					p2.Respawn(x, y)
				}
			}
		}
	}
}

func (w *World) clampPlayer(p *Player) {
	radius := p.Size
	p.X = max(-w.WorldSize/2+radius, min(w.WorldSize/2-radius, p.X))
	p.Y = max(-w.WorldSize/2+radius, min(w.WorldSize/2-radius, p.Y))
}

func (w *World) SpawnPellet() {
	x := rand.Float64()*w.WorldSize - w.WorldSize/2
	y := rand.Float64()*w.WorldSize - w.WorldSize/2

	pellet := NewPellet(x, y)
	w.Pellets[pellet.ID] = pellet
}

func (w *World) Run(tickRate time.Duration) {
	ticker := time.NewTicker(tickRate)
	defer ticker.Stop()

	lastTime := time.Now()

	for range ticker.C {
		now := time.Now()
		deltaTime := now.Sub(lastTime).Seconds()
		lastTime = now

		w.Update(deltaTime)
	}
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
