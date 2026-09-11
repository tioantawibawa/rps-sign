.PHONY: help install dev build start lint typecheck test test-integration e2e \
        db-generate db-migrate db-push db-seed db-reset docker-up docker-down docker-logs

help:
	@echo "RPS Sign — perintah yang tersedia:"
	@echo "  make install         Pasang dependency (pnpm)"
	@echo "  make dev             Jalankan dev server"
	@echo "  make build           Build produksi"
	@echo "  make lint            ESLint"
	@echo "  make typecheck       TypeScript --noEmit"
	@echo "  make test            Unit test (Vitest)"
	@echo "  make test-integration Integration test (butuh DB)"
	@echo "  make e2e             Playwright E2E"
	@echo "  make db-push         Sinkron schema ke DB (dev cepat)"
	@echo "  make db-migrate      Buat & terapkan migrasi"
	@echo "  make db-seed         Isi data contoh"
	@echo "  make docker-up       Jalankan seluruh stack via Docker Compose"
	@echo "  make docker-down     Hentikan stack"

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

start:
	pnpm start

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

test-integration:
	RUN_INTEGRATION=1 pnpm test:integration

e2e:
	pnpm test:e2e

db-generate:
	pnpm db:generate

db-migrate:
	pnpm db:migrate

db-push:
	pnpm exec prisma db push

db-seed:
	pnpm db:seed

db-reset:
	pnpm db:reset

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f app
