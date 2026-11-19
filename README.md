# kairo-demo-tasks

A small task board: add, tick and delete tasks. React + Vite frontend, Express API, served from one Node process on `$PORT` (default 3000).

| Path | What it does |
| --- | --- |
| `/` and other pages | The built frontend (`frontend/dist`) |
| `GET /api/tasks` | The tasks, as JSON |
| `POST /api/tasks` | Adds one: `{ "title": "…" }` |
| `PATCH /api/tasks/:id` | Ticks or unticks one: `{ "done": true }` |
| `DELETE /api/tasks/:id` | Deletes one |
| `GET /work?ms=200` | Burns CPU for that long (max 2000), to load the app |
| `GET /leak` | Keeps another 16 MB each call, to run it out of memory |

Tasks live in memory: each running copy has its own list, and a restart starts it again.

```bash
npm run build   # installs and builds frontend/, installs backend/
npm start       # http://localhost:3000
```

For frontend work, run `node backend/server.js` and `npm --prefix frontend run dev` side by side; Vite sends `/api` to port 3000.
