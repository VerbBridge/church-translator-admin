.PHONY: install dev build test lint type-check docker-build

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

test:
	npm test

lint:
	npm run lint

type-check:
	npx tsc --noEmit

docker-build:
	docker build \
		--build-arg NEXT_PUBLIC_API_URL=$(NEXT_PUBLIC_API_URL) \
		-t church-translator-admin .
