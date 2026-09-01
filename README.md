# NØVA Net

A Chrome extension that shows [Leetify](https://leetify.com) CS2 stats directly on Steam profile pages — aim rating, reaction time, preaim, rank per platform, and a few flagged thresholds worth a second look.

![Manifest V3](https://img.shields.io/badge/manifest-v3-blue) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

## What it does

Visit any Steam profile (`steamcommunity.com/profiles/<id>` or `steamcommunity.com/id/<name>`) and NØVA Net injects a stat card pulled live from Leetify's public API — no need to open Leetify or Faceit in another tab.

- **Aim Rating, Reaction Time, Preaim** — with configurable red-flag thresholds for a quick "worth a second look" signal
- **Head Accuracy, Leetify Rating, Win Rate, Spray Accuracy, Matches**
- **Platform ranks** — Premier, Faceit, Competitive, Wingman, each with real rank icons (Faceit + Competitive/Wingman icons are hosted on Leetify's own CDN)
- Works only on the bare profile page — never on `/edit`, `/friends`, `/inventory`, or anywhere else

## Install (unpacked)

This isn't published to the Chrome Web Store — load it manually:

1. Download/clone this repo.
2. Go to `chrome://extensions`.
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and select this folder.
5. (Optional) Click the extension icon and paste a [Leetify API key](https://leetify.com/app/developer) to raise your rate limit — it works fine without one, just with a lower ceiling.

## How it's built

| File | Role |
|---|---|
| `manifest.json` | MV3 config — permissions, matched URLs, icons |
| `background.js` | Service worker. Owns the API key, calls Leetify's `/v3/profile` endpoint, caches responses (5 min TTL), maps the raw response onto the shape the card needs |
| `content.js` | Runs on the profile page. Extracts the steamID64, asks the background worker for stats, builds and injects the card |
| `styles.css` | Card styling — black/gray/gold theme |
| `popup.html` / `popup.js` | Toolbar popup for setting the optional API key |

The content script and background worker are split deliberately: the API key never touches the page context, and all cross-origin fetches happen from the service worker to sidestep CORS/CSP issues on `steamcommunity.com`.

### Where the steamID64 comes from

- `/profiles/<id>` — it's already in the URL.
- `/id/<name>` (vanity URLs) — Steam doesn't put it in the URL, so it's pulled out of `g_rgProfileData` embedded in an inline `<script>` tag on the page.

## Data source & compliance

All stats come from **Leetify's public API** (`api-public.cs-prod.leetify.com`), authenticated or not (unauthenticated requests just get a lower rate limit).

Per [Leetify's developer guidelines](https://leetify.com/blog/leetify-api-developer-guidelines/), this extension:
- Displays a **"View on Leetify"** text link (bold, underlined, Leetify pink) next to the player's name
- Displays the official **"Data Provided by Leetify"** badge, linking to `leetify.com`, in the footer
- Does **not** rename, rescale, or reformat any metric beyond what's confirmed in Leetify's own app (no invented `%`/`°` symbols on fields we haven't confirmed display that way)

## Known limitations

- **No K/D or ADR** — not present anywhere in the public API response, so they're not shown (Spray Accuracy and Match count fill those slots instead).
- **No historical/peak data** — the API only returns *current* values for Premier, Faceit, Competitive, and Wingman. There's no "best" to show, so the Platform section always centers a single current-rank icon rather than splitting into current/best columns (the code supports the split layout, it just has nothing to trigger it with today's API).
- **No Faceit deep link** — the API returns a Faceit *level* but no nickname/ID, so there's nothing to build a real profile URL from.
- **Competitive rank is per-map**, not a single account-wide rank. The card shows your single highest-ranked map, with a hover tooltip breaking down the rest.
- A few field names in `background.js` are marked `TODO: confirm` — anything not explicitly verified against a real API response. If Leetify's schema changes, that's the only file that needs edits.

## Feedback

Something broken or looks wrong? [Message me on Steam](https://steamcommunity.com/profiles/76561199275660273).

## License

MIT — see [LICENSE](LICENSE). Not affiliated with or endorsed by Leetify or Valve; "Leetify" and Steam trademarks belong to their respective owners.
