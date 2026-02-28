import { createHash } from "node:crypto";

const SOURCE_TYPES = new Set(["official", "osint_social", "sensor", "wire"]);

const SOURCE_TYPE_CLASS_ORDER = {
  official: 0,
  osint_social: 1,
  sensor: 2,
  wire: 3
};

const FIRST_HAND_CLASS_BOOST = 2;

const SOURCE_CATALOG = [
  {
    feedUrl: "https://nitter.net/idfonline/rss",
    feedLabel: "IDF (X via Nitter)",
    sourceType: "official",
    regionTags: ["israel", "military", "middle-east"],
    trustTier: 5,
    firstHand: true,
    basePriority: 98
  },
  {
    feedUrl: "https://nitter.net/IsraelMFA/rss",
    feedLabel: "Israel MFA (X via Nitter)",
    sourceType: "official",
    regionTags: ["israel", "diplomacy", "middle-east"],
    trustTier: 5,
    firstHand: true,
    basePriority: 94
  },
  {
    feedUrl: "https://nitter.net/CENTCOM/rss",
    feedLabel: "US CENTCOM (X via Nitter)",
    sourceType: "official",
    regionTags: ["us", "military", "middle-east"],
    trustTier: 5,
    firstHand: true,
    basePriority: 92
  },
  {
    feedUrl: "https://nitter.net/Iran_UN/rss",
    feedLabel: "Iran UN Mission (X via Nitter)",
    sourceType: "official",
    regionTags: ["iran", "diplomacy", "middle-east"],
    trustTier: 4,
    firstHand: true,
    basePriority: 90
  },
  {
    feedUrl: "https://nitter.net/iaeaorg/rss",
    feedLabel: "IAEA (X via Nitter)",
    sourceType: "official",
    regionTags: ["nuclear", "iran", "middle-east"],
    trustTier: 5,
    firstHand: true,
    basePriority: 88
  },
  {
    feedUrl: "https://www.unocha.org/rss.xml",
    feedLabel: "UN OCHA Updates",
    sourceType: "official",
    regionTags: ["humanitarian", "middle-east"],
    trustTier: 4,
    firstHand: true,
    basePriority: 84
  },
  {
    feedUrl: "https://nitter.net/sentdefender/rss",
    feedLabel: "SentDefender (X via Nitter)",
    sourceType: "osint_social",
    regionTags: ["osint", "middle-east", "breaking"],
    trustTier: 3,
    firstHand: true,
    basePriority: 82
  },
  {
    feedUrl: "https://nitter.net/ELINTNews/rss",
    feedLabel: "ELINT News (X via Nitter)",
    sourceType: "osint_social",
    regionTags: ["osint", "signals", "middle-east"],
    trustTier: 3,
    firstHand: true,
    basePriority: 80
  },
  {
    feedUrl: "https://nitter.net/Osinttechnical/rss",
    feedLabel: "OSINTtechnical (X via Nitter)",
    sourceType: "osint_social",
    regionTags: ["osint", "battlefield", "middle-east"],
    trustTier: 3,
    firstHand: true,
    basePriority: 78
  },
  {
    feedUrl: "https://nitter.net/AuroraIntel/rss",
    feedLabel: "Aurora Intel (X via Nitter)",
    sourceType: "osint_social",
    regionTags: ["osint", "breaking", "middle-east"],
    trustTier: 2,
    firstHand: true,
    basePriority: 76
  },
  {
    feedUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom",
    feedLabel: "USGS Earthquakes (All Hour)",
    sourceType: "sensor",
    regionTags: ["sensor", "seismic", "global"],
    trustTier: 5,
    firstHand: true,
    basePriority: 72
  },
  {
    feedUrl: "https://news.google.com/rss/search?q=Israel+Iran+war&hl=en-US&gl=US&ceid=US:en",
    feedLabel: "Google News: Israel Iran War",
    sourceType: "wire",
    regionTags: ["middle-east", "context"],
    trustTier: 3,
    firstHand: false,
    basePriority: 38
  },
  {
    feedUrl: "https://news.google.com/rss/search?q=Israel+Iran+conflict&hl=en-US&gl=US&ceid=US:en",
    feedLabel: "Google News: Israel Iran Conflict",
    sourceType: "wire",
    regionTags: ["middle-east", "context"],
    trustTier: 3,
    firstHand: false,
    basePriority: 36
  },
  {
    feedUrl: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
    feedLabel: "BBC - Middle East",
    sourceType: "wire",
    regionTags: ["middle-east", "context"],
    trustTier: 4,
    firstHand: false,
    basePriority: 34
  },
  {
    feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    feedLabel: "NYT - World",
    sourceType: "wire",
    regionTags: ["world", "context"],
    trustTier: 4,
    firstHand: false,
    basePriority: 32
  },
  {
    feedUrl: "https://www.theguardian.com/world/rss",
    feedLabel: "Guardian - World",
    sourceType: "wire",
    regionTags: ["world", "context"],
    trustTier: 4,
    firstHand: false,
    basePriority: 30
  },
  {
    feedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    feedLabel: "Al Jazeera - All News",
    sourceType: "wire",
    regionTags: ["middle-east", "context"],
    trustTier: 3,
    firstHand: false,
    basePriority: 28
  }
];

