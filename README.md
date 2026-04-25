# fodder

A melancholy Foddian climbing game. Web-delivered, with a memory layer that
remembers all climbers across all sessions.

## Structure

```
fodder/
  client/   — TypeScript + PixiJS + Matter.js, bundled with Vite
  server/   — Python + FastAPI + SQLite, records the tower's memory
  deploy/   — example nginx + systemd for production
```

## Local dev

Two terminals.

**Client:**
```
cd client
npm install
npm run dev
```
Opens on http://localhost:5173

**Server:**
```
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

The client's Vite config proxies `/api/*` to `localhost:8000`, so the client
talks to the backend transparently in dev.

## Deployment

Example **nginx** and **systemd** units live in [`deploy/`](deploy/); the steps there assume:

- The built client (`npm run build` in `client/`) is served from `/var/www/fodder/`
- The FastAPI app listens on `127.0.0.1:8000` behind nginx
- SQLite is at `/var/lib/fodder/tower.db` (see `FODDER_DB` in the unit file)

On a small instance (e.g. AWS t3.micro), the same layout applies.

## Design notes

See `DESIGN.md` for the full design doc and the rules we've locked in.

The short version: this is a Foddian climbing game, but melancholy rather
than comedic. The tower remembers every climber. The trolling is rare,
patient, and cumulative. There is no ending.
