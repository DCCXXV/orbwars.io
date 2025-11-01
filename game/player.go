package game

import "math"

type Player struct {
	ID string

	X         float64
	Y         float64
	VelocityX float64
	VelocityY float64

	Size        float64
	Speed       float64
	TargetSpeed float64
	BaseSpeed   float64
	Health      float64
	MaxHealth   float64
	Damage      float64

	Barrier             float64
	MaxBarrier          float64
	BarrierRegen        float64
	BarrierRegenDelay   float64
	TimeSinceBarrierHit float64

	AbsorptionRange float64

	Score         int
	NextCardScore int
	AppliedCards  []string
	CardsPending  bool

	Input PlayerInput

	CollisionCooldown float64

	Auras         []Aura
	ActiveEffects []ActiveEffect
	SetBonuses    map[string]int

	SlowEffect   float64
	SlowDuration float64
}

type PlayerInput struct {
	W bool
	A bool
	S bool
	D bool
}

type Aura struct {
	Type     string
	Radius   float64
	Strength float64
	TickRate float64
	LastTick float64
}

type ActiveEffect struct {
	Type      string
	Strength  float64
	Duration  float64
	Remaining float64
	TickRate  float64
	LastTick  float64
	SourceID  string
}

func NewPlayer(id string, x, y float64) *Player {
	return &Player{
		ID:                  id,
		X:                   x,
		Y:                   y,
		Size:                40,
		Speed:               5,
		TargetSpeed:         5,
		BaseSpeed:           5,
		Health:              100,
		MaxHealth:           100,
		Damage:              10,
		Barrier:             0,
		MaxBarrier:          0,
		BarrierRegen:        0,
		BarrierRegenDelay:   3.0,
		TimeSinceBarrierHit: 0,
		AbsorptionRange:     1.0,
		Score:               0,
		NextCardScore:       10,
		AppliedCards:        []string{},
		CardsPending:        false,
		CollisionCooldown:   0,
		Auras:               []Aura{},
		ActiveEffects:       []ActiveEffect{},
		SetBonuses:          make(map[string]int),
		SlowEffect:          0,
		SlowDuration:        0,
	}
}

func (p *Player) Update(deltaTime float64) {
	if p.CollisionCooldown > 0 {
		p.CollisionCooldown -= deltaTime
	}

	if p.SlowDuration > 0 {
		p.SlowDuration -= deltaTime
		if p.SlowDuration <= 0 {
			p.SlowEffect = 0
		}
	}

	p.UpdateActiveEffects(deltaTime)

	if p.Barrier < p.MaxBarrier && p.BarrierRegen > 0 {
		p.TimeSinceBarrierHit += deltaTime

		if p.TimeSinceBarrierHit >= p.BarrierRegenDelay {
			p.Barrier += p.BarrierRegen * deltaTime
			if p.Barrier > p.MaxBarrier {
				p.Barrier = p.MaxBarrier
			}
		}
	}

	speedDiff := p.TargetSpeed - p.Speed
	if math.Abs(speedDiff) > 0.1 {
		p.Speed += speedDiff * 0.15
	} else {
		p.Speed = p.TargetSpeed
	}

	targetVelX := 0.0
	targetVelY := 0.0

	effectiveSpeed := p.Speed * (1.0 - p.SlowEffect)

	if p.Input.W {
		targetVelY -= effectiveSpeed
	}
	if p.Input.S {
		targetVelY += effectiveSpeed
	}
	if p.Input.A {
		targetVelX -= effectiveSpeed
	}
	if p.Input.D {
		targetVelX += effectiveSpeed
	}

	accel := 0.2
	if p.Speed > 10 {
		accel = 0.3
	}

	p.VelocityX += (targetVelX - p.VelocityX) * accel
	p.VelocityY += (targetVelY - p.VelocityY) * accel

	if math.Abs(p.VelocityX) < 0.01 {
		p.VelocityX = 0
	}
	if math.Abs(p.VelocityY) < 0.01 {
		p.VelocityY = 0
	}

	p.X += p.VelocityX
	p.Y += p.VelocityY

	p.X = math.Round(p.X*100) / 100
	p.Y = math.Round(p.Y*100) / 100
}

func (p *Player) UpdateAuras(deltaTime float64, nearbyPlayers []*Player) {
	for i := range p.Auras {
		p.Auras[i].LastTick += deltaTime

		if p.Auras[i].LastTick >= p.Auras[i].TickRate {
			p.Auras[i].LastTick = 0

			for _, target := range nearbyPlayers {
				if target.ID == p.ID {
					continue
				}

				dx := p.X - target.X
				dy := p.Y - target.Y
				distance := math.Sqrt(dx*dx + dy*dy)

				if distance <= p.Auras[i].Radius+p.Size {
					p.ApplyAuraEffect(&p.Auras[i], target)
				}
			}
		}
	}
}

func (p *Player) ApplyAuraEffect(aura *Aura, target *Player) {
	switch aura.Type {
	case "damage":
		target.TakeDamage(aura.Strength)
	case "slow":
		if target.SlowEffect < aura.Strength {
			target.SlowEffect = aura.Strength
			target.SlowDuration = aura.TickRate * 2
		}
	case "poison":
		target.AddDoT("poison", aura.Strength, 3.0, p.ID)
	case "lifesteal":
		damageDealt := aura.Strength
		target.TakeDamage(damageDealt)
		p.Health += damageDealt
		if p.Health > p.MaxHealth {
			p.Health = p.MaxHealth
		}
	}
}

