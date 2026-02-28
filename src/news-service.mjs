import { createHash } from "node:crypto";

const DEFAULT_FEEDS = [
  "https://news.google.com/rss/search?q=Israel+Iran+war&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Israel+Iran+conflict&hl=en-US&gl=US&ceid=US:en",
  "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"
];

const HOST_LABEL_OVERRIDES = {
  bbci: "BBC",
  bbc: "BBC"
};

const HOST_PART_BLACKLIST = new Set(["www", "feeds", "feed", "news", "rss", "com", "net", "org", "co", "uk"]);

const HTML_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: "\""
};

function toPositiveInteger(raw, fallback) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function parseFeedList(rawFeeds) {
  if (!rawFeeds || typeof rawFeeds !== "string") {
    return DEFAULT_FEEDS;
  }

  const feeds = rawFeeds
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return feeds.length > 0 ? feeds : DEFAULT_FEEDS;
}

function decodeUrlPart(value) {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value.replace(/\+/g, " ");
  }
}

function toLabelCase(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) {
        return word;
      }

      const lower = word.toLowerCase();
      return `${lower[0]?.toUpperCase() ?? ""}${lower.slice(1)}`;
    })
    .join(" ");
}

function buildFeedLabel(feedUrl) {
  if (!feedUrl) {
    return "Feed";
  }

  try {
    const url = new URL(feedUrl);
    const hostname = url.hostname.replace(/^www\./i, "");

    if (hostname.includes("news.google.")) {
      const query = toLabelCase(decodeUrlPart(url.searchParams.get("q") || ""));
      return query ? `Google News: ${query}` : "Google News";
    }

    const hostParts = hostname.split(".");
    const hostToken = hostParts.find((part) => !HOST_PART_BLACKLIST.has(part.toLowerCase())) || hostParts[0];
    const baseLabel = HOST_LABEL_OVERRIDES[hostToken.toLowerCase()] || toLabelCase(hostToken || hostname);
    const pathTokens = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => toLabelCase(decodeUrlPart(part)))
      .filter((part) => part && !/^rss(?:\.xml)?$/i.test(part));
    const pathToken = pathTokens[pathTokens.length - 1];

    return [baseLabel, pathToken].filter(Boolean).join(" - ");
  } catch {
    return toLabelCase(feedUrl);
  }
}

function decodeEntities(value) {
  if (!value) {
    return "";
  }

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_match, entity) => {
    if (entity[0] === "#") {
      const numeric = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 0x10ffff) {
        return "";
      }

      return String.fromCodePoint(numeric);
    }

    const named = HTML_ENTITIES[entity.toLowerCase()];
    return named ?? "";
  });
}

