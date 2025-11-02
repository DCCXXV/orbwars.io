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

	playerSlice []*Player
}

func NewWorld(worldSize float64) *World {
	world := &World{
		Players:     make(map[string]*Player),
		Pellets:     make(map[string]*Pellet),
		WorldSize:   worldSize,
		playerSlice: make([]*Player, 0, 100),
	}

	pelletCount := int(worldSize / 2)
	for i := 0; i < pelletCount; i++ {
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
	w.Mu.RLock()
	player, ok := w.Players[id]
	w.Mu.RUnlock()

	if ok {
		player.SetInput(input)
	}
}

func (w *World) Update(deltaTime float64) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	w.playerSlice = w.playerSlice[:0]
	for _, p := range w.Players {
		if p.IsAlive() {
			p.Update(deltaTime)
			w.clampPlayer(p)
			w.playerSlice = append(w.playerSlice, p)
		}
	}

	for _, player := range w.playerSlice {
		if len(player.Auras) > 0 {
			player.UpdateAuras(deltaTime, w.playerSlice)
		}
	}

	w.checkPvPCollisions()
	w.checkPelletCollisions()
}

func (w *World) checkPelletCollisions() {
	for _, player := range w.playerSlice {
		for pelletID, pellet := range w.Pellets {
			if player.CanEatPellet(pellet) {
				player.Score += pellet.Value
				if player.Health < player.MaxHealth {
					player.Health += pellet.Value
					if player.Health > player.MaxHealth {
						player.Health = player.MaxHealth
					}
				}
				delete(w.Pellets, pelletID)
				w.SpawnPellet()
				break
			}
		}
	}
}

func (w *World) checkPvPCollisions() {
	playerCount := len(w.playerSlice)
	for i := 0; i < playerCount; i++ {
		p1 := w.playerSlice[i]
		if p1.CollisionCooldown > 0 {
			continue
		}

		for j := i + 1; j < playerCount; j++ {
			p2 := w.playerSlice[j]
			if p2.CollisionCooldown > 0 {
				continue
			}

			if p1.IsCollidingWith(p2) {
				p1Died := p1.TakeDamage(p2.Damage)
				p2Died := p2.TakeDamage(p1.Damage)

				p1.CollisionCooldown = 0.5
				p2.CollisionCooldown = 0.5

				if p1Died {
					w.handlePlayerDeath(p1, p2)
				}
				if p2Died {
					w.handlePlayerDeath(p2, p1)
				}
			}
		}
	}
}

func (w *World) handlePlayerDeath(dead *Player, killer *Player) {
	killer.Score += dead.Score
	killer.Speed += killer.Speed / 10
	killer.Damage += killer.Damage / 10
	killer.MaxHealth += killer.MaxHealth / 10
	killer.Health = killer.MaxHealth
	killer.Size += killer.Size / 10

	x := rand.Float64()*w.WorldSize - w.WorldSize/2
	y := rand.Float64()*w.WorldSize - w.WorldSize/2
	dead.Respawn(x, y)
}

func (w *World) clampPlayer(p *Player) {
	radius := float64(p.Size)
	halfWorld := w.WorldSize / 2

	if p.X < -halfWorld+radius {
		p.X = -halfWorld + radius
	} else if p.X > halfWorld-radius {
		p.X = halfWorld - radius
	}

	if p.Y < -halfWorld+radius {
		p.Y = -halfWorld + radius
	} else if p.Y > halfWorld-radius {
		p.Y = halfWorld - radius
	}
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