const DEFAULT_FEEDS = SOURCE_CATALOG.map((feed) => feed.feedUrl);

const HOST_LABEL_OVERRIDES = {
  apnews: "AP",
  bbci: "BBC",
  bbc: "BBC",
  idfonline: "IDF",
  israelmfa: "Israel MFA"
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

function toFiniteNumber(raw, fallback) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function clampTrustTier(raw, fallback = 3) {
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

function normalizeSourceType(raw) {
  return SOURCE_TYPES.has(raw) ? raw : "wire";
}

function parseFeedList(rawFeeds) {
  if (!rawFeeds || typeof rawFeeds !== "string") {
    return DEFAULT_FEEDS;
  }

  const seen = new Set();
  const feeds = [];

  for (const value of rawFeeds.split(",")) {
    const feed = value.trim();
    if (!feed || seen.has(feed)) {
      continue;
    }

    seen.add(feed);
    feeds.push(feed);
  }

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

function normalizeFeedConfig(rawFeed) {
  const feedUrl = typeof rawFeed?.feedUrl === "string" ? rawFeed.feedUrl.trim() : "";
  const sourceType = normalizeSourceType(rawFeed?.sourceType);

  return {
    feedUrl,
    feedLabel: typeof rawFeed?.feedLabel === "string" && rawFeed.feedLabel.trim()
      ? rawFeed.feedLabel.trim()
      : buildFeedLabel(feedUrl),
    sourceType,
    regionTags: normalizeRegionTags(rawFeed?.regionTags),
    trustTier: clampTrustTier(rawFeed?.trustTier, sourceType === "wire" ? 3 : 4),
    firstHand: rawFeed?.firstHand === true,
    basePriority: toFiniteNumber(rawFeed?.basePriority, sourceType === "wire" ? 20 : 70)
  };
}

function fallbackFeedConfig(feedUrl) {
  return normalizeFeedConfig({
    feedUrl,
    feedLabel: buildFeedLabel(feedUrl),
    sourceType: "wire",
    regionTags: ["context"],
    trustTier: 3,
    firstHand: false,
    basePriority: 20
  });
}

function buildFeedCatalog(rawFeeds) {
  const requestedFeeds = parseFeedList(rawFeeds);
  const sourceByUrl = new Map(SOURCE_CATALOG.map((feed) => [feed.feedUrl, normalizeFeedConfig(feed)]));

  return requestedFeeds.map((feedUrl) => sourceByUrl.get(feedUrl) || fallbackFeedConfig(feedUrl));
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

function toItem({ title, link, source, published, guid, feed }) {
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
    feedUrl: feed.feedUrl,
    feedLabel: feed.feedLabel,
    sourceType: feed.sourceType,
    regionTags: [...feed.regionTags],
    trustTier: feed.trustTier,
    firstHand: feed.firstHand,
    basePriority: feed.basePriority
  };
}

function parseRss(xml, feed) {
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
        feed
      })
    )
    .filter(Boolean);
}

function parseAtom(xml, feed) {
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
        feed
      })
    )
    .filter(Boolean);
}

function parseFeed(xml, feed) {
  if (!xml || typeof xml !== "string") {
    return [];
  }

  if (/<rss\b/i.test(xml) || /<channel\b/i.test(xml)) {
    return parseRss(xml, feed);
  }

  if (/<feed\b/i.test(xml) && /<entry\b/i.test(xml)) {
    return parseAtom(xml, feed);
  }

  return [];
}

async function fetchOneFeed(feed, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(feed.feedUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
        "accept-language": "en-US,en;q=0.9"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    return parseFeed(xml, feed);
  } finally {
    clearTimeout(timer);
  }
}

function sourceClassRank(item) {
  const baseRank = SOURCE_TYPE_CLASS_ORDER[item.sourceType] ?? SOURCE_TYPE_CLASS_ORDER.wire;
  return baseRank - (item.firstHand ? FIRST_HAND_CLASS_BOOST : 0);
}

