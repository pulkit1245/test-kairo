import { useEffect, useState } from 'react';

// every call goes to /api on the same address the page came from
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const servedBy = res.headers.get('x-served-by');
  if (res.status === 204) return { data: null, servedBy };
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `The API answered ${res.status}`);
  return { data, servedBy };
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [servedBy, setServedBy] = useState('');

  const call = async (path, options) => {
    const result = await api(path, options);
    if (result.servedBy) setServedBy(result.servedBy);
    return result.data;
  };

  useEffect(() => {
    call('/tasks')
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      const task = await call('/tasks', { method: 'POST', body: JSON.stringify({ title }) });
      setTasks((all) => [...all, task]);
      setTitle('');
    });
  };

  const toggle = (task) =>
    run(async () => {
      const updated = await call(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done: !task.done }) });
      setTasks((all) => all.map((t) => (t.id === task.id ? updated : t)));
    });

  const remove = (task) =>
    run(async () => {
      await call(`/tasks/${task.id}`, { method: 'DELETE' });
      setTasks((all) => all.filter((t) => t.id !== task.id));
    });

  const open = tasks.filter((t) => !t.done).length;

  return (
    <main className="board">
      <header>
        <h1>Task board</h1>
        <p className="count">
          {loading ? 'Loading…' : `${open} open · ${tasks.length - open} done`}
        </p>
      </header>

      <form onSubmit={add} className="add">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          maxLength={120}
          aria-label="New task"
        />
        <button type="submit" disabled={!title.trim()}>
          Add
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      <ul className="tasks">
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={task.done} onChange={() => toggle(task)} />
              <span>{task.title}</span>
            </label>
            <button className="delete" onClick={() => remove(task)} aria-label={`Delete ${task.title}`}>
              ×
            </button>
          </li>
        ))}
        {!loading && tasks.length === 0 && <li className="empty">Nothing here. Add a task above.</li>}
      </ul>

      <footer>{servedBy && <>Served by {servedBy}</>}</footer>
    </main>
  );
}
