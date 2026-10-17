# LiveOnlyOnce

> Live once. Write it down.

A small, self-hostable website for **life moments** — the things that
happen exactly once and never again. One morning of fog on a commute you'll
never repeat. A last night in a city you moved out of. Every moment is a
dated folder of photos plus a short bilingual caption; the home page lays
them out as a quiet timeline you can scroll back through.

No database, no account system, no build-time content: everything you write
lives as plain files in one folder, and the site reads that folder at
runtime. Clone it, point it at your own content, and you own your moments.

<!-- Screenshot of the home timeline goes here once the design polish lands. -->


## Features

- **File-based content** — a moment is just `<YYYY-MM-DD-slug>/` with images
  and a `moment.yaml`; copy the folder to move your whole life archive.
- **Bilingual (中文/English)** — every caption carries both languages and
  readers toggle instantly; nothing is machine-translated.
- **Passcode admin** — upload, edit and pin moments from `/admin`; the
  passcode is the `ADMIN_KEY` environment variable. No user accounts.
- **On-demand images** — resized/optimized per request via
  [sharp](https://sharp.pixelplumbing.com/) with a disk cache; no CDN or
  pipeline required.
- **Share-ready** — per-page Open Graph / Twitter metadata with the moment's
  poster as `og:image`.

## Quick start

```bash
git clone https://github.com/foXerw/liveonlyonce.git
cd liveonlyonce
npm ci

# create a ./content folder seeded with the bundled examples
npm run init:content

ADMIN_KEY="your-long-random-passcode" npm run dev
```

(Windows PowerShell: `$env:ADMIN_KEY="your-long-random-passcode"; npm run dev`.)

Open <http://localhost:3000>. The admin UI is at `/admin` (it is deliberately
not linked anywhere; know the URL). For a production deployment on a Linux
server — pm2/systemd, nginx, HTTPS, backups — follow
**[docs/DEPLOY.md](docs/DEPLOY.md)**. The admin login has no built-in rate
limiting; rate-limit `/api/admin/login` at your reverse proxy (the nginx
`limit_req` snippet is in docs/DEPLOY.md §6).

## Configuration: environment variables

| Variable     | Required | Default                | What it does                                                                                                                                                            |
| ------------ | -------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTENT_DIR`| no       | `./content` (cwd-based)| Where moments live. An **absolute path** is recommended in production; it must be writable if you use the admin UI.                                                     |
| `ADMIN_KEY`  | yes for admin | *(unset)*         | The admin passcode; also signs admin sessions. Unset → every admin request is denied (`/api/admin/login` answers `500 "ADMIN_KEY not configured"`).                      |
| `SITE_URL`   | no       | *(unset)*              | Public origin (e.g. `https://liveonlyonce.me`). Makes `og:image` and metadata URLs absolute. A malformed value logs a warning and is ignored.                           |
| `NODE_ENV`   | no       | set by the npm scripts | `production` for `next start`; the npm scripts manage it.                                                                                                                |
| `PORT`       | no       | `3000`                 | Port for `next start`.                                                                                                                                                   |

## Adding content — you pick your track

There are two equal, interchangeable ways to publish a moment. They write
exactly the same files, so mixing them is fine.

### Track 1: the admin UI

Sign in at `/admin` with your `ADMIN_KEY` and create a moment with a form:
title, description, location (all in both languages), up to 60 images
(jpg / jpeg / png / webp, ≤25 MB each). The server writes the folder for you
and the timeline updates immediately.

### Track 2: raw folders (for the CLI-inclined)

A moment is one directory inside `CONTENT_DIR`:

```
content/
└── 2026-04-06-city-harvest/
    ├── 01-rooftop.png      # filenames sort alphabetically → display order
    ├── 02-market.jpg       # jpg / jpeg / png / webp are picked up
    └── moment.yaml         # all metadata lives here
```

Complete `moment.yaml` example:

```yaml
date: 2026-04-06 # YYYY-MM-DD; drives timeline order
title:
  zh: 城市收获日
  en: City Harvest Day
description:
  zh: 一张照片也能讲一个下午。
  en: A single photo can carry a whole afternoon.
location: # optional
  zh: 家附近
  en: Close to home
pinned: true # optional, default false — the newest pinned moment is
             # featured above the timeline (and stays in it)
```

Notes: the folder name must match `YYYY-MM-DD-lowercase-slug` (regex
`^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$`); the first image (alphabetically)
becomes the poster and card image; folders that fail validation are skipped
with a server log warning (`[content] skipped folder …`); listings are
cached for 15 seconds, so a freshly copied folder shows up within 15s
without a restart. `npm run init:content` just bootstraps the
[content-example/](content-example) folders into `CONTENT_DIR` — study them
as living templates. Images are served with a **1-year immutable cache**
(`Cache-Control: public, max-age=31536000, immutable`): to replace a photo,
give it a **new filename** — overwriting the bytes under the old name can
keep showing the stale image in browsers/CDNs for up to a year.

## Customization

- **[site.config.yaml](site.config.yaml)** — site name, hero line/note,
  about text, footer text, contact email. Only `heroLine`, `heroNote`,
  `about` and `footer` take `zh`/`en` pairs; `siteName` and `contactEmail`
  are plain strings (a `zh`/`en` map there silently falls back to the
  built-in placeholder). Missing file or fields also fall back to
  placeholders.
- **[app/globals.css](app/globals.css)** — the `@theme` block holds the
  palette (`--color-ink`, `--color-blue-*`, …) and fonts; retoken the site
  there.
- **[messages/zh.json](messages/zh.json) / [messages/en.json](messages/en.json)** —
  UI string catalog (nav, buttons, admin labels).

## Development

```bash
npm run dev     # dev server on :3000 (Turbopack)
npm test        # vitest
npm run lint    # eslint
npm run build   # production build
npm start       # serve the production build
```

Known quirks:

- **Editing `messages/*.json` in dev may not take effect immediately** —
  Turbopack caches imported JSON; restart the dev server if strings look
  stale.
- **Next 16 prints a `middleware` → `proxy` deprecation warning.** Before
  upgrading to Next 17, rename `middleware.ts` to `proxy.ts` (the file must
  export the same handler).

## Backup & restore

Your entire site state is the `CONTENT_DIR` folder — copy it
(`rsync -a`, a zip, whatever) and you have a full backup. The `.cache/media`
directory is a regenerable image cache and is safe to delete; it never needs
backing up.

## License

[MIT](LICENSE)

---

中文文档见 [README.zh.md](README.zh.md)。
