# ShapeShift - ElizaOS

Welcome ot the ShapeShift ElizaOS package.

This includes both the ElizaOS UI and REST API.

## Getting started

## Prerequisites

- Ensure you're on the right version of Node with `nvm use` / `fnm use`
- Ensure you have `bun` installed
- `cp .env.example .env` and fill the Venice API key and Postgres connstring

## Running build (prod)

- `bun install` 
- `bun run build`
- `bun start --character shapeshift.json`
- Both the app and server will run on port 3000

## Local dev

- `bun install`
- `bun dev --character shapeshift.json`
- Both the app and server will run on port 3000

## Troubleshooting

### Timeout connecting to the Postgres DB

Supabase (if you're using that as a db) is very sensitive to VPN usage, ensure you're not using one. Residential IPs can also be sad depending on your location, so you may or may not get rekt there. 
Neon (which this project uses both for prod and development DBs) also is sensitive to VPN usage, but is much happier with the aforementionned sad residential IPs, so you should be good there.
