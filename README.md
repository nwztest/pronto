# Pronto OSINT Sentiment Monitor

Pronto is a fullstack hackathon prototype for monitoring public sentiment around a company, individual, product, or campaign across modular OSINT sources.

The prototype is dependency-light: it uses a built-in Node HTTP server, a JSON-backed store, and a single-page frontend. RSS is implemented as the real connector. OpenAI and YouTube Data API access come from deployment secrets, and Reddit/X are represented as scalable connector types with mocked/planned collection behavior so the demo shows the intended architecture without extra user setup.

## Run

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Flow

1. Click `Continue as Guest Demo`.
2. Review the dashboard summary, sentiment distribution, themes, risks, and evidence feed.
3. Go to `Sources`, request AI source recommendations, and add a recommended source.
4. Click `Run scan` to fetch RSS items and refresh the analysis.
5. Go to `Reports` and generate a shareable markdown report.

## Architecture

- `server.mjs`: API, JSON store, RSS connector, mock social connectors, analyzer, source recommendations, report generation.
- `public/app.js`: single-page app state, routing, interactions, dashboard, source library, evidence drawer, reports, alerts, settings.
- `public/styles.css`: Stitch-inspired operational UI system with compact nav, dense cards, dark source-management screens, and investigation drawer.
- `data/store.json`: created automatically on first run and ignored by git.

## API

- `GET /api/bootstrap`
- `POST /api/demo/reset`
- `POST /api/monitors`
- `POST /api/sources`
- `POST /api/recommendations`
- `POST /api/scans`
- `POST /api/reports`

## Scalable Upgrade Path

- Replace the JSON store with Postgres or Supabase behind the same store boundary.
- Replace heuristic analysis with OpenAI structured outputs using the current `ItemInsight` and `RunSummary` shapes.
- Add real YouTube, Reddit, and X connectors without changing dashboard rendering because all sources normalize into `CollectedItem`.
- Move scans into a queue/worker if source volume grows.

## Git and Deploy Notes

- Runtime data stays in `data/` and is ignored by git.
- Copy `.env.example` if you want local defaults.
- Set `OPENAI_API_KEY` and `YOUTUBE_DATA_API_KEY` in Vercel environment variables before deploying.
- On Vercel, the runtime store uses writable temp storage, so scans and report saves keep working without writing to the deployed repo tree.
