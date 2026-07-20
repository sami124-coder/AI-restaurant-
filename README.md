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

Answer-quality controls:

- `OPENAI_MODEL`: choose the current model available to your OpenAI account.
- `OPENAI_REASONING_EFFORT`: defaults to `high` so the real model spends more effort before answering; set to `off` if your chosen model does not support reasoning controls.
- `OPENAI_TEXT_VERBOSITY`: defaults to `high` for fuller ChatGPT-style manager answers; set to `off` if your chosen model does not support verbosity controls.
- `OPENAI_MAX_OUTPUT_TOKENS`: defaults to `1600` so the assistant can give complete manager-style answers.

The backend sends the latest chat history to the model, uses a strong restaurant-manager system prompt, and grounds restaurant numbers through tools instead of guessing.

Important: without `OPENAI_API_KEY`, the public app uses deterministic demo mode. Demo mode is useful for testing product flow and restaurant tools, but it is not a real GPT-level model. To get ChatGPT-like reasoning, add a valid OpenAI API key and set `OPENAI_MODEL` to a reasoning-capable model available in your account.

## Architecture

- `web/`: React + Vite chat workspace and live operations sidebar
- `server/`: Express REST API, JWT authentication, SQLite persistence
- Tool implementations are pure restaurant-scoped functions in `server/src/tools.js`
- Every database query is constrained by the authenticated owner's `restaurant_id`

## MVP planning docs

Before adding the next database or UI feature, start with these docs:

- [`docs/repository-audit.md`](docs/repository-audit.md): current implementation audit and gaps.
- [`docs/mvp-scope.md`](docs/mvp-scope.md): frozen MVP scope for a Yemeni restaurant in China.
- [`docs/acceptance-tests.md`](docs/acceptance-tests.md): task-by-task acceptance tests and readiness format.

The next implementation task is Task 1 only: account registration, organization, restaurant, branches, roles, and user management.

## API

- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:id/messages`
- `POST /api/chat`
- `GET /api/data/status`
- `POST /api/data/import`
- `GET /api/health`

## Real restaurant data imports

Use **Connect real data** inside the app to upload CSV exports. Column names:

| Data type | Required columns | Optional columns |
| --- | --- | --- |
| Orders | `created_at,total_price,cost` | `items` (JSON), or `item_name,quantity` |
| Refunds | `amount,created_at` | `order_id,reason` |
| Menu | `name,price,cost` | `active` |
| Inventory | `item_name,quantity,threshold` | — |
| Staff shifts | `employee_name,role,start_at,end_at,hourly_rate` | — |

Dates should be ISO-compatible, for example `2026-07-04T19:00:00Z`. Menu and inventory imports update matching names; orders, refunds, and shifts append new records.

## Expert answer collection

After each assistant response, the owner can approve it or provide a corrected manager answer. The system stores the original question, tool trace, original response, and approved correction per restaurant.

`GET /api/training/export` returns training-ready JSON:

```json
{
  "question": "هل أحتاج موظفين إضافيين الليلة؟",
  "correct_tools": ["get_daily_sales", "suggest_staffing"],
  "approved_answer": "الطلبات المتوقعة أعلى من المعتاد...",
  "source": "owner_corrected"
}
```

## Evaluation dataset

`server/evals/dataset.js` contains 88 reviewed Arabic and English scenarios covering busy/quiet days, menu profitability, low inventory, missing data, refund anomalies, staffing decisions, broad manager questions, real-data setup questions, general manager advice, knowledge-grounded answers, language capability questions, and actions requiring confirmation.

Run it after every prompt, model, or tool change:

```bash
npm run eval -w server
```

The normal server test command also runs the evaluation suite.

## Book and SOP knowledge base

Use `POST /api/knowledge/import` to add extracted text from restaurant books, SOPs, recipes, or training manuals:

```json
{
  "title": "Service Training Manual",
  "source": "Owner upload",
  "content": "Full extracted book text..."
}
```

The AI can then call `search_knowledge_base(query)` before answering questions about book content. This is retrieval-based grounding, not blind memorization; it keeps answers tied to the uploaded material.

### Training with books and expert conversation examples

The recommended production workflow is:

1. Import private restaurant books, SOPs, recipes, and training manuals into the knowledge base.
2. Import permitted open-source guidance, such as MIT-licensed conversational AI examples, as separate knowledge documents.
3. Ask the owner/manager to approve or correct real assistant answers in the feedback panel.
4. Add the best corrected situations to `server/evals/dataset.js`.
5. Run `npm run eval -w server` after every prompt, tool, or model change.

This trains behavior safely through retrieval, expert feedback, and regression tests. Do not commit copyrighted book text to GitHub; keep extracted files private and import them only into the deployed database you control.

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
3. Add `JWT_SECRET` and optionally `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `OPENAI_TEXT_VERBOSITY`, and `OPENAI_MAX_OUTPUT_TOKENS`.
4. Generate a public domain from the service networking settings.

For durable SQLite data, mount a Railway volume at `/data`. Without a volume, the seeded demo still works but changes can reset during redeployment.
