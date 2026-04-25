# Production deployment (reference)

Assumes a Linux host with nginx and systemd. Paths match [README.md](../README.md): app under `/opt/fodder`, static files under `/var/www/fodder`, SQLite at `/var/lib/fodder/tower.db`.

## 1. System user and directories

```bash
sudo useradd --system --home /opt/fodder --shell /usr/sbin/nologin fodder
sudo mkdir -p /opt/fodder /var/lib/fodder /var/www/fodder
sudo chown -R fodder:fodder /opt/fodder /var/lib/fodder
```

## 2. Server (FastAPI + venv)

Copy the `server/` tree to `/opt/fodder/server` (without committing `.venv` to production; build on the host), then:

```bash
cd /opt/fodder/server
sudo -u fodder python3 -m venv .venv
sudo -u fodder .venv/bin/pip install -r requirements.txt
```

`FODDER_DB` defaults to `tower.db` in the working directory; the systemd unit sets it to `/var/lib/fodder/tower.db`.

## 3. Client build

On a build machine or the server:

```bash
cd client
npm ci
npm run build
```

Copy `client/dist/*` to `/var/www/fodder/` and ensure nginx can read them (e.g. `chown -R root:root /var/www/fodder` and world-readable files).

**Note:** The built app calls `/api/...` on the same origin, so the browser must load the page from the host that nginx serves; no Vite dev proxy in production.

## 4. systemd

```bash
sudo cp deploy/fodder-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fodder-api
```

## 5. nginx

```bash
sudo cp deploy/nginx-fodder.conf /etc/nginx/sites-available/fodder
# Edit server_name and TLS, then:
sudo ln -s /etc/nginx/sites-available/fodder /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Check

- `curl -sS http://127.0.0.1:8000/api/health` should return `{"ok":true}`.
- `POST /api/clear_marks` with JSON `{"wall":"proto-wall-01"}` removes all fall marks for that wall (used when a player returns to the ledge in-game).
- In a browser, open the site; faint fall marks and fall recording use `/api/marks` and `/api/fall` through nginx.
