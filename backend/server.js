// The task board's API, and the built frontend for every other path.
//   /api/tasks       list, add, tick and delete tasks (kept in memory)
//   GET /work?ms=200 burns CPU for that long (load for scaling)
//   GET /leak        keeps 16 MB more memory each call (out-of-memory on purpose)
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const PORT = Number(process.env.PORT) || 3000;
const DIST = path.join(import.meta.dirname, '..', 'frontend', 'dist');
const MAX_TASKS = 200;
const MAX_TITLE = 120;
const MAX_WORK_MS = 2000;
const LEAK_CHUNK = 16 * 1024 * 1024;

// in memory: every pod has its own list, and a restart starts it again
let tasks = [
  { id: randomUUID(), title: 'Push the repo to GitHub', done: true, createdAt: new Date().toISOString() },
  { id: randomUUID(), title: 'Let Kairo deploy it', done: false, createdAt: new Date().toISOString() },
  { id: randomUUID(), title: 'Merge the setup PR', done: false, createdAt: new Date().toISOString() },
];
const leaked = [];

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
// which pod answered, shown in the page footer
app.use((_req, res, next) => {
  res.set('x-served-by', os.hostname());
  next();
});

app.get('/api/tasks', (_req, res) => res.json(tasks));

app.post('/api/tasks', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'A task needs a title' });
  if (title.length > MAX_TITLE) return res.status(400).json({ error: `Keep it under ${MAX_TITLE} characters` });
  if (tasks.length >= MAX_TASKS) return res.status(409).json({ error: `The board holds at most ${MAX_TASKS} tasks` });
  const task = { id: randomUUID(), title, done: false, createdAt: new Date().toISOString() };
  tasks.push(task);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'No such task' });
  if (typeof req.body?.done !== 'boolean') return res.status(400).json({ error: '"done" must be true or false' });
  task.done = req.body.done;
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const before = tasks.length;
  tasks = tasks.filter((t) => t.id !== req.params.id);
  if (tasks.length === before) return res.status(404).json({ error: 'No such task' });
  res.status(204).end();
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// Burn CPU in 10 ms slices and let the event loop breathe in between, so the
// health check still gets an answer while /work runs
async function burn(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const slice = Math.min(Date.now() + 10, end);
    while (Date.now() < slice) Math.sqrt(Math.random());
    await new Promise((resolve) => setImmediate(resolve));
  }
}

app.get('/work', async (req, res) => {
  const ms = Math.min(Math.max(Number(req.query.ms) || 200, 1), MAX_WORK_MS);
  const started = Date.now();
  await burn(ms);
  res.json({ worked: ms, tookMs: Date.now() - started });
});

app.get('/leak', (_req, res) => {
  // Buffer.alloc zero-fills, which really touches the pages
  leaked.push(Buffer.alloc(LEAK_CHUNK, 1));
  res.json({ heldMb: (leaked.length * LEAK_CHUNK) / 2 ** 20 });
});

// the built frontend, and index.html for any other GET (also the health check on /)
app.use(express.static(DIST, { index: false }));
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(DIST, 'index.html'), (err) => err && next());
});
app.use((_req, res) => res.status(404).json({ error: 'not found' }));

// 0.0.0.0, not localhost: inside a container localhost isn't reachable from outside
const server = app.listen(PORT, '0.0.0.0', () => console.log(`kairo-demo-tasks listening on :${PORT}`));

// npm start forwards SIGTERM, so pods stop quickly on a rollout
process.on('SIGTERM', () => server.close(() => process.exit(0)));