function dedupeAndSort(items) {
  const seenLinks = new Set();
  const seenTitleSource = new Set();
  const byRecency = [...items].sort((a, b) => b.publishedTs - a.publishedTs || b.basePriority - a.basePriority);
  const deduped = [];

  for (const item of byRecency) {
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
    deduped.push(item);
  }

  return deduped.sort((a, b) => {
    const classDiff = sourceClassRank(a) - sourceClassRank(b);
    if (classDiff !== 0) {
      return classDiff;
    }

    if (a.sourceType === b.sourceType) {
      if (b.publishedTs !== a.publishedTs) {
        return b.publishedTs - a.publishedTs;
      }
      if (b.basePriority !== a.basePriority) {
        return b.basePriority - a.basePriority;
      }
    }

    if (b.basePriority !== a.basePriority) {
      return b.basePriority - a.basePriority;
    }
    if (b.publishedTs !== a.publishedTs) {
      return b.publishedTs - a.publishedTs;
    }
    if (b.trustTier !== a.trustTier) {
      return b.trustTier - a.trustTier;
    }

    return a.id.localeCompare(b.id);
  });
}

function applySourceDiversity(items, limit) {
  if (items.length <= limit) {
    return items;
  }

  const perTypeCap = {
    official: Math.max(8, Math.floor(limit * 0.5)),
    osint_social: Math.max(8, Math.floor(limit * 0.35)),
    sensor: Math.max(4, Math.floor(limit * 0.2)),
    wire: Math.max(4, Math.floor(limit * 0.2))
  };

  const selected = [];
  const usedIds = new Set();
  const counts = { official: 0, osint_social: 0, sensor: 0, wire: 0 };

  for (const item of items) {
    const type = SOURCE_TYPES.has(item.sourceType) ? item.sourceType : "wire";
    if (selected.length >= limit) {
      break;
    }

    if (counts[type] >= perTypeCap[type]) {
      continue;
    }

    selected.push(item);
    usedIds.add(item.id);
    counts[type] += 1;
  }

  if (selected.length < limit) {
    for (const item of items) {
      if (selected.length >= limit) {
        break;
      }
      if (usedIds.has(item.id)) {
        continue;
      }
      selected.push(item);
      usedIds.add(item.id);
    }
  }

  return selected;
}

function feedSnapshot(feed) {
  return {
    feedUrl: feed.feedUrl,
    feedLabel: feed.feedLabel,
    sourceType: feed.sourceType,
    regionTags: [...feed.regionTags],
    trustTier: feed.trustTier,
    firstHand: feed.firstHand,
    basePriority: feed.basePriority
  };
}

function snapshotShape(items, refreshedAt, errors, limit, feeds) {
  return {
    refreshedAt: refreshedAt ? new Date(refreshedAt).toISOString() : null,
    count: Math.min(limit, items.length),
    feeds: feeds.map(feedSnapshot),
    items: items.slice(0, limit).map((item) => ({
      id: item.id,
      title: item.title,
      link: item.link,
      source: item.source,
      publishedAt: item.publishedAt,
      feedUrl: item.feedUrl,
      feedLabel: item.feedLabel,
      sourceType: item.sourceType,
      regionTags: [...item.regionTags],
      trustTier: item.trustTier,
      firstHand: item.firstHand,
      basePriority: item.basePriority
    })),
    errors
  };
}

export function createNewsService() {
  const refreshMs = toPositiveInteger(process.env.NEWS_REFRESH_MS, 120000);
  const maxItems = toPositiveInteger(process.env.NEWS_MAX_ITEMS, 1000);
  const fetchTimeoutMs = toPositiveInteger(process.env.NEWS_FETCH_TIMEOUT_MS, 7000);
  const cacheTtlMs = toPositiveInteger(process.env.NEWS_CACHE_TTL_MS, refreshMs);
  const feedCatalog = buildFeedCatalog(process.env.NEWS_FEEDS);
  const feedUrls = feedCatalog.map((feed) => feed.feedUrl);

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
      const results = await Promise.allSettled(feedCatalog.map((feed) => fetchOneFeed(feed, fetchTimeoutMs)));
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
          sourceType: feed.sourceType,
          firstHand: feed.firstHand,
          trustTier: feed.trustTier,
          message: result.reason?.message || "feed_fetch_failed"
        });
      }

      if (mergedItems.length > 0) {
        const nextItems = applySourceDiversity(dedupeAndSort(mergedItems), maxItems);
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
