// content.js — runs on steamcommunity.com/profiles/<id> AND
// steamcommunity.com/id/<name> — Steam automatically redirects
// /profiles/<id> to /id/<name> for any account with a custom URL set, so
// both need to work. Either way, only the bare profile root page — not
// /edit, /friends, /inventory, or any other subpath.

function isProfileRootPage() {
  return /^\/(profiles\/\d{17}|id\/[^/]+)\/?$/.test(window.location.pathname);
}

function extractSteamId64() {
  // Case 1: numeric /profiles/<id> URL — id is right there.
  const profileMatch = window.location.pathname.match(/\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  // Case 2: vanity /id/<name> URL — Steam doesn't put the steamID64
  // anywhere in the URL for these, but it's embedded in an inline
  // <script> tag as part of `g_rgProfileData`. Content scripts can't
  // read page-JS globals directly (isolated world), so grep the raw
  // script text instead of injecting a page-context script.
  const scripts = Array.from(document.querySelectorAll("script"));
  for (const script of scripts) {
    const text = script.textContent || "";
    const match = text.match(/"steamid":\s*"(\d{17})"/);
    if (match) return match[1];
  }

  return null;
}

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text) node.textContent = opts.text;
  if (opts.href) node.href = opts.href;
  if (opts.title) node.title = opts.title;
  if (opts.src) node.src = opts.src;
  if (opts.alt) node.alt = opts.alt;
  for (const child of children) node.appendChild(child);
  return node;
}

// ---------------------------------------------------------------------
// Required by Leetify's developer guidelines: a "View on Leetify" text
// link, legible and identifiable as a link via bold weight, underline,
// or their pink (#F84982) — using all three here. Placed in the same row
// as the player's name.
// ---------------------------------------------------------------------

const CONTACT_URL = "https://steamcommunity.com/profiles/76561199275660273";

