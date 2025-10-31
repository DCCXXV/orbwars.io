package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)

	r.Handle("/*", http.FileServer(http.Dir("./web")))

	log.Println("Server started")
	http.ListenAndServe(":6767", r)
}
