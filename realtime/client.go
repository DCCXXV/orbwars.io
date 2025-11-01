package realtime

import (
	"encoding/json"

	"github.com/DCCXXV/orbwars.io/game"
	"github.com/gorilla/websocket"
)

type Client struct {
	ID   string
	Conn *websocket.Conn
	Send chan []byte
	Hub  *Hub
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var msg ClientMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "input":
			dataBytes, _ := json.Marshal(msg.Data)
			var input InputMessage
			json.Unmarshal(dataBytes, &input)

			c.Hub.World.SetPlayerInput(c.ID, game.PlayerInput{
				W: input.W,
				A: input.A,
				S: input.S,
				D: input.D,
			})

		case "card_choice":
			dataBytes, _ := json.Marshal(msg.Data)
			var choice CardChoiceMessage
			json.Unmarshal(dataBytes, &choice)
			c.Hub.HandleCardChoice(c.ID, choice.CardID)
		}
	}
}

func (c *Client) WritePump() {
	defer c.Conn.Close()

	for message := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
			break
		}
	}
}