function buildViewOnLeetifyLink(steamId64) {
  const link = el("a", {
    className: "nova-view-on-leetify",
    text: "View on Leetify",
    href: steamId64 ? `https://leetify.com/app/profile/${steamId64}` : "https://leetify.com"
  });
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

// Bottom footer: "Data Provided by Leetify" logo (bottom-right, links to
// leetify.com per guideline 3.2) and the contact/feedback link
// (bottom-left).
function buildFooterRow() {
  const contactLink = el("a", {
    className: "leetify-card__feedback-link",
    text: "Feedback on this extension? Contact me",
    href: CONTACT_URL
  });
  contactLink.target = "_blank";
  contactLink.rel = "noopener noreferrer";

  const badgeUrl = chrome.runtime.getURL("icons/leetify-badge.png");
  const badgeLink = el("a", { className: "nova-leetify-badge", href: "https://leetify.com/" });
  badgeLink.target = "_blank";
  badgeLink.rel = "noopener noreferrer";
  badgeLink.appendChild(el("img", { src: badgeUrl, alt: "Data provided by Leetify" }));

  return el("div", { className: "nova-footer" }, [contactLink, badgeLink]);
}

// ---------------------------------------------------------------------
// Real rank icons, hosted on Leetify's own CDN (confirmed working URLs):
//   Competitive/Wingman: https://leetify.com/assets/images/rank-icons/matchmaking{0-18}.png
//   Faceit:               https://leetify.com/assets/images/rank-icons/faceit{0-10}.svg
// 0 means "no rank" for both. Falls back to a plain colored badge if an
// image ever 404s (CDN paths can move).
// ---------------------------------------------------------------------

function matchmakingIconUrl(tier) {
  const clamped = Math.max(0, Math.min(18, tier));
  return `https://leetify.com/assets/images/rank-icons/matchmaking${clamped}.png`;
}

function faceitIconUrl(level) {
  const clamped = Math.max(0, Math.min(10, level));
  return `https://leetify.com/assets/images/rank-icons/faceit${clamped}.svg`;
}

const RANK_NAMES = [
  "No Rank", "Silver I", "Silver II", "Silver III", "Silver IV", "Silver Elite", "Silver Elite Master",
  "Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master",
  "Master Guardian I", "Master Guardian II", "Master Guardian Elite", "Distinguished Master Guardian",
  "Legendary Eagle", "Legendary Eagle Master", "Supreme Master First Class", "The Global Elite"
];

function buildMatchmakingIcon(tier) {
  if (tier === null || tier === undefined) return null;
  const img = el("img", { className: "nova-rank-icon" });
  img.src = matchmakingIconUrl(tier);
  img.alt = RANK_NAMES[tier] || `Rank ${tier}`;
  img.title = RANK_NAMES[tier] || `Rank ${tier}`;
  img.onerror = () => {
    const fallback = el("span", { className: "nova-rank-fallback", text: tier === 0 ? "—" : String(tier) });
    img.replaceWith(fallback);
  };
  return img;
}

function buildFaceitRealIcon(level) {
  if (level === null || level === undefined) return null;
  const img = el("img", { className: "nova-rank-icon" });
  img.src = faceitIconUrl(level);
  img.alt = level === 0 ? "No Faceit rank" : `Faceit level ${level}`;
  img.title = level === 0 ? "No Faceit rank" : `Faceit level ${level}`;
  img.onerror = () => {
    const fallback = el("span", { className: "nova-rank-fallback", text: level === 0 ? "—" : String(level) });
    img.replaceWith(fallback);
  };
  return img;
}

// Premier has no hosted icon asset — this is an original small
// diagonal-stripe bar (not a copy of Valve's actual icon), color-banded
// to Premier's real rating tiers.
const PREMIER_BANDS = [
  { min: 30000, color: "#F0C93D" },
  { min: 25000, color: "#E0483B" },
  { min: 20000, color: "#D6389E" },
  { min: 15000, color: "#A23FD1" },
  { min: 10000, color: "#3E6FE0" },
  { min: 5000, color: "#2E9E9E" },
  { min: 0, color: "#9AA3AD" }
];

function premierColor(rating) {
  return (PREMIER_BANDS.find((band) => rating >= band.min) || PREMIER_BANDS[PREMIER_BANDS.length - 1]).color;
}

function buildPremierIcon(rating) {
  const color = premierColor(rating);
  const iconWrapper = el("span", { className: "nova-premier-icon" });
  iconWrapper.innerHTML = `<svg width="18" height="14" viewBox="0 0 18 14" xmlns="http://www.w3.org/2000/svg">
    <line x1="4" y1="14" x2="8" y2="0" stroke="${color}" stroke-width="3"/>
    <line x1="11" y1="14" x2="15" y2="0" stroke="${color}" stroke-width="3"/>
  </svg>`;
  const valueSpan = el("span", { className: "nova-premier-value", text: rating.toLocaleString() });
  valueSpan.style.color = color;
  return el("span", { className: "nova-premier-group", title: `Premier rating ${rating}` }, [
    iconWrapper,
    valueSpan
  ]);
}

// ---------------------------------------------------------------------
// Platform row layout: center a single icon when current/best are equal
// (or only one is known), split into two columns when they genuinely
// differ. Also implements: if current is missing but a best value IS
// known, show "no rank" for current and the real best icon for best —
// rather than just leaving current blank.
//
// NOTE: the public Leetify API this extension uses doesn't expose a
// peak/historical "best" for ANY platform (confirmed against a real
// response) — only current values. So today, every row will always
// render centered (or empty), never split. This logic is still written
// generically so it starts working correctly the moment/if a future API
// response ever includes real peak data.
// ---------------------------------------------------------------------

function buildPlatformRow(label, current, best, iconBuilder, extraNode) {
  const hasCurrent = current !== undefined && current !== null;
  const hasBest = best !== undefined && best !== null;

  let body;
  if (!hasCurrent && !hasBest) {
    body = el("div", { className: "nova-platform-row__body nova-platform-row__body--empty" }, [
      el("span", { className: "nova-rank-fallback", text: "N/A" })
    ]);
  } else if (hasCurrent && hasBest && current !== best) {
    body = el("div", { className: "nova-platform-row__body nova-platform-row__body--split" }, [
      el("div", { className: "nova-platform-col" }, [iconBuilder(current)]),
      el("div", { className: "nova-platform-col" }, [iconBuilder(best)])
    ]);
  } else if (!hasCurrent && hasBest) {
    // Current expired/unavailable, but a best is known: show "no rank"
    // for current and the real best icon, side by side.
    body = el("div", { className: "nova-platform-row__body nova-platform-row__body--split" }, [
      el("div", { className: "nova-platform-col" }, [iconBuilder(0)]),
      el("div", { className: "nova-platform-col" }, [iconBuilder(best)])
    ]);
  } else {
    const value = hasCurrent ? current : best;
    const centerChildren = [iconBuilder(value)];
    if (extraNode) centerChildren.push(extraNode);
    body = el("div", { className: "nova-platform-row__body nova-platform-row__body--center" }, centerChildren);
  }

  return el("div", { className: "nova-platform-row" }, [
    el("span", { className: "nova-platform-row__label", text: label }),
    body
  ]);
}

function shortMapName(mapName) {
  if (!mapName) return "";
  const stripped = mapName.replace(/^(de_|cs_)/, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function buildPlatformSection(data) {
  const breakdown = (data.competitiveBreakdown || [])
    .filter((m) => m.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .map((m) => `${shortMapName(m.map_name)}: ${RANK_NAMES[m.rank] || m.rank}`)
    .join("\n");

  const competitiveIconBuilder = (tier) => {
    const icon = buildMatchmakingIcon(tier);
    if (icon && breakdown) icon.title = `${icon.title}\n\n${breakdown}`;
    return icon;
  };

  const rows = [
    buildPlatformRow("Premier", data.premierCurrent, data.premierBest, buildPremierIcon),
    buildPlatformRow("FACEIT", data.faceitLevel, null, buildFaceitRealIcon),
    buildPlatformRow("Competitive", data.competitiveCurrent, null, competitiveIconBuilder),
    buildPlatformRow("Wingman", data.wingmanCurrent, null, buildMatchmakingIcon)
  ];

  return el("div", { className: "nova-platform" }, [
    el("div", { className: "leetify-card__section-label", text: "Platform" }),
    el("div", { className: "nova-platform-box" }, rows)
  ]);
}

function buildLoadingCard() {
  return el("div", { className: "leetify-card leetify-card--loading" }, [
    el("div", { className: "leetify-card__body", text: "Loading stats…" })
  ]);
}

function buildErrorCard(error, steamId64) {
  const messages = {
    UNAUTHORIZED: "API key rejected — check it in the extension popup.",
    NOT_FOUND: "No Leetify data for this player yet.",
    PRIVATE_PROFILE: "This player's Leetify stats are private.",
    RATE_LIMITED: "Rate limited by Leetify — try again shortly, or add an API key for a higher limit.",
    NETWORK: "Couldn't reach Leetify.",
    UNKNOWN: "Something went wrong fetching Leetify data."
  };
  return el("div", { className: "leetify-card leetify-card--error" }, [
    el("div", {
      className: "leetify-card__body",
      text: messages[error] || messages.UNKNOWN
    }),
    buildFooterRow()
  ]);
}

function buildTiles(rows, variant) {
  return rows.map(([label, value, flagged]) => {
    const classes = [`leetify-tile`, `leetify-tile--${variant}`];
    if (flagged) classes.push("leetify-tile--flagged");
    return el("div", { className: classes.join(" ") }, [
      el("span", { className: "leetify-tile__value", text: String(value) }),
      el("span", { className: "leetify-tile__label", text: label })
    ]);
  });
}

// NOTE: only `preaim` is a confirmed field name straight from Leetify's
// docs — everything else in background.js's mapProfileToCardData has
// been verified against a real response as of 2026-08-31. If Leetify
// changes their schema, this function only needs edits if we rename
// fields or reorder sections.
function buildStatsCard(data) {
  // Flag thresholds — pattern signals worth a second look, not proof of
  // anything on their own.
  const aimFlagged = data.aimRating != null && data.aimRating > 95;
  const reactionFlagged = data.reactionTimeMs != null && data.reactionTimeMs < 270;
  const preaimFlagged = data.preaim != null && data.preaim < 5;

  // Leetify's developer guidelines prohibit renaming metrics, rescaling
  // them, or adding symbols/units they don't themselves display. Only
  // Aim Rating (integer, no symbol), Leetify Rating (signed, 2dp), and
  // Win Rate (×100 + %) are confirmed against real screenshots of
  // Leetify's own widget — everything else here shows the API's raw
  // value/precision with no invented "%" or "°", since we have no
  // confirmation that's how their own app displays those fields.
  const signedRating = data.leetifyRating != null
    ? `${data.leetifyRating >= 0 ? "+" : ""}${data.leetifyRating.toFixed(2)}`
    : null;

  const legitStats = [
    ["Aim Rating", data.aimRating != null ? Math.round(data.aimRating) : null, aimFlagged],
    ["Reaction Time", data.reactionTimeMs != null ? `${Math.round(data.reactionTimeMs)}ms` : null, reactionFlagged],
    ["Preaim", data.preaim != null ? data.preaim.toFixed(1) : null, preaimFlagged]
  ].filter(([, value]) => value !== undefined && value !== null);

  const perfStats = [
    ["Head Accuracy", data.headAccuracy != null ? data.headAccuracy.toFixed(1) : null],
    ["Leetify Rating", signedRating],
    ["Win Rate", data.winrate != null ? `${Math.round(data.winrate * 100)}%` : null],
    ["Spray Accuracy", data.sprayAccuracy != null ? data.sprayAccuracy.toFixed(1) : null],
    ["Matches", data.totalMatches]
  ].filter(([, value]) => value !== undefined && value !== null);

  const sections = [];
  const nameHeaderRight = el("div", { className: "leetify-card__header-right" });
  if (data.banned) nameHeaderRight.appendChild(el("span", { className: "leetify-card__banned", text: "Platform banned" }));
  nameHeaderRight.appendChild(buildViewOnLeetifyLink(data.steamId64));

  const nameHeader = el("div", { className: "leetify-card__header" }, [
    el("span", { text: data.name || "Player stats" }),
    nameHeaderRight
  ]);
  sections.push(nameHeader);

  if (legitStats.length) {
    sections.push(el("div", { className: "leetify-card__tiles" }, buildTiles(legitStats, "legit")));
  }
  if (perfStats.length) {
    sections.push(el("div", { className: "leetify-card__tiles" }, buildTiles(perfStats, "perf")));
  }

  sections.push(buildPlatformSection(data));

  return el("div", { className: "leetify-card" }, [
    ...sections,
    buildFooterRow()
  ]);
}

function findInjectionPoint() {
  // .profile_leftcol is where Leetify's own official widget lives too —
  // staying inside it (rather than breaking out to a full-width block
  // below the whole header) keeps our card vertically aligned with the
  // right-column sidebar, matching their placement. Prepending (not
  // appending) puts it at the very top of the column regardless of how
  // much other content — screenshots, groups, showcases — a profile has
  // further down, which is what caused the "way at the bottom" issue
  // before.
  return document.querySelector(".profile_leftcol") || document.querySelector(".responsive_page_template_content");
}

async function init() {
  if (!isProfileRootPage()) return;

  const steamId64 = extractSteamId64();
  if (!steamId64) return;

  const mount = findInjectionPoint();
  if (!mount) return;

  const container = el("div", { className: "leetify-container" }, [buildLoadingCard()]);
  mount.prepend(container);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_PLAYER_STATS",
      steamId64
    });

    container.innerHTML = "";
    if (response?.ok) {
      container.appendChild(buildStatsCard({ ...response.data, steamId64 }));
    } else {
      container.appendChild(buildErrorCard(response?.error, steamId64));
    }
  } catch (err) {
    console.error("[NØVA] failed to render stats card:", err);
    container.innerHTML = "";
    container.appendChild(buildErrorCard("UNKNOWN", steamId64));
  }
}

init();
