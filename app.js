const STORAGE_KEY = "minas-watch.source-controls.v1";

function defaultPreferences() {
  return {
    feedSelections: {},
    preferredOutlets: "",
    preferredKeywords: ""
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
      preferredKeywords: typeof parsed?.preferredKeywords === "string" ? parsed.preferredKeywords : ""
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
const resetControlsButton = document.querySelector("#reset-controls");

function savePreferences() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.preferences));
  } catch {
    // Ignore persistence failures (private mode / storage disabled).
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
    if (!feed?.feedUrl) {
      continue;
    }

    feedMap.set(feed.feedUrl, {
      feedUrl: feed.feedUrl,
      feedLabel: feed.feedLabel || feed.feedUrl
    });
  }

  for (const item of payloadItems ?? []) {
    if (!item?.feedUrl || feedMap.has(item.feedUrl)) {
      continue;
    }

    feedMap.set(item.feedUrl, {
      feedUrl: item.feedUrl,
      feedLabel: item.feedLabel || item.feedUrl
    });
  }

  return Array.from(feedMap.values());
}

function hydrateFromPayload(payload) {
  const incomingItems = payload.items ?? [];
  const incomingFeeds = normalizeFeeds(payload.feeds, incomingItems);
  const feedLabelByUrl = new Map(incomingFeeds.map((feed) => [feed.feedUrl, feed.feedLabel]));

  state.feeds = incomingFeeds;
  state.items = incomingItems.map((item) => ({
    ...item,
    feedLabel: item.feedLabel || feedLabelByUrl.get(item.feedUrl) || item.feedUrl || "Feed"
  }));
  state.refreshedAt = payload.refreshedAt ?? null;
}

function rankVisibleItems() {
  const preferredOutlets = parseCommaList(state.preferences.preferredOutlets);
  const preferredKeywords = parseCommaList(state.preferences.preferredKeywords);

  return state.items
    .filter((item) => isFeedActive(item.feedUrl))
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
    text.textContent = feed.feedLabel;

    label.append(checkbox, text);
    feedTogglesRoot.appendChild(label);
  }
}

function renderHeadlines() {
  const visibleItems = rankVisibleItems();

  headlineCount.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? "item" : "items"}`;
  refreshTime.textContent = state.refreshedAt
    ? `Last refresh: ${new Date(state.refreshedAt).toLocaleString()}`
    : "Last refresh: --";

  newsList.textContent = "";

  if (visibleItems.length === 0) {
    const empty = document.createElement("li");
    empty.className = "headline";
    empty.textContent = state.items.length > 0 ? "No headlines match the current feed selection." : "No headlines available yet.";
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
    row.append(link, meta);
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
  savePreferences();
  renderFeedControls();
  renderHeadlines();
}

async function loadInitial() {
  const response = await fetch("/api/news");
  if (!response.ok) {
    throw new Error(`Initial news load failed: ${response.status}`);
  }

  const payload = await response.json();
  setErrors(payload.errors);
  applyPayload(payload);
}

function connectSse() {
  setStatus("Connecting...", "connecting");
  const stream = new EventSource("/api/news/stream");

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

resetControlsButton.addEventListener("click", () => {
  resetPreferences();
});

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
    errorBanner.textContent = "Live API is unavailable on this host. If you are using GitHub Pages, deploy the Node API separately for live headlines.";
    renderHeadlines();
  })
  .finally(() => {
    if (apiOnline) {
      connectSse();
    }
  });
