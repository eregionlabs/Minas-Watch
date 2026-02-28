const STORAGE_KEY = "minas-watch.source-controls.v1";

const API_BASE = (() => {
  const queryBase = new URLSearchParams(window.location.search).get("api");
  const configuredBase = queryBase || window.MINAS_WATCH_API_BASE || "";
  return configuredBase.replace(/\/$/, "");
})();

function apiUrl(path) {
  if (!API_BASE) {
    return path;
  }

  return `${API_BASE}${path}`;
}

const SOURCE_TYPE_LABELS = {
  official: "Official",
  osint_social: "OSINT Social",
  sensor: "Sensor",
  wire: "Wire"
};

function defaultPreferences() {
  return {
    feedSelections: {},
    preferredOutlets: "",
    preferredKeywords: "",
    firstHandOnly: false
  };
}

function toFiniteNumber(raw, fallback) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function toTrustTier(raw, fallback = 3) {
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    return fallback;
  }

  if (value < 1) {
    return 1;
  }

  if (value > 5) {
    return 5;
  }

  return value;
}

function normalizeSourceType(raw) {
  return Object.prototype.hasOwnProperty.call(SOURCE_TYPE_LABELS, raw) ? raw : "wire";
}

function normalizeRegionTags(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set();
  const tags = [];

  for (const value of raw) {
    if (typeof value !== "string") {
      continue;
    }

    const tag = value.trim().toLowerCase();
    if (!tag || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

function normalizeFeedRecord(rawFeed) {
  const feedUrl = typeof rawFeed?.feedUrl === "string" ? rawFeed.feedUrl : "";
  if (!feedUrl) {
    return null;
  }

  return {
    feedUrl,
    feedLabel: typeof rawFeed?.feedLabel === "string" && rawFeed.feedLabel.trim() ? rawFeed.feedLabel : feedUrl,
    sourceType: normalizeSourceType(rawFeed?.sourceType),
    regionTags: normalizeRegionTags(rawFeed?.regionTags),
    trustTier: toTrustTier(rawFeed?.trustTier),
    firstHand: rawFeed?.firstHand === true,
    basePriority: toFiniteNumber(rawFeed?.basePriority, 0)
  };
}

function normalizeItemRecord(rawItem, feedMeta) {
  const feedUrl = typeof rawItem?.feedUrl === "string" && rawItem.feedUrl ? rawItem.feedUrl : feedMeta?.feedUrl || "";
  if (!feedUrl) {
    return null;
  }

  return {
    id: rawItem?.id,
    title: rawItem?.title,
    link: rawItem?.link,
    source: rawItem?.source,
    publishedAt: rawItem?.publishedAt,
    feedUrl,
    feedLabel:
      (typeof rawItem?.feedLabel === "string" && rawItem.feedLabel) ||
      feedMeta?.feedLabel ||
      feedUrl ||
      "Feed",
    sourceType: normalizeSourceType(rawItem?.sourceType || feedMeta?.sourceType),
    regionTags: normalizeRegionTags(Array.isArray(rawItem?.regionTags) ? rawItem.regionTags : feedMeta?.regionTags),
    trustTier: toTrustTier(rawItem?.trustTier ?? feedMeta?.trustTier),
    firstHand: typeof rawItem?.firstHand === "boolean" ? rawItem.firstHand : feedMeta?.firstHand === true,
    basePriority: toFiniteNumber(rawItem?.basePriority ?? feedMeta?.basePriority, 0)
  };
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultPreferences();
    }

    const parsed = JSON.parse(raw);
    const safeSelections = {};

    if (parsed?.feedSelections && typeof parsed.feedSelections === "object" && !Array.isArray(parsed.feedSelections)) {
      for (const [key, value] of Object.entries(parsed.feedSelections)) {
        if (typeof value === "boolean") {
          safeSelections[key] = value;
        }
      }
    }

    return {
      feedSelections: safeSelections,
      preferredOutlets: typeof parsed?.preferredOutlets === "string" ? parsed.preferredOutlets : "",
      preferredKeywords: typeof parsed?.preferredKeywords === "string" ? parsed.preferredKeywords : "",
      firstHandOnly: parsed?.firstHandOnly === true
    };
  } catch {
    return defaultPreferences();
  }
}

const state = {
  items: [],
  feeds: [],
  refreshedAt: null,
  preferences: loadPreferences()
};

const newsList = document.querySelector("#news-list");
const headlineCount = document.querySelector("#headline-count");
const refreshTime = document.querySelector("#refresh-time");
const statusBadge = document.querySelector("#connection-status");
const errorBanner = document.querySelector("#error-banner");
const feedTogglesRoot = document.querySelector("#feed-toggles");
const preferredOutletsInput = document.querySelector("#preferred-outlets");
const preferredKeywordsInput = document.querySelector("#preferred-keywords");
const firstHandOnlyToggle = document.querySelector("#first-hand-only");
const resetControlsButton = document.querySelector("#reset-controls");
const dashboardRoot = document.querySelector(".dashboard");
const controlsPanel = document.querySelector(".controls-panel");
const headlinesPanel = document.querySelector(".headlines-panel");

function savePreferences() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.preferences));
  } catch {
    // Ignore persistence failures (private mode / storage disabled).
  }
}

