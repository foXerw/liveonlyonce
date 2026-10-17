# Deploying LiveOnlyOnce on a Linux server

Everything you need to put the site on a vanilla Ubuntu/Debian box: Node
install, content bootstrap, environment setup, pm2 (or systemd), nginx,
HTTPS, upgrades, backups, and the failure modes worth knowing.

The whole flow, if you just want the shape of it:

```bash
git clone <your-fork> /opt/liveonlyonce && cd /opt/liveonlyonce
npm ci
npm run init:content          # or rsync your real content + set CONTENT_DIR
pm2 start ecosystem.config.cjs
# nginx reverse proxy + certbot, as below
```

## 1. Prerequisites

- Any current Ubuntu/Debian (22.04+ / 12+). A 1 vCPU / 1 GB VPS is plenty —
  the app is a single Node process, and `sharp` does image work on demand.
- **Node.js 20 or newer** (checked by `package.json` engines). Ubuntu's
  distro node is often too old; use NodeSource:

  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs git
  node --version   # v20.x
  ```

  (nvm works too — just make sure the process manager resolves *your* node,
  not the system one.)
- `pm2` for the process-manager path, or plain `systemd` (Section 5b).

  ```bash
  sudo npm install -g pm2
  ```

- A dedicated user keeps permissions sane:

  ```bash
  sudo useradd -m -s /bin/bash liveonlyonce
  ```

## 2. Get the code

```bash
sudo mkdir -p /opt/liveonlyonce
sudo chown liveonlyonce:liveonlyonce /opt/liveonlyonce
sudo -u liveonlyonce git clone https://github.com/foXerw/liveonlyonce.git /opt/liveonlyonce
cd /opt/liveonlyonce
sudo -u liveonlyonce npm ci
```

`npm ci` installs exactly what `package-lock.json` pins. The repo ships an
`.npmrc` that pins the registry to `registry.npmjs.org` — leave it in place,
or registry mirrors that rewrite tarball URLs can churn the lockfile.

## 3. Content directory

The app reads moments from `$CONTENT_DIR` at runtime (default: `./content`
relative to the working directory — for pm2/systemd, **set it explicitly**).

Create the directory and hand it to the app user **first**, whichever path
you take below — the admin UI writes uploads/edits there, and seeding into
a root-owned (or missing-parent) path fails with `EACCES`:

```bash
sudo mkdir -p /srv/liveonlyonce-content
sudo chown -R liveonlyonce:liveonlyonce /srv/liveonlyonce-content
```

Then either seed the bundled examples (copies `content-example/` in, only
if the directory is empty):

```bash
sudo -u liveonlyonce CONTENT_DIR=/srv/liveonlyonce-content npm run init:content
```

or skip the examples and copy your own archive in (a moment is just a
`<YYYY-MM-DD-slug>/` folder — see the README).

## 4. Environment

| Variable      | Production value                                   |
| ------------- | -------------------------------------------------- |
| `NODE_ENV`    | `production` (both runners below set it)           |
| `PORT`        | `3000` (any free port; nginx fronts it)            |
| `CONTENT_DIR` | absolute path, e.g. `/srv/liveonlyonce-content`    |
| `ADMIN_KEY`   | your admin passcode — **required for `/admin`**    |
| `SITE_URL`    | public origin, e.g. `https://liveonlyonce.example` |

Generate a passcode you don't have to remember:

```bash
openssl rand -hex 24
```

Two ways to feed the env, matching the two runners:

**pm2** — edit the `env` block in `ecosystem.config.cjs` (Section 5a).

**systemd** — a root-owned env file the unit reads:

```bash
sudo mkdir -p /etc/liveonlyonce
sudo tee /etc/liveonlyonce/liveonlyonce.env > /dev/null <<'EOF'
NODE_ENV=production
PORT=3000
CONTENT_DIR=/srv/liveonlyonce-content
ADMIN_KEY=replace-with-your-passcode
SITE_URL=https://liveonlyonce.example.com
EOF
sudo chmod 600 /etc/liveonlyonce/liveonlyonce.env
sudo chown root:liveonlyonce /etc/liveonlyonce/liveonlyonce.env
```

`ADMIN_KEY` is the only secret. Anyone who can read the process env or the
env file can sign into the admin — keep the file mode tight and the server
behind HTTPS.

## 5a. Run it with pm2

`ecosystem.config.cjs` in the repo root is ready to go:

```bash
pm2 start ecosystem.config.cjs
pm2 logs liveonlyonce        # sanity-check startup
pm2 save                     # remember this app list
pm2 startup                  # print/enable a boot hook (run what it prints)
```

**Why `exec_mode: fork` / `instances: 1`?** The content listing cache is a
per-process in-memory map with a 15-second TTL (`lib/content/cache.ts`);
`clearContentCache()` on an admin write only reaches the process that ran
the write. In cluster mode, worker B would keep serving stale listings for
up to 15s right after you publish a moment. A single fork-mode process
sidesteps the whole class of problem. If you genuinely need multiple
instances behind a load balancer, either accept the ≤15s staleness window
or add shared cache invalidation (Redis pub/sub, filesystem watch, …) —
that is currently out of scope for this app by design.

