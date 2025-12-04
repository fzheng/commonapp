.PHONY: up down build rebuild logs clean reset help

# Default target
help:
	@echo "College App Manager - Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  up        Start all containers"
	@echo "  down      Stop all containers"
	@echo "  build     Build all containers"
	@echo "  rebuild   Rebuild and start all containers"
	@echo "  logs      View container logs (follow mode)"
	@echo "  clean     Stop containers and remove volumes"
	@echo "  reset     Clean everything and rebuild"
	@echo ""
	@echo "Individual services:"
	@echo "  up-db     Start database only"
	@echo "  up-backend Start backend only"
	@echo "  up-frontend Start frontend only"
	@echo "  logs-backend View backend logs"
	@echo "  logs-frontend View frontend logs"
	@echo "  logs-crawler View crawler logs"

# Main targets
up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

rebuild:
	docker-compose up --build -d

logs:
	docker-compose logs -f

clean:
	docker-compose down -v

reset: clean rebuild

# Individual services
up-db:
	docker-compose up -d db

up-backend:
	docker-compose up -d backend

up-frontend:
	docker-compose up -d frontend

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-crawler:
	docker-compose logs -f crawler

# Database utilities
db-shell:
	docker-compose exec db psql -U commonapp -d commonapp

db-backup:
	docker-compose exec db pg_dump -U commonapp commonapp > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Status
status:
	docker-compose ps
