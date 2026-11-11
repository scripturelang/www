.DEFAULT_GOAL := serve

PORT ?= 8080

.PHONY: setup serve pretty

setup:
	cargo install --locked miniserve

serve:
	@command -v miniserve >/dev/null 2>&1 || { echo "miniserve is missing. Run 'make setup' first."; exit 1; }
	miniserve web --index index.html --interfaces 127.0.0.1 --port $(PORT)

pretty:
	npx --yes prettier@3.6.2 --write 'web/*.{html,css,js}' 'scripts/*.mjs'