function applyResponsivePanelOrder() {
  if (!dashboardRoot || !controlsPanel || !headlinesPanel) {
    return;
  }

  const mobile = window.matchMedia("(max-width: 960px)").matches;

  if (mobile) {
    if (dashboardRoot.firstElementChild !== headlinesPanel) {
      dashboardRoot.prepend(headlinesPanel);
    }
    return;
  }

  if (dashboardRoot.firstElementChild !== controlsPanel) {
    dashboardRoot.prepend(controlsPanel);
  }
}

function toRelativeTime(isoString) {
  if (!isoString) {
    return "Unknown time";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMs = date.getTime() - Date.now();
  const diffMins = Math.round(diffMs / 60000);

  if (Math.abs(diffMins) < 60) {
    return formatter.format(diffMins, "minute");
  }

  const diffHours = Math.round(diffMins / 60);
  if (Math.abs(diffHours) < 48) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function formatPublished(isoString) {
  if (!isoString) {
    return "Unknown time";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return `${toRelativeTime(isoString)} (${date.toLocaleString()})`;
}

function parseCommaList(raw) {
  const seen = new Set();
  const tokens = [];

  for (const value of raw.split(",")) {
    const token = value.trim().toLowerCase();
    if (!token || seen.has(token)) {
      continue;
    }

    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}

function toTimestamp(isoString) {
  const value = Date.parse(isoString || "");
  return Number.isFinite(value) ? value : 0;
}

function countMatches(text, tokens) {
  if (!text || tokens.length === 0) {
    return 0;
  }

  const haystack = text.toLowerCase();
  let matches = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      matches += 1;
    }
  }

  return matches;
}

function isFeedActive(feedUrl) {
  if (!feedUrl) {
    return true;
  }

  return state.preferences.feedSelections[feedUrl] !== false;
}

function setFeedActive(feedUrl, active) {
  if (!feedUrl) {
    return;
  }

  if (active) {
    delete state.preferences.feedSelections[feedUrl];
  } else {
    state.preferences.feedSelections[feedUrl] = false;
  }
}

function normalizeFeeds(payloadFeeds, payloadItems) {
  const feedMap = new Map();

  for (const feed of payloadFeeds ?? []) {
    const normalizedFeed = normalizeFeedRecord(feed);
    if (!normalizedFeed) {
      continue;
    }

    feedMap.set(normalizedFeed.feedUrl, normalizedFeed);
  }

  for (const item of payloadItems ?? []) {
    if (!item?.feedUrl || feedMap.has(item.feedUrl)) {
      continue;
    }

    const normalizedFeed = normalizeFeedRecord({
      feedUrl: item.feedUrl,
      feedLabel: item.feedLabel,
      sourceType: item.sourceType,
      regionTags: item.regionTags,
      trustTier: item.trustTier,
      firstHand: item.firstHand,
      basePriority: item.basePriority
    });

    if (normalizedFeed) {
      feedMap.set(normalizedFeed.feedUrl, normalizedFeed);
    }
  }

  return Array.from(feedMap.values());
}

function hydrateFromPayload(payload) {
  const incomingItems = payload.items ?? [];
  const incomingFeeds = normalizeFeeds(payload.feeds, incomingItems);
  const feedByUrl = new Map(incomingFeeds.map((feed) => [feed.feedUrl, feed]));

  state.feeds = incomingFeeds;
  state.items = incomingItems
    .map((item) => normalizeItemRecord(item, feedByUrl.get(item.feedUrl)))
    .filter(Boolean);
  state.refreshedAt = payload.refreshedAt ?? null;
}

function rankVisibleItems() {
  const preferredOutlets = parseCommaList(state.preferences.preferredOutlets);
  const preferredKeywords = parseCommaList(state.preferences.preferredKeywords);

  return state.items
    .filter((item) => isFeedActive(item.feedUrl))
    .filter((item) => !state.preferences.firstHandOnly || item.firstHand === true)
    .map((item, index) => {
      const outletMatches = countMatches(item.source || "", preferredOutlets);
      const keywordMatches = countMatches(item.title || "", preferredKeywords);
      const score = outletMatches * 3 + keywordMatches * 2;

      return {
        ...item,
        _score: score,
        _timestamp: toTimestamp(item.publishedAt),
        _index: index
      };
    })
    .sort((a, b) => b._score - a._score || b._timestamp - a._timestamp || a._index - b._index);
}

function formatSourceType(sourceType) {
  return SOURCE_TYPE_LABELS[normalizeSourceType(sourceType)] || "Wire";
}

function setStatus(label, className) {
  statusBadge.textContent = label;
  statusBadge.classList.remove("connected", "connecting", "disconnected");
  statusBadge.classList.add(className);
}

function setErrors(errors) {
  if (!errors || errors.length === 0) {
    errorBanner.classList.add("hidden");
    errorBanner.textContent = "";
    return;
  }

  errorBanner.classList.remove("hidden");
  errorBanner.textContent = "Some feeds failed to refresh. Showing latest available headlines.";
}

function renderFeedControls() {
  feedTogglesRoot.textContent = "";

  if (state.feeds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "control-note";
    empty.textContent = "No feed metadata available yet.";
    feedTogglesRoot.appendChild(empty);
    return;
  }

  for (const feed of state.feeds) {
    const label = document.createElement("label");
    label.className = "feed-toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isFeedActive(feed.feedUrl);
    checkbox.addEventListener("change", (event) => {
      setFeedActive(feed.feedUrl, event.target.checked);
      savePreferences();
      renderHeadlines();
    });

    const text = document.createElement("span");
    text.textContent = `${feed.feedLabel} (${formatSourceType(feed.sourceType)} | T${feed.trustTier})`;

    label.append(checkbox, text);
    feedTogglesRoot.appendChild(label);
  }
}

function renderHeadlines() {
  const visibleItems = rankVisibleItems();

  if (headlineCount) {
    headlineCount.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? "item" : "items"}`;
  }
  refreshTime.textContent = state.refreshedAt
    ? `Last refresh: ${new Date(state.refreshedAt).toLocaleString()}`
    : "Last refresh: --";

  newsList.textContent = "";

  if (visibleItems.length === 0) {
    const empty = document.createElement("li");
    empty.className = "headline";
    empty.textContent = state.items.length > 0
      ? state.preferences.firstHandOnly
        ? "No first-hand headlines match the current feed selection."
        : "No headlines match the current feed selection."
      : "No headlines available yet.";
    newsList.appendChild(empty);
    return;
  }

  for (const item of visibleItems) {
    const row = document.createElement("li");
    row.className = "headline";

    const link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.title;

    const badges = document.createElement("div");
    badges.className = "headline-badges";

    const sourceTypeBadge = document.createElement("span");
    sourceTypeBadge.className = "badge badge-source";
    sourceTypeBadge.dataset.sourceType = normalizeSourceType(item.sourceType);
    sourceTypeBadge.textContent = formatSourceType(item.sourceType);

    const trustBadge = document.createElement("span");
    trustBadge.className = "badge badge-trust";
    trustBadge.textContent = `T${toTrustTier(item.trustTier)}`;

    badges.append(sourceTypeBadge, trustBadge);

    const meta = document.createElement("p");
    meta.className = "meta";

    const source = document.createElement("span");
    source.textContent = item.source || "Unknown";

    const feed = document.createElement("span");
    feed.textContent = item.feedLabel || item.feedUrl || "Feed";

    const published = document.createElement("span");
    published.textContent = formatPublished(item.publishedAt);
    published.title = item.publishedAt || "";

    meta.append(source, feed, published);
    row.append(link, badges, meta);
    newsList.appendChild(row);
  }
}

function applyPayload(payload) {
  hydrateFromPayload(payload);
  renderFeedControls();
  renderHeadlines();
}

function resetPreferences() {
  state.preferences = defaultPreferences();
  preferredOutletsInput.value = "";
  preferredKeywordsInput.value = "";
  if (firstHandOnlyToggle) {
    firstHandOnlyToggle.checked = false;
  }
  savePreferences();
  renderFeedControls();
  renderHeadlines();
}

async function loadInitial() {
  const response = await fetch(apiUrl("/api/news"));
  if (!response.ok) {
    throw new Error(`Initial news load failed: ${response.status}`);
  }

  const payload = await response.json();
  setErrors(payload.errors);
  applyPayload(payload);
}

function connectSse() {
  setStatus("Connecting...", "connecting");
  const stream = new EventSource(apiUrl("/api/news/stream"));

  stream.addEventListener("news", (event) => {
    const payload = JSON.parse(event.data);
    setErrors(payload.errors);
    applyPayload(payload);
    setStatus("Live", "connected");
  });

  stream.onerror = () => {
    setStatus("Reconnecting...", "disconnected");
  };
}

preferredOutletsInput.value = state.preferences.preferredOutlets;
preferredKeywordsInput.value = state.preferences.preferredKeywords;
if (firstHandOnlyToggle) {
  firstHandOnlyToggle.checked = state.preferences.firstHandOnly;
}

preferredOutletsInput.addEventListener("input", (event) => {
  state.preferences.preferredOutlets = event.target.value;
  savePreferences();
  renderHeadlines();
});

preferredKeywordsInput.addEventListener("input", (event) => {
  state.preferences.preferredKeywords = event.target.value;
  savePreferences();
  renderHeadlines();
});

if (firstHandOnlyToggle) {
  firstHandOnlyToggle.addEventListener("change", (event) => {
    state.preferences.firstHandOnly = event.target.checked;
    savePreferences();
    renderHeadlines();
  });
}

resetControlsButton.addEventListener("click", () => {
  resetPreferences();
});

applyResponsivePanelOrder();
window.addEventListener("resize", applyResponsivePanelOrder);
window.addEventListener("orientationchange", applyResponsivePanelOrder);

renderFeedControls();
renderHeadlines();

let apiOnline = false;

loadInitial()
  .then(() => {
    apiOnline = true;
  })
  .catch(() => {
    setStatus("Offline", "disconnected");
    errorBanner.classList.remove("hidden");
    errorBanner.textContent = "Live API is unavailable on this host. Set window.MINAS_WATCH_API_BASE in config.js (or ?api=https://...) to connect GitHub Pages to a deployed API.";
    renderHeadlines();
  })
  .finally(() => {
    if (apiOnline) {
      connectSse();
    }
  });