Env edits in the file only land after a restart that re-reads them:

```bash
pm2 restart liveonlyonce --update-env
```

## 5b. Run it with systemd instead

Unit file — `/etc/systemd/system/liveonlyonce.service`:

```ini
[Unit]
Description=LiveOnlyOnce
After=network.target

[Service]
Type=simple
User=liveonlyonce
WorkingDirectory=/opt/liveonlyonce
EnvironmentFile=/etc/liveonlyonce/liveonlyonce.env
ExecStart=/usr/bin/node /opt/liveonlyonce/node_modules/next/dist/bin/next start
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now liveonlyonce
systemctl status liveonlyonce
journalctl -u liveonlyonce -f
```

(One process, same rationale as the fork-mode note above. The single-node
self-hosted story is the supported one.)

## 6. nginx reverse proxy

`/etc/nginx/sites-available/liveonlyonce`:

```nginx
server {
    listen 80;
    server_name liveonlyonce.example.com;

    # Cap admin uploads here. The application itself would accept up to
    # 60 images x 25 MB (~1.5 GB) in one request; letting nginx forward
    # that is pointless. 200m covers a realistic burst (8 x 25 MB photos)
    # while rejecting abusive bodies early with a cheap 413 instead of
    # making Node buffer them. Lower it further if your uploads are
    # phone-sized; raise it only if you actually post mega-albums.
    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/liveonlyonce /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Static assets need no special care: `/_next/static/*` is already fingerprinted
and `Cache-Control: immutable`, and resized images under `/api/asset/*` are
served with `Cache-Control: public, max-age=31536000, immutable`, so browsers
(and a CDN, if you add one later) cache them aggressively on their own.
Set `SITE_URL` to the public origin (`http://liveonlyonce.example.com` at
this stage) and restart the app.

## 7. HTTPS with certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d liveonlyonce.example.com
sudo certbot renew --dry-run
```

Then flip `SITE_URL` to `https://…` in your env source and restart
(`pm2 restart liveonlyonce --update-env` / `systemctl restart liveonlyonce`)
so shared-link previews use absolute https `og:image` URLs.

## 8. Upgrading

```bash
cd /opt/liveonlyonce
sudo -u liveonlyonce git pull
sudo -u liveonlyonce npm ci
sudo -u liveonlyonce npm run build
pm2 restart liveonlyonce      # or: sudo systemctl restart liveonlyonce
```

Content is untouched by upgrades: it lives in `CONTENT_DIR`, outside the
repo checkout (that is the point of the default `./content` being
gitignored).

## 9. Backup

- **What matters:** the `CONTENT_DIR` folder. That is the whole site state —
  copy it anywhere (`rsync -a /srv/liveonlyonce-content/ backup-host:/backups/content/`),
  or zip it, or keep it in a private git repo. Moment edits and admin
  uploads all land there.
- **What doesn't:** `.cache/media` under the repo is a regenerable image
  cache (`rm -rf .cache/media` is safe; images re-render on next request).
  No database exists to dump.

## 10. Troubleshooting

| Symptom                                                            | Cause / fix |
| ------------------------------------------------------------------ | ----------- |
| `/admin` login always fails, or `POST /api/admin/login` returns `500 {"error":"ADMIN_KEY not configured"}` | `ADMIN_KEY` never reached the process. Check `pm2 env <id>` / `systemctl show liveonlyonce -p Environment`; fix the env source and restart (`--update-env` for pm2). |
| Sharing a link shows no (or a `localhost`) preview image            | `SITE_URL` unset or malformed — look for `[seo] SITE_URL "…" is not an absolute URL; ignoring it` in logs. It must be a full origin including scheme. |
| Edited a content folder but the homepage is unchanged                | Listings cache for 15s; wait or restart. If it never appears, the folder name must match `YYYY-MM-DD-slug` (lowercase, digits) — look for `[content] skipped folder …` warnings in `pm2 logs` / `journalctl`. |
| Admin upload fails with HTTP 413                                    | nginx refused the body before the app saw it — raise `client_max_body_size` toward your needs (Section 6). HTTP 400 instead means the app's own limits (≤60 images, ≤25 MB each, jpg/jpeg/png/webp). |
| Dev: changing `messages/*.json` does nothing                        | Turbopack caches imported JSON — restart the dev server. |
| Planning a Next 17 upgrade                                          | Rename `middleware.ts` → `proxy.ts` (same exports); Next 16 logs this deprecation on startup. |
| Port 3000 already in use                                            | Change `PORT` in the env source and restart. |
| EACCES writing uploads                                              | The app user can't write `CONTENT_DIR` — `chown -R liveonlyonce:liveonlyonce $CONTENT_DIR`. |
