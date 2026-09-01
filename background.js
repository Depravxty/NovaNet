// background.js — service worker
//
// Responsibilities:
//  1. Hold the Leetify API key (optional — unauthenticated calls work too,
//     just with a stricter rate limit per Leetify's docs).
//  2. Make the actual fetch to Leetify's Public API.
//  3. Cache responses briefly so re-viewing the same profile / lobby
//     doesn't re-hit the API every time.
//
// Docs: https://api-public-docs.cs-prod.leetify.com/
// CONFIRMED against a real response (2026-08-31): the query param is
// `steam64_id`, not `steamId`. Field names below are taken directly from
// that real response — see mapProfileToCardData. Anything not listed
// there (K/D, ADR, HLTV rating, time-to-damage, crosshair placement)
// genuinely does not exist on this public endpoint; don't re-add guesses
// for those without new evidence they exist somewhere else in the shape.

const LEETIFY_API_BASE = "https://api-public.cs-prod.leetify.com";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const memoryCache = new Map(); // steamId64 -> { data, expiresAt }

async function getApiKey() {
  const { leetifyApiKey } = await chrome.storage.local.get("leetifyApiKey");
  return leetifyApiKey || null;
}

// Leetify's ProfileResponse -> the flat shape content.js's buildStatsCard
// consumes. Isolated here so the mapping is a one-function fix if the API
// shape changes.
function mapProfileToCardData(profile) {
  const stats = profile.stats || {};
  const rating = profile.rating || {};
  const ranks = profile.ranks || {};

  // Competitive is tracked per-map (ranks.competitive is an array of
  // {map_name, rank}), not a single account-wide rank — there's no
  // single "current Competitive rank" in this API. We show the highest
  // rank across their maps as the closest single-number stand-in, and
  // pass the full per-map breakdown through for a hover tooltip. Rank 0
  // means "not yet ranked on that map" — excluded from the "best map"
  // calculation but kept in the breakdown for completeness.
  const competitiveRanks = Array.isArray(ranks.competitive) ? ranks.competitive : [];
  const rankedMaps = competitiveRanks.filter((r) => r.rank > 0);
  const topMap = rankedMaps.length
    ? rankedMaps.reduce((best, r) => (r.rank > best.rank ? r : best))
    : null;

  return {
    name: profile.name,
    banned: Array.isArray(profile.bans) && profile.bans.length > 0,
    winrate: profile.winrate,
    totalMatches: profile.total_matches,

    premierCurrent: ranks.premier,
    premierBest: null, // confirmed: no peak/best Premier field on this API

    competitiveCurrent: topMap ? topMap.rank : null,
    competitiveTopMap: topMap ? topMap.map_name : null,
    competitiveBreakdown: competitiveRanks, // [{map_name, rank}, ...] for the tooltip
    competitiveBest: null, // no rank-history field on this API

    wingmanCurrent: ranks.wingman,
    wingmanBest: null,

    faceitLevel: ranks.faceit,
    faceitChallenger: false, // no such field on this API — always off
    faceitElo: ranks.faceit_elo,
    faceitEloPeak: null, // no peak-elo field on this API

    leetifyRating: ranks.leetify,
    aimRating: rating.aim,
    utilityRating: rating.utility,

    // Confirmed real fields. K/D, ADR, HLTV rating, time-to-damage, and
    // crosshair placement are NOT on this endpoint — dropped from the
    // card entirely rather than always showing N/A.
    headAccuracy: stats.accuracy_head,
    aimAccuracy: stats.accuracy_enemy_spotted,
    sprayAccuracy: stats.spray_accuracy,
    preaim: stats.preaim,
    reactionTimeMs: stats.reaction_time_ms
  };
}

async function fetchPlayerStats(steamId64) {
  const cached = memoryCache.get(steamId64);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, cached: true, data: cached.data };
  }

  const apiKey = await getApiKey();
  const headers = { Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const url = `${LEETIFY_API_BASE}/v3/profile?steam64_id=${encodeURIComponent(steamId64)}`;
    const res = await fetch(url, { method: "GET", headers });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "UNAUTHORIZED" };
    }
    if (res.status === 404) {
      return { ok: false, error: "NOT_FOUND" };
    }
    if (res.status === 429) {
      return { ok: false, error: "RATE_LIMITED" };
    }
    if (!res.ok) {
      return { ok: false, error: "UNKNOWN", status: res.status };
    }

    const profile = await res.json();
    if (profile.privacy_mode === "private") {
      return { ok: false, error: "PRIVATE_PROFILE" };
    }

    const data = mapProfileToCardData(profile);
    memoryCache.set(steamId64, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return { ok: true, cached: false, data };
  } catch (err) {
    return { ok: false, error: "NETWORK", message: String(err) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "FETCH_PLAYER_STATS") {
    fetchPlayerStats(message.steamId64).then(sendResponse);
    return true; // keep the message channel open for the async response
  }

  if (message?.type === "SET_API_KEY") {
    chrome.storage.local.set({ leetifyApiKey: message.apiKey }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "GET_API_KEY_STATUS") {
    getApiKey().then((key) => sendResponse({ hasKey: Boolean(key) }));
    return true;
  }
});
