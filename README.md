# Restaurant Decision AI

The AI decision layer for restaurant owners. Ask for a daily summary, find menu profit leaks, and catch inventory risks in seconds. The assistant uses restaurant-scoped tools, never invents business figures, and requires owner approval before operational changes.

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

The repository includes a Render Blueprint that builds the React frontend, serves it from Express, and creates a generated JWT secret. The free demo uses ephemeral SQLite storage, so data can reset when Render restarts the service. Upgrade to a persistent disk or PostgreSQL before storing real restaurant data.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/sami124-coder/AI-restaurant-)

During setup, optionally enter `OPENAI_API_KEY`. Without it, the public demo uses the safe deterministic manager mode.

### Railway alternative

The included `Dockerfile` and `railway.json` also support deployment on Railway:

1. Create a Railway project and choose **Deploy from GitHub repo**.
2. Select `sami124-coder/AI-restaurant-`.
3. Add `JWT_SECRET` and optionally `OPENAI_API_KEY`.
4. Generate a public domain from the service networking settings.

For durable SQLite data, mount a Railway volume at `/data`. Without a volume, the seeded demo still works but changes can reset during redeployment.
