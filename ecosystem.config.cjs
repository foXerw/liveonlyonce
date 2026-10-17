// pm2 process definition for LiveOnlyOnce.
//
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup   (auto-start on boot)
//
// Fork mode with a single instance is DELIBERATE, not laziness: the content
// listing cache lives in this process only (a globalThis Map with a 15-second
// TTL, see lib/content/cache.ts). In pm2 cluster mode an admin write would
// clear the cache on one worker while the others keep serving stale listings
// for up to 15s. If you truly want multiple instances, you must accept that
// staleness window or add shared cache invalidation (out of scope).
//
// We exec the next binary directly instead of wrapping `npm start` — npm
// spawns a child process that swallows pm2's signals and reloads.
// `next start` reads PORT from the env block below; add `-p <port>` args to
// override it explicitly if you prefer.
module.exports = {
  apps: [
    {
      name: "liveonlyonce",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // Absolute path is recommended — pm2's cwd handling across upgrades
        // is easier to reason about when content does not move with the repo.
        // CONTENT_DIR: "/srv/liveonlyonce/content",
        // Admin passcode. REQUIRED for the /admin UI; without it every
        // admin request is denied and the login API answers 500.
        // ADMIN_KEY: "change-me-to-a-long-random-string",
        // Public origin, used for og:image / metadata absolute URLs.
        // SITE_URL: "https://liveonlyonce.example.com",
      },
    },
  ],
};
