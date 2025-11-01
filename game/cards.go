package game

import (
	"encoding/json"
	"math/rand"
	"os"
)

type Card struct {
	ID          uint64       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Rarity      string       `json:"rarity"`
	Effects     []CardEffect `json:"effects"`
	Set         string       `json:"set,omitempty"`
}

type CardEffect struct {
	Stat     string  `json:"stat"`
	Modifier float64 `json:"modifier"`

	AuraType     string  `json:"aura_type,omitempty"`
	AuraRadius   float64 `json:"aura_radius,omitempty"`
	AuraStrength float64 `json:"aura_strength,omitempty"`
	AuraTick     float64 `json:"aura_tick,omitempty"`
}

type CardSet struct {
	Name    string
	Parts   []string
	Bonuses map[int][]CardEffect
}

var allCards []Card
var cardSets []CardSet

func init() {
	cardSets = []CardSet{
		{
			Name:  "Berserker Set",
			Parts: []string{"Berserker's Rage I", "Berserker's Rage II", "Berserker's Rage III"},
			Bonuses: map[int][]CardEffect{
				1: {{Stat: "damage", Modifier: 1.1}},
				2: {{Stat: "damage", Modifier: 1.3}, {Stat: "speed", Modifier: 1.1}},
				3: {
					{Stat: "damage", Modifier: 2.0},
					{Stat: "speed", Modifier: 1.5},
					{Stat: "aura_add", AuraType: "damage", AuraRadius: 80, AuraStrength: 10, AuraTick: 1.0},
				},
			},
		},
		{
			Name:  "Guardian Set",
			Parts: []string{"Guardian's Shield I", "Guardian's Shield II", "Guardian's Shield III"},
			Bonuses: map[int][]CardEffect{
				1: {{Stat: "max_health", Modifier: 1.15}},
				2: {{Stat: "max_health", Modifier: 1.4}, {Stat: "size", Modifier: 1.1}},
				3: {
					{Stat: "max_health", Modifier: 2.0},
					{Stat: "max_barrier", Modifier: 50},
					{Stat: "barrier_regen", Modifier: 4},
				},
			},
		},
		{
			Name:  "Toxic Set",
			Parts: []string{"Toxic Touch I", "Toxic Touch II", "Toxic Touch III"},
			Bonuses: map[int][]CardEffect{
				1: {{Stat: "damage", Modifier: 1.05}},
				2: {
					{Stat: "damage", Modifier: 1.15},
					{Stat: "aura_add", AuraType: "poison", AuraRadius: 60, AuraStrength: 3, AuraTick: 1.0},
				},
				3: {
					{Stat: "damage", Modifier: 1.3},
					{Stat: "aura_add", AuraType: "poison", AuraRadius: 100, AuraStrength: 8, AuraTick: 0.5},
				},
			},
		},
		{
			Name:  "Vampire Set",
			Parts: []string{"Blood Hunger I", "Blood Hunger II", "Blood Hunger III"},
			Bonuses: map[int][]CardEffect{
				1: {{Stat: "max_health", Modifier: 1.1}},
				2: {
					{Stat: "max_health", Modifier: 1.2},
					{Stat: "aura_add", AuraType: "lifesteal", AuraRadius: 50, AuraStrength: 2, AuraTick: 1.0},
				},
				3: {
					{Stat: "max_health", Modifier: 1.5},
					{Stat: "aura_add", AuraType: "lifesteal", AuraRadius: 90, AuraStrength: 5, AuraTick: 0.5},
				},
			},
		},
	}
}

func LoadCards(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(data, &allCards); err != nil {
		return err
	}

	return nil
}

func GetRandomCards(count int, appliedCardNames []string) []Card {
	if len(allCards) == 0 {
		return []Card{}
	}

	appliedMap := make(map[string]bool)
	for _, name := range appliedCardNames {
		appliedMap[name] = true
	}

	setProgress := make(map[string]int)
	for _, cardName := range appliedCardNames {
		for _, set := range cardSets {
			for _, part := range set.Parts {
				if cardName == part {
					setProgress[set.Name]++
				}
			}
		}
	}

	rarityWeights := map[string]int{
		"Common":    100,
		"Uncommon":  50,
		"Rare":      20,
		"Epic":      8,
		"Legendary": 3,
	}

	type weightedCard struct {
		card   Card
		weight int
	}

	weightedPool := make([]weightedCard, 0)
	for _, card := range allCards {
		if appliedMap[card.Name] {
			continue
		}

		weight := rarityWeights[card.Rarity]
		if weight == 0 {
			weight = 10
		}

		if card.Set != "" {
			if partsOwned, ok := setProgress[card.Set]; ok {
				weight *= (partsOwned + 1) * 2
			}
		}

		weightedPool = append(weightedPool, weightedCard{card: card, weight: weight})
	}

	if len(weightedPool) < count {
		count = len(weightedPool)
	}

	totalWeight := 0
	for _, wc := range weightedPool {
		totalWeight += wc.weight
	}

	selected := make([]Card, 0, count)
	usedIndices := make(map[int]bool)

	for len(selected) < count && len(usedIndices) < len(weightedPool) {
		roll := rand.Intn(totalWeight)
		currentWeight := 0

		for idx, wc := range weightedPool {
			if usedIndices[idx] {
				continue
			}

			currentWeight += wc.weight
			if roll < currentWeight {
				selected = append(selected, wc.card)
				usedIndices[idx] = true
				totalWeight -= wc.weight
				break
			}
		}
	}

	return selected
}

func GetCardByID(id uint64) *Card {
	for _, card := range allCards {
		if card.ID == id {
			return &card
		}
	}
	return nil
}

func (p *Player) CalculateSetBonuses() {
	p.SetBonuses = make(map[string]int)

	for _, cardName := range p.AppliedCards {
		for _, set := range cardSets {
			for _, part := range set.Parts {
				if cardName == part {
					p.SetBonuses[set.Name]++
				}
			}
		}
	}

	for setName, partsOwned := range p.SetBonuses {
		set := getCardSetByName(setName)
		if set == nil {
			continue
		}

		if bonuses, ok := set.Bonuses[partsOwned]; ok {
			for _, effect := range bonuses {
				p.ApplyCardEffect(effect)
			}
		}
	}
}

func getCardSetByName(name string) *CardSet {
	for i := range cardSets {
		if cardSets[i].Name == name {
			return &cardSets[i]
		}
	}
	return nil
}
