const state = {
  items: [],
  refreshedAt: null
};

const newsList = document.querySelector("#news-list");
const headlineCount = document.querySelector("#headline-count");
const refreshTime = document.querySelector("#refresh-time");
const statusBadge = document.querySelector("#connection-status");
const errorBanner = document.querySelector("#error-banner");

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

function render(payload) {
  state.items = payload.items ?? [];
  state.refreshedAt = payload.refreshedAt ?? null;

  headlineCount.textContent = `${state.items.length} ${state.items.length === 1 ? "item" : "items"}`;
  refreshTime.textContent = state.refreshedAt
    ? `Last refresh: ${new Date(state.refreshedAt).toLocaleString()}`
    : "Last refresh: --";

  newsList.textContent = "";

  if (state.items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "headline";
    empty.textContent = "No headlines available yet.";
    newsList.appendChild(empty);
    return;
  }

  for (const item of state.items) {
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

    const published = document.createElement("span");
    published.textContent = formatPublished(item.publishedAt);
    published.title = item.publishedAt || "";

    meta.append(source, published);
    row.append(link, meta);
    newsList.appendChild(row);
  }
}

async function loadInitial() {
  const response = await fetch("/api/news");
  if (!response.ok) {
    throw new Error(`Initial news load failed: ${response.status}`);
  }

  const payload = await response.json();
  setErrors(payload.errors);
  render(payload);
}

function connectSse() {
  setStatus("Connecting...", "connecting");
  const stream = new EventSource("/api/news/stream");

  stream.addEventListener("news", (event) => {
    const payload = JSON.parse(event.data);
    setErrors(payload.errors);
    render(payload);
    setStatus("Live", "connected");
  });

  stream.onerror = () => {
    setStatus("Reconnecting...", "disconnected");
  };
}

loadInitial()
  .catch(() => {
    setStatus("Offline", "disconnected");
  })
  .finally(() => {
    connectSse();
  });
