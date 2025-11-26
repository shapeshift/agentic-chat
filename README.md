# AgenticChat

## Getting started

- Run `bun install` to install packages across the monorepo
- Run `cp .env.example .env.local` and populate the required API keys:
  - `ANTHROPIC_API_KEY` - Required for LLM
  - `BEBOP_API_KEY` - Required for swap quotes
  - `COINGECKO_API_KEY` - Required for price data
- Run `bun dev` to run the client and server
- Go to `http://localhost:4200`

## Scripts

- `bun dev` - Run frontend and backend in development mode
- `bun dev:frontend` - Run only the frontend
- `bun dev:backend` - Run only the backend
- `bun build` - Build all packages and apps
- `bun lint` - Run linter
- `bun lint:fix` - Run linter with auto-fix
- `bun type-check` - Run TypeScript type checking