function cleanText(raw) {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  return decodeEntities(
    raw
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractBlocks(xml, tagName) {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const blocks = [];
  let match = pattern.exec(xml);

  while (match) {
    blocks.push(match[0]);
    match = pattern.exec(xml);
  }

  return blocks;
}

function extractTagText(xml, tagName) {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(pattern);
  return match ? cleanText(match[1]) : "";
}

function extractTagHref(xml, tagName) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)\\/?>`, "i");
  const match = xml.match(pattern);
  if (!match) {
    return "";
  }

  const attrs = match[1] ?? "";
  const hrefMatch = attrs.match(/\bhref="([^"]+)"/i) ?? attrs.match(/\bhref='([^']+)'/i);
  return hrefMatch ? cleanText(hrefMatch[1]) : "";
}

function toTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) {
    return "";
  }

  try {
    const url = new URL(rawUrl);
    url.hash = "";

    const nextParams = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      const lower = key.toLowerCase();
      if (
        lower.startsWith("utm_") ||
        lower === "oc" ||
        lower === "ved" ||
        lower === "ei" ||
        lower === "gws_rd"
      ) {
        continue;
      }

      nextParams.append(key, value);
    }

    url.search = nextParams.toString();
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

function buildId(parts) {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

function toItem({ title, link, source, published, feedUrl, feedLabel, guid }) {
  const safeTitle = cleanText(title);
  const safeLink = normalizeUrl(cleanText(link));
  const safeSource = cleanText(source) || "Unknown";
  const publishedTs = toTimestamp(published);
  const publishedAt = publishedTs > 0 ? new Date(publishedTs).toISOString() : null;

  if (!safeTitle || !safeLink) {
    return null;
  }

  return {
    id: buildId([guid || "", safeLink, safeTitle, publishedAt || "", safeSource]),
    title: safeTitle,
    link: safeLink,
    source: safeSource,
    publishedAt,
    publishedTs,
    feedUrl,
    feedLabel
  };
}

function parseRss(xml, feedUrl, feedLabel) {
  const channelBlock = xml.match(/<channel(?:\s[^>]*)?>([\s\S]*?)<\/channel>/i)?.[0] ?? "";
  const channelTitle = extractTagText(channelBlock, "title") || "RSS Feed";
  const blocks = extractBlocks(xml, "item");

  return blocks
    .map((block) =>
      toItem({
        title: extractTagText(block, "title"),
        link: extractTagText(block, "link"),
        source: extractTagText(block, "source") || channelTitle,
        published: extractTagText(block, "pubDate"),
        guid: extractTagText(block, "guid"),
        feedUrl,
        feedLabel
      })
    )
    .filter(Boolean);
}

function parseAtom(xml, feedUrl, feedLabel) {
  const feedTitle = extractTagText(xml, "title") || "Atom Feed";
  const entries = extractBlocks(xml, "entry");

  return entries
    .map((entry) =>
      toItem({
        title: extractTagText(entry, "title"),
        link: extractTagHref(entry, "link") || extractTagText(entry, "link"),
        source: extractTagText(entry, "source") || feedTitle,
        published: extractTagText(entry, "updated") || extractTagText(entry, "published"),
        guid: extractTagText(entry, "id"),
        feedUrl,
        feedLabel
      })
    )
    .filter(Boolean);
}

function parseFeed(xml, feedUrl, feedLabel) {
  if (!xml || typeof xml !== "string") {
    return [];
  }

  if (/<rss\b/i.test(xml) || /<channel\b/i.test(xml)) {
    return parseRss(xml, feedUrl, feedLabel);
  }

  if (/<feed\b/i.test(xml) && /<entry\b/i.test(xml)) {
    return parseAtom(xml, feedUrl, feedLabel);
  }

  return [];
}

async function fetchOneFeed(feedUrl, feedLabel, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "user-agent": "MinasWatch/0.1 (+rss)"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    return parseFeed(xml, feedUrl, feedLabel);
  } finally {
    clearTimeout(timer);
  }
}

function dedupeAndSort(items) {
  const seenLinks = new Set();
  const seenTitleSource = new Set();
  const sorted = [...items].sort((a, b) => b.publishedTs - a.publishedTs);
  const output = [];

  for (const item of sorted) {
    const normalizedTitle = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    const normalizedSource = item.source.toLowerCase().replace(/\s+/g, " ").trim();
    const signature = `${normalizedSource}|${normalizedTitle}`;

    if ((item.link && seenLinks.has(item.link)) || seenTitleSource.has(signature)) {
      continue;
    }

    if (item.link) {
      seenLinks.add(item.link);
    }
    seenTitleSource.add(signature);
    output.push(item);
  }

  return output;
}

function snapshotShape(items, refreshedAt, errors, limit, feeds) {
  return {
    refreshedAt: refreshedAt ? new Date(refreshedAt).toISOString() : null,
    count: Math.min(limit, items.length),
    feeds: feeds.map((feed) => ({
      feedUrl: feed.feedUrl,
      feedLabel: feed.feedLabel
    })),
    items: items.slice(0, limit).map((item) => ({
      id: item.id,
      title: item.title,
      link: item.link,
      source: item.source,
      publishedAt: item.publishedAt,
      feedUrl: item.feedUrl,
      feedLabel: item.feedLabel
    })),
    errors
  };
}

export function createNewsService() {
  const refreshMs = toPositiveInteger(process.env.NEWS_REFRESH_MS, 120000);
  const maxItems = toPositiveInteger(process.env.NEWS_MAX_ITEMS, 50);
  const fetchTimeoutMs = toPositiveInteger(process.env.NEWS_FETCH_TIMEOUT_MS, 7000);
  const cacheTtlMs = toPositiveInteger(process.env.NEWS_CACHE_TTL_MS, refreshMs);
  const feedUrls = parseFeedList(process.env.NEWS_FEEDS);
  const feedCatalog = feedUrls.map((feedUrl) => ({
    feedUrl,
    feedLabel: buildFeedLabel(feedUrl)
  }));

  let timer = null;
  let refreshing = null;
  let items = [];
  let refreshedAt = 0;
  let lastRefreshAttemptAt = 0;
  let lastErrors = [];
  const listeners = new Set();

  function notify() {
    const snapshot = snapshotShape(items, refreshedAt, lastErrors, maxItems, feedCatalog);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  async function refresh() {
    if (refreshing) {
      return refreshing;
    }

    lastRefreshAttemptAt = Date.now();

    refreshing = (async () => {
      const results = await Promise.allSettled(
        feedCatalog.map((feed) => fetchOneFeed(feed.feedUrl, feed.feedLabel, fetchTimeoutMs))
      );
      const nextErrors = [];
      const mergedItems = [];

      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        const feed = feedCatalog[index];

        if (result.status === "fulfilled") {
          mergedItems.push(...result.value);
          continue;
        }

        nextErrors.push({
          feedUrl: feed.feedUrl,
          feedLabel: feed.feedLabel,
          message: result.reason?.message || "feed_fetch_failed"
        });
      }

      if (mergedItems.length > 0) {
        const nextItems = dedupeAndSort(mergedItems).slice(0, maxItems);
        const previousIds = items.map((item) => item.id).join(",");
        const nextIds = nextItems.map((item) => item.id).join(",");
        items = nextItems;
        refreshedAt = Date.now();
        lastErrors = nextErrors;

        if (previousIds !== nextIds) {
          notify();
        }

        return snapshotShape(items, refreshedAt, lastErrors, maxItems, feedCatalog);
      }

      if (nextErrors.length > 0) {
        lastErrors = nextErrors;
      }

      return snapshotShape(items, refreshedAt, lastErrors, maxItems, feedCatalog);
    })().finally(() => {
      refreshing = null;
    });

    return refreshing;
  }

  async function getLatest(limit = maxItems) {
    const now = Date.now();
    const stale = now - refreshedAt >= cacheTtlMs;

    if (items.length === 0) {
      await refresh();
    } else if (stale && now - lastRefreshAttemptAt >= Math.min(30000, cacheTtlMs)) {
      refresh().catch(() => {});
    }

    return snapshotShape(items, refreshedAt, lastErrors, Math.min(limit, maxItems), feedCatalog);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function start() {
    refresh().catch(() => {});
    timer = setInterval(() => {
      refresh().catch(() => {});
    }, refreshMs);

    timer.unref?.();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    feeds: feedUrls,
    feedCatalog,
    maxItems,
    getLatest,
    refresh,
    subscribe,
    start,
    stop
  };
}