func (p *Player) AddDoT(dotType string, strength float64, duration float64, sourceID string) {
	for i := range p.ActiveEffects {
		if p.ActiveEffects[i].Type == dotType && p.ActiveEffects[i].SourceID == sourceID {
			p.ActiveEffects[i].Remaining = duration
			p.ActiveEffects[i].Strength = strength
			return
		}
	}

	p.ActiveEffects = append(p.ActiveEffects, ActiveEffect{
		Type:      dotType,
		Strength:  strength,
		Duration:  duration,
		Remaining: duration,
		TickRate:  1.0,
		LastTick:  0,
		SourceID:  sourceID,
	})
}

func (p *Player) UpdateActiveEffects(deltaTime float64) {
	for i := len(p.ActiveEffects) - 1; i >= 0; i-- {
		effect := &p.ActiveEffects[i]
		effect.Remaining -= deltaTime
		effect.LastTick += deltaTime

		if effect.Remaining <= 0 {
			p.ActiveEffects = append(p.ActiveEffects[:i], p.ActiveEffects[i+1:]...)
			continue
		}

		if effect.LastTick >= effect.TickRate {
			effect.LastTick = 0

			switch effect.Type {
			case "poison":
				p.TakeDamage(effect.Strength)
			case "burn":
				p.TakeDamage(effect.Strength)
			case "regen":
				p.Health += effect.Strength
				if p.Health > p.MaxHealth {
					p.Health = p.MaxHealth
				}
			}
		}
	}
}

func (p *Player) ShouldOfferCards() bool {
	return p.Score >= p.NextCardScore && !p.CardsPending
}

func (p *Player) UpdateNextCardScore() {
	if p.NextCardScore <= 160 {
		p.NextCardScore *= 2
	} else {
		p.NextCardScore += 100
	}
	p.CardsPending = false
}

func (p *Player) SetInput(input PlayerInput) {
	p.Input = input
}

func (p *Player) ApplyCardEffect(effect CardEffect) {
	switch effect.Stat {
	case "speed":
		p.TargetSpeed *= effect.Modifier
		p.TargetSpeed = math.Round(p.TargetSpeed)
	case "size":
		p.Size *= effect.Modifier
	case "damage":
		p.Damage *= effect.Modifier
		p.Damage = math.Round(p.Damage)
	case "max_health":
		p.MaxHealth *= effect.Modifier
		p.MaxHealth = math.Round(p.MaxHealth)
		p.Health = p.MaxHealth
	case "absorbRange":
		p.AbsorptionRange *= effect.Modifier
	case "aura_add":
		p.Auras = append(p.Auras, Aura{
			Type:     effect.AuraType,
			Radius:   effect.AuraRadius,
			Strength: effect.AuraStrength,
			TickRate: effect.AuraTick,
			LastTick: 0,
		})
	case "max_barrier":
		p.MaxBarrier += effect.Modifier
		p.Barrier = p.MaxBarrier
	case "barrier_regen":
		p.BarrierRegen += effect.Modifier
	}
}

func (p *Player) CanEatPellet(pellet *Pellet) bool {
	dx := p.X - pellet.X
	dy := p.Y - pellet.Y
	distance := dx*dx + dy*dy

	captureRange := (p.Size + pellet.Size) * p.AbsorptionRange
	return distance < captureRange*captureRange
}

func (p *Player) IsCollidingWith(other *Player) bool {
	if p.ID == other.ID {
		return false
	}

	dx := p.X - other.X
	dy := p.Y - other.Y
	distance := dx*dx + dy*dy

	minDist := p.Size + other.Size
	return distance <= minDist*minDist
}

func (p *Player) TakeDamage(damage float64) bool {
	if p.Barrier > 0 {
		p.TimeSinceBarrierHit = 0

		if damage <= p.Barrier {
			p.Barrier -= damage
			return false
		} else {
			damage -= p.Barrier
			p.Barrier = 0
			p.BarrierRegenDelay = 5.0
		}
	}

	p.Health -= damage
	if p.Health < 0 {
		p.Health = 0
	}
	return p.Health <= 0
}

func (p *Player) Respawn(x, y float64) {
	p.X = x
	p.Y = y
	p.VelocityX = 0
	p.VelocityY = 0
	p.Health = p.MaxHealth
	p.Score = 0
	p.Size = 40
	p.Speed = 5
	p.TargetSpeed = 5
	p.BaseSpeed = 5
	p.Damage = 10
	p.CollisionCooldown = 0
	p.NextCardScore = 10
	p.CardsPending = false
	p.AppliedCards = []string{}
	p.Auras = []Aura{}
	p.ActiveEffects = []ActiveEffect{}
	p.Barrier = 0
	p.MaxBarrier = 0
	p.BarrierRegen = 0
	p.BarrierRegenDelay = 3.0
	p.TimeSinceBarrierHit = 0
	p.SlowEffect = 0
	p.SlowDuration = 0
	p.SetBonuses = make(map[string]int)
}

func (p *Player) IsAlive() bool {
	return p.Health > 0
}
