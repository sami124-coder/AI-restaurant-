# AI Restaurant Manager ChatGPT

A conversational restaurant operations dashboard. Owners can ask about sales, profit, menu performance, inventory, staffing, and reports; the assistant uses restaurant-scoped tools and never invents business figures.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with:

- Email: `owner@harbor.test`
- Password: `demo1234`

The app works in deterministic demo mode without an API key. Add `OPENAI_API_KEY` to `.env` for natural-language tool calling through the OpenAI Responses API.

## Architecture

- `web/`: React + Vite chat workspace and live operations sidebar
- `server/`: Express REST API, JWT authentication, SQLite persistence
- Tool implementations are pure restaurant-scoped functions in `server/src/tools.js`
- Every database query is constrained by the authenticated owner's `restaurant_id`

## API

- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:id/messages`
- `POST /api/chat`
- `GET /api/health`

## Production notes

Set a strong `JWT_SECRET`, use TLS, move SQLite to a durable volume (or swap to PostgreSQL), configure `CLIENT_ORIGIN`, and keep the OpenAI key server-side. Demo credentials and seed behavior should be removed before accepting real customers.

## Deploy publicly

The repository includes a Render Blueprint that builds the React frontend, serves it from Express, provisions persistent SQLite storage, and creates a generated JWT secret.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/sami124-coder/AI-restaurant-)

During setup, optionally enter `OPENAI_API_KEY`. Without it, the public demo uses the safe deterministic manager mode.
