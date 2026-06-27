import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(ROOT, "data");
const RUNTIME_DB_FILE = process.env.DATA_FILE || (process.env.VERCEL ? "/tmp/pronto-store.json" : join(DATA_DIR, "store.json"));
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.openai_api_key || "";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || process.env.youtube_data_api_key || "";

const SOURCE_TYPES = ["rss", "youtube", "reddit", "x"];
const POSITIVE = ["growth", "praised", "strong", "trusted", "win", "wins", "improve", "improved", "launch", "record", "safe", "resilient", "opportunity", "positive", "support", "approved", "profit", "partnership"];
const NEGATIVE = ["risk", "fraud", "scam", "lawsuit", "probe", "angry", "concern", "concerns", "decline", "outage", "breach", "boycott", "criticism", "negative", "threat", "crisis", "delay", "recall", "loss"];
const RISK_WORDS = ["fraud", "scam", "lawsuit", "probe", "breach", "boycott", "crisis", "recall", "misinformation", "rumor", "threat", "outage"];

const demoItems = [
  {
    id: "item-demo-1",
    sourceId: "src-rss-1",
    sourceType: "rss",
    title: "OpenAI announces enterprise governance controls for AI teams",
    text: "Enterprise customers praised the launch for improving trust, safety, and operational oversight across AI-native workflows.",
    author: "Tech Market Daily",
    url: "https://example.com/openai-governance",
    publishedAt: "2026-06-27T02:10:00.000Z",
    engagement: { score: 89, comments: 14 },
    bucket: "recent"
  },
  {
    id: "item-demo-2",
    sourceId: "src-rss-1",
    sourceType: "rss",
    title: "Analysts question whether AI spending can keep current pace",
    text: "Several analysts warned of margin pressure and execution risk as enterprise AI infrastructure costs rise.",
    author: "Business Ledger",
    url: "https://example.com/ai-spending-risk",
    publishedAt: "2026-06-26T19:20:00.000Z",
    engagement: { score: 76, comments: 33 },
    bucket: "top"
  },
  {
    id: "item-demo-3",
    sourceId: "src-youtube-1",
    sourceType: "youtube",
    title: "Comments on new AI assistant demo",
    text: "Users liked the workflow speed but raised concerns about privacy, pricing, and whether small teams can trust the recommendations.",
    author: "YouTube comments",
    url: "https://youtube.com/results?search_query=openai+enterprise+ai",
    publishedAt: "2026-06-26T11:00:00.000Z",
    engagement: { score: 142, comments: 98 },
    bucket: "top"
  },
  {
    id: "item-demo-4",
    sourceId: "src-reddit-1",
    sourceType: "reddit",
    title: "Founder discussion: AI ops tools are becoming table stakes",
    text: "The thread was broadly positive about productivity gains, while noting integration risk and vendor lock-in concerns.",
    author: "r/startups",
    url: "https://reddit.com/r/startups",
    publishedAt: "2026-06-25T22:00:00.000Z",
    engagement: { score: 118, comments: 61 },
    bucket: "top"
  }
];

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function defaultStore() {
  const runId = "run-demo-1";
  const itemInsights = demoItems.map(analyzeItem);
  const summary = summarizeRun(demoItems, itemInsights, "OpenAI");
  return {
    workspace: {
      id: "workspace-demo",
      name: "Pronto Workspace",
      profile: "Enterprise intelligence",
      openaiKeyConfigured: Boolean(OPENAI_API_KEY),
      youtubeKeyConfigured: Boolean(YOUTUBE_DATA_API_KEY),
      openaiKeyLast4: OPENAI_API_KEY ? OPENAI_API_KEY.slice(-4) : "",
      youtubeKeyLast4: YOUTUBE_DATA_API_KEY ? YOUTUBE_DATA_API_KEY.slice(-4) : ""
    },
    monitors: [
      {
        id: "monitor-openai",
        subject: "OpenAI",
        subjectType: "company",
        description: "Public sentiment around OpenAI as an AI-native organization and enterprise platform.",
        keywords: ["OpenAI", "ChatGPT", "enterprise AI", "AI agents"],
        aliases: ["ChatGPT", "OpenAI API"],
        excludedKeywords: [],
        intent: "Brand reputation",
        region: "Global",
        scanSettings: { recentCount: 20, topCount: 20, frequency: "manual" },
        sourceIds: ["src-rss-1", "src-youtube-1", "src-reddit-1", "src-x-1"],
        latestRunId: runId,
        createdAt: now()
      }
    ],
    sources: [
      {
        id: "src-rss-1",
        monitorId: "monitor-openai",
        type: "rss",
        name: "OpenAI News RSS",
        url: "https://news.google.com/rss/search?q=OpenAI+OR+ChatGPT&hl=en-US&gl=US&ceid=US:en",
        status: "active",
        lastFetchedAt: now(),
        itemCount: 4,
        health: "real-time",
        error: ""
      },
      {
        id: "src-youtube-1",
        monitorId: "monitor-openai",
        type: "youtube",
        name: "YouTube Search: enterprise AI",
        url: "youtube:openai enterprise ai",
        status: YOUTUBE_DATA_API_KEY ? "active" : "mocked",
        lastFetchedAt: now(),
        itemCount: 1,
        health: YOUTUBE_DATA_API_KEY ? "validated" : "simulated",
        error: YOUTUBE_DATA_API_KEY ? "" : "YouTube Data API key not configured"
      },
      {
        id: "src-reddit-1",
        monitorId: "monitor-openai",
        type: "reddit",
        name: "Reddit: r/startups",
        url: "reddit:r/startups OpenAI",
        status: "planned",
        lastFetchedAt: now(),
        itemCount: 1,
        health: "planned",
        error: ""
      },
      {
        id: "src-x-1",
        monitorId: "monitor-openai",
        type: "x",
        name: "X Search: OpenAI enterprise",
        url: "x:OpenAI enterprise AI",
        status: "planned",
        lastFetchedAt: "",
        itemCount: 0,
        health: "requires API access",
        error: ""
      }
    ],
    items: demoItems,
    runs: [
      {
        id: runId,
        monitorId: "monitor-openai",
        status: "complete",
        startedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        completedAt: now(),
        sourceCoverage: [
          { sourceId: "src-rss-1", collected: 2, status: "complete" },
          { sourceId: "src-youtube-1", collected: 1, status: "mocked" },
          { sourceId: "src-reddit-1", collected: 1, status: "mocked" },
          { sourceId: "src-x-1", collected: 0, status: "planned" }
        ],
        itemIds: demoItems.map((item) => item.id),
        itemInsights,
        summary
      }
    ],
    reports: [],
    alerts: [
      {
        id: "alert-1",
        monitorId: "monitor-openai",
        name: "High-engagement negative item",
        trigger: "negative sentiment with engagement score above 100",
        status: "active",
        lastTriggeredAt: "2026-06-26T19:20:00.000Z"
      },
      {
        id: "alert-2",
        monitorId: "monitor-openai",
        name: "Source failure",
        trigger: "RSS or API source reports an error",
        status: "active",
        lastTriggeredAt: ""
      }
    ]
  };
}

function safeWorkspace(workspace) {
  const { openaiApiKey, youtubeApiKey, ...safe } = workspace;
  return safe;
}

function liveApiKey() {
  return OPENAI_API_KEY || "";
}

function runtimeWorkspace(workspace = {}) {
  return {
    ...workspace,
    openaiKeyConfigured: Boolean(OPENAI_API_KEY),
    youtubeKeyConfigured: Boolean(YOUTUBE_DATA_API_KEY),
    openaiKeyLast4: OPENAI_API_KEY ? OPENAI_API_KEY.slice(-4) : workspace.openaiKeyLast4 || "",
    youtubeKeyLast4: YOUTUBE_DATA_API_KEY ? YOUTUBE_DATA_API_KEY.slice(-4) : workspace.youtubeKeyLast4 || ""
  };
}

async function ensureStore() {
  await mkdir(dirname(RUNTIME_DB_FILE), { recursive: true });
  if (!existsSync(RUNTIME_DB_FILE)) {
    await saveStore(defaultStore());
  }
}

async function loadStore() {
  await ensureStore();
  return JSON.parse(await readFile(RUNTIME_DB_FILE, "utf8"));
}

async function saveStore(store) {
  await mkdir(dirname(RUNTIME_DB_FILE), { recursive: true });
  await writeFile(RUNTIME_DB_FILE, JSON.stringify(store, null, 2));
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function stripTags(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return stripTags(match?.[1] || "");
}

function sourceDisplay(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.split(":")[0] || "Source";
  }
}

async function fetchRssSource(source, monitor) {
  const response = await fetch(source.url, {
    headers: { "user-agent": "Pronto Hackathon Prototype/1.0" },
    signal: AbortSignal.timeout(10000)
  });
  const xml = await response.text();
  if (!response.ok) throw rssFetchError(response, xml);
  if (!/<(rss|feed)\b/i.test(xml)) throw rssFetchError(response, xml, "URL did not return RSS or Atom XML");
  const blocks = [...xml.matchAll(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const recent = blocks.slice(0, monitor.scanSettings.recentCount || 20);
  const mapped = recent.map((block, index) => {
    const title = extractTag(block, "title") || `${source.name} item ${index + 1}`;
    const text = extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content") || title;
    const link = extractTag(block, "link") || (block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? source.url);
    const publishedAt = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated") || now();
    const relevance = relevanceScore(`${title} ${text}`, monitor);
    return {
      id: id("item"),
      sourceId: source.id,
      sourceType: "rss",
      title,
      text,
      author: sourceDisplay(source.url),
      url: link,
      publishedAt: Number.isNaN(Date.parse(publishedAt)) ? now() : new Date(publishedAt).toISOString(),
      engagement: { score: Math.max(12, relevance + 30 - index), comments: 0 },
      relevanceScore: relevance,
      bucket: index < 20 ? "recent" : "top"
    };
  });
  const relevant = mapped.filter((item) => item.relevanceScore >= 18);
  const selected = relevant.length ? relevant : mapped.slice(0, Math.min(5, mapped.length));
  const top = [...selected].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, monitor.scanSettings.topCount || 20);
  return uniqueItems([...selected, ...top]);
}

async function probeRssUrl(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Pronto Hackathon Prototype/1.0" },
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.text();
  if (!response.ok) throw rssFetchError(response, body);
  if (!/<(rss|feed)\b/i.test(body)) throw rssFetchError(response, body, "URL did not return RSS or Atom XML");
  const count = [...body.matchAll(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi)].length;
  return { count };
}

function rssFetchError(response, body = "", fallback = "") {
  const wafAction = response.headers.get("x-amzn-waf-action");
  const captcha = wafAction === "captcha" || /Human Verification|captcha-container|AWSWafIntegration/i.test(body);
  if (captcha) {
    return new Error(`Blocked by AWS WAF CAPTCHA (HTTP ${response.status}). This feed requires human verification from the server environment.`);
  }
  return new Error(fallback || `RSS returned HTTP ${response.status}`);
}

function mockItemsForSource(source, monitor) {
  const subject = monitor.subject;
  const templates = {
    youtube: [
      ["YouTube comments show cautious optimism", `Viewers are positive about ${subject}'s latest announcements, but privacy and pricing concerns keep appearing in high-liked comments.`],
      ["Creator analysis drives debate", `A popular analyst video triggered mixed responses: supporters praised product speed while critics questioned whether the roadmap is trustworthy.`]
    ],
    reddit: [
      ["Reddit thread highlights adoption friction", `Operators say ${subject} is useful for repeated workflows, while skeptics flag vendor lock-in and support quality as risks.`],
      ["Community compares alternatives", `The discussion is mixed, with positive sentiment around capability and negative sentiment around cost.`]
    ],
    x: [
      ["X search shows fast-moving rumor cluster", `Short posts are amplifying an unverified claim about ${subject}; confidence is low until stronger sources confirm it.`]
    ]
  };
  return (templates[source.type] || []).map(([title, text], index) => ({
    id: id("item"),
    sourceId: source.id,
    sourceType: source.type,
    title,
    text,
    author: source.name,
    url: source.url.startsWith("http") ? source.url : `https://example.com/${source.type}/${encodeURIComponent(subject)}`,
    publishedAt: new Date(Date.now() - index * 1000 * 60 * 72).toISOString(),
    engagement: { score: 70 + index * 24, comments: 18 + index * 12 },
    bucket: index === 0 ? "recent" : "top"
  }));
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.sourceId}:${item.url}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function relevanceScore(text, monitor) {
  const haystack = normalizeText(text);
  const terms = [monitor.subject, ...(monitor.keywords || []), ...(monitor.aliases || [])].filter(Boolean).map(normalizeText).filter(Boolean);
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      score += 30;
      continue;
    }
    const parts = term.split(" ").filter((part) => part.length > 2);
    if (parts.some((part) => haystack.includes(part))) score += 8;
  }
  return score;
}

function normalizeText(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function analyzeItem(item) {
  const text = `${item.title} ${item.text}`.toLowerCase();
  const pos = POSITIVE.filter((word) => text.includes(word)).length;
  const neg = NEGATIVE.filter((word) => text.includes(word)).length;
  let sentiment = "neutral";
  if (pos > neg) sentiment = "positive";
  if (neg > pos) sentiment = "negative";
  if (pos > 0 && neg > 0 && Math.abs(pos - neg) <= 1) sentiment = "mixed";
  const risks = RISK_WORDS.filter((word) => text.includes(word));
  const themes = inferThemes(text);
  return {
    itemId: item.id,
    sentiment,
    relevance: Math.min(98, item.relevanceScore || item.engagement.score + themes.length * 4),
    themes,
    riskFlags: risks,
    summary: summarizeItem(item, sentiment, themes),
    whyItMatters: whyItMatters(item, sentiment, risks)
  };
}

function inferThemes(text) {
  const themes = [];
  if (/trust|safe|safety|governance|privacy|secure/.test(text)) themes.push("Trust and safety");
  if (/price|cost|margin|spending|profit|revenue/.test(text)) themes.push("Commercial pressure");
  if (/launch|product|roadmap|feature|workflow|agent/.test(text)) themes.push("Product momentum");
  if (/fraud|scam|misinformation|rumor|claim/.test(text)) themes.push("Credibility risk");
  if (/\bf1\b|race|racing|driver|podium|gp|grand prix|lap|qualifying|pit stop|race pace/.test(text)) themes.push("Race performance");
  return themes.length ? themes.slice(0, 3) : ["General reputation"];
}

function summarizeItem(item, sentiment, themes) {
  return `${item.author} reads as ${sentiment}; main themes are ${themes.join(", ")}.`;
}

function whyItMatters(item, sentiment, risks) {
  if (risks.length) return `This item carries reputational risk because it mentions ${risks.slice(0, 3).join(", ")}.`;
  if (sentiment === "positive") return "This item can reinforce positive positioning and source credibility.";
  if (sentiment === "negative") return "This item may need monitoring because negative framing can spread across sources.";
  return "This item adds context and helps calibrate the overall public narrative.";
}

function summarizeRun(items, insights, subject) {
  const counts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  insights.forEach((insight) => counts[insight.sentiment] += 1);
  const total = Math.max(1, insights.length);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const overallSentiment = sorted[0][0] === "neutral" && sorted[1]?.[1] > 0 ? "mixed" : sorted[0][0];
  const positiveItems = items.filter((item, index) => insights[index]?.sentiment === "positive").slice(0, 3).map((item) => clipHeadline(item.title));
  const negativeItems = items.filter((item, index) => insights[index]?.sentiment === "negative").slice(0, 3).map((item) => clipHeadline(item.title));
  const recentTitles = items.filter((item) => item.bucket === "recent").slice(0, 3).map((item) => clipHeadline(item.title));
  const topTitles = items.filter((item) => item.bucket === "top").slice(0, 3).map((item) => clipHeadline(item.title));
  const themes = topTerms(insights.flatMap((insight) => insight.themes), 5).map(([name, count]) => ({
    name,
    count,
    sentiment: dominantSentiment(insights.filter((insight) => insight.themes.includes(name)))
  }));
  const risks = topTerms(insights.flatMap((insight) => insight.riskFlags), 4).map(([name]) => name);
  const confidence = Math.min(95, 62 + Math.round(total * 4) + (items.some((item) => item.sourceType === "rss") ? 8 : 0));
  const sourceBreakdown = SOURCE_TYPES.map((type) => {
    const scopedItems = items.filter((item) => item.sourceType === type);
    const scopedInsights = insights.filter((insight) => scopedItems.some((item) => item.id === insight.itemId));
    return { type, count: scopedItems.length, sentiment: scopedInsights.length ? dominantSentiment(scopedInsights) : "none" };
  });
  return {
    overallSentiment,
    confidence,
    distribution: counts,
    executiveSummary: composeExecutiveSummary({ subject, overallSentiment, counts, items, positiveItems, negativeItems, themes, risks }),
    whatChanged: `Recent items are led by ${recentTitles.join("; ") || "the newest matches"}, while top-ranked items emphasize ${topTitles.join("; ") || "the strongest matches"}.`,
    themes,
    risks: risks.length ? risks.map((risk) => `${risk[0].toUpperCase()}${risk.slice(1)} mentions are present in high-relevance evidence.`) : ["No concentrated crisis signal detected."],
    opportunities: [
      "Use positive enterprise and workflow commentary in stakeholder updates.",
      "Add more primary RSS feeds to improve source diversity.",
      "Track YouTube comments if API access is enabled for richer public reaction."
    ],
    recommendedActions: [
      "Review high-relevance negative evidence before external messaging.",
      "Add at least two independent RSS feeds for triangulation.",
      "Create an alert for negative sentiment plus high engagement."
    ],
    recommendedSources: recommendSources(subject),
    sourceBreakdown,
    generatedBy: "heuristic"
  };
}

async function summarizeRunWithOpenAI({ apiKey, monitor, items, insights, heuristicSummary }) {
  const payload = {
    monitor: {
      subject: monitor.subject,
      subjectType: monitor.subjectType,
      intent: monitor.intent,
      region: monitor.region,
      keywords: monitor.keywords,
      aliases: monitor.aliases
    },
    counts: heuristicSummary.distribution,
    matchedItems: items.map((item, index) => ({
      index: index + 1,
      title: clipHeadline(item.title, 14),
      sourceType: item.sourceType,
      author: item.author,
      bucket: item.bucket,
      publishedAt: item.publishedAt,
      url: item.url,
      sentiment: insights[index]?.sentiment,
      relevance: insights[index]?.relevance,
      themes: insights[index]?.themes,
      riskFlags: insights[index]?.riskFlags,
      text: String(item.text || "").slice(0, 350)
    }))
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You write concise situational summaries for an OSINT monitoring dashboard. Return only valid JSON with keys: overallSentiment, confidence, executiveSummary, whatChanged, themes, risks, opportunities, recommendedActions. Use short, readable prose. Do not mention that you are an AI. Do not include markdown."
        },
        {
          role: "user",
          content: `Create a situational summary from this monitoring payload:\n${JSON.stringify(payload)}\n\nRules:\n- overallSentiment must be one of positive, neutral, negative, mixed.\n- confidence must be an integer 0-100.\n- themes must be an array of objects with name, count, sentiment.\n- risks, opportunities, and recommendedActions must be arrays of short strings.\n- executiveSummary should be 2-4 crisp sentences and should reference the most important matched items and themes.\n- whatChanged should briefly compare recent versus top items.\n- Use the full matched item set, not a handful of examples.`
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI summary request failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty summary");

  const parsed = JSON.parse(content);
  return {
    overallSentiment: parsed.overallSentiment || heuristicSummary.overallSentiment,
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : heuristicSummary.confidence,
    distribution: heuristicSummary.distribution,
    executiveSummary: String(parsed.executiveSummary || heuristicSummary.executiveSummary).trim(),
    whatChanged: String(parsed.whatChanged || heuristicSummary.whatChanged).trim(),
    themes: normalizeThemes(Array.isArray(parsed.themes) && parsed.themes.length ? parsed.themes.slice(0, 5) : heuristicSummary.themes, insights),
    risks: Array.isArray(parsed.risks) && parsed.risks.length ? parsed.risks.slice(0, 5) : heuristicSummary.risks,
    opportunities: Array.isArray(parsed.opportunities) && parsed.opportunities.length ? parsed.opportunities.slice(0, 5) : heuristicSummary.opportunities,
    recommendedActions: Array.isArray(parsed.recommendedActions) && parsed.recommendedActions.length ? parsed.recommendedActions.slice(0, 5) : heuristicSummary.recommendedActions,
    recommendedSources: heuristicSummary.recommendedSources,
    sourceBreakdown: heuristicSummary.sourceBreakdown,
    generatedBy: "openai",
    model: OPENAI_MODEL
  };
}

function composeExecutiveSummary({ subject, overallSentiment, counts, items, positiveItems, negativeItems, themes, risks }) {
  const clauses = [
    `${subject} is currently showing ${overallSentiment} public sentiment across ${items.length} matched items.`
  ];
  const distribution = [
    counts.positive ? `${counts.positive} positive` : "",
    counts.negative ? `${counts.negative} negative` : "",
    counts.mixed ? `${counts.mixed} mixed` : ""
  ].filter(Boolean);
  if (distribution.length) clauses.push(`Coverage breaks down as ${distribution.join(", ")}.`);
  if (positiveItems.length) clauses.push(`Positive coverage includes ${positiveItems.join("; ")}.`);
  if (negativeItems.length) clauses.push(`Negative coverage includes ${negativeItems.join("; ")}.`);
  if (themes.length) clauses.push(`The strongest themes are ${themes.slice(0, 3).map((theme) => (theme?.name || theme).toString().toLowerCase()).join(", ")}.`);
  clauses.push(risks.length ? `Risk language around ${risks.join(", ")} should be watched closely.` : "No severe risk cluster dominates the current sample.");
  return clauses.join(" ");
}

function topTerms(values, limit) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function normalizeThemes(themes, fallbackInsights = []) {
  if (!Array.isArray(themes)) return [];
  return themes
    .map((theme) => {
      if (typeof theme === "string") {
        return {
          name: theme,
          count: 1,
          sentiment: dominantSentiment(fallbackInsights)
        };
      }
      if (!theme || typeof theme !== "object") return null;
      return {
        name: String(theme.name || theme.theme || "Theme").trim(),
        count: Number.isFinite(Number(theme.count)) ? Number(theme.count) : 1,
        sentiment: ["positive", "neutral", "mixed", "negative"].includes(theme.sentiment) ? theme.sentiment : dominantSentiment(fallbackInsights)
      };
    })
    .filter(Boolean)
    .filter((theme) => theme.name);
}

function clipHeadline(title, maxWords = 8) {
  const cleaned = String(title)
    .split(/\s(?:-|—|\|)\s/)
    .shift()
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ");
  return words.length <= maxWords ? cleaned : `${words.slice(0, maxWords).join(" ")}…`;
}

function dominantSentiment(insights) {
  const counts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  insights.forEach((insight) => counts[insight.sentiment] += 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function recommendSources(subject) {
  const q = encodeURIComponent(subject);
  return [
    { type: "rss", name: "Google News RSS", url: `https://news.google.com/rss/search?q=${q}`, reason: "Broad recent news coverage for the monitored subject." },
    { type: "rss", name: "Bing News RSS", url: `https://www.bing.com/news/search?q=${q}&format=rss`, reason: "Second news index for cross-checking sentiment drift." },
    { type: "youtube", name: "YouTube search query", url: `youtube:${subject} review OR reaction`, reason: "High-signal comments and creator reaction." },
    { type: "reddit", name: "Reddit search query", url: `reddit:${subject}`, reason: "Discussion-heavy public sentiment." },
    { type: "x", name: "X search query", url: `x:${subject} lang:en`, reason: "Fast-moving rumor and breaking narrative detection." }
  ];
}

async function runScan(store, monitorId) {
  const monitor = store.monitors.find((entry) => entry.id === monitorId);
  if (!monitor) throw new Error("Monitor not found");
  const sources = store.sources.filter((source) => source.monitorId === monitorId);
  const run = {
    id: id("run"),
    monitorId,
    status: "running",
    startedAt: now(),
    completedAt: "",
    sourceCoverage: [],
    itemIds: [],
    itemInsights: [],
    summary: null
  };
  store.runs.unshift(run);
  const collected = [];
  for (const source of sources) {
    try {
      let items = [];
      if (source.type === "rss" && source.url.startsWith("http")) {
        items = await fetchRssSource(source, monitor);
        source.status = "active";
        source.health = "real-time";
        source.error = "";
      } else {
        items = mockItemsForSource(source, monitor);
        source.status = source.type === "youtube" ? "mocked" : "planned";
        source.health = source.type === "youtube" ? "simulated" : "planned";
      }
      source.lastFetchedAt = now();
      source.itemCount = items.length;
      collected.push(...items);
      run.sourceCoverage.push({ sourceId: source.id, collected: items.length, status: source.status });
    } catch (error) {
      source.status = "error";
      source.error = error.message;
      source.lastFetchedAt = now();
      run.sourceCoverage.push({ sourceId: source.id, collected: 0, status: "error", error: error.message });
    }
  }
  const unique = uniqueItems(collected).slice(0, 40);
  const insights = unique.map(analyzeItem);
  store.items = [...unique, ...store.items.filter((item) => !unique.some((fresh) => fresh.sourceId === item.sourceId && fresh.url === item.url))].slice(0, 200);
  run.status = "complete";
  run.completedAt = now();
  run.itemIds = unique.map((item) => item.id);
  run.itemInsights = insights;
  const heuristicSummary = summarizeRun(unique, insights, monitor.subject);
  const apiKey = liveApiKey();
  if (apiKey) {
    try {
      run.summary = await summarizeRunWithOpenAI({
        apiKey,
        monitor,
        items: unique,
        insights,
        heuristicSummary
      });
    } catch (error) {
      run.summary = {
        ...heuristicSummary,
        generatedBy: "heuristic-fallback",
        summaryError: error.message
      };
    }
  } else {
    run.summary = heuristicSummary;
  }
  monitor.latestRunId = run.id;
  return run;
}

function buildMonitorPayload(store, monitorId = "monitor-openai") {
  const monitor = store.monitors.find((entry) => entry.id === monitorId) || store.monitors[0];
  const sources = store.sources.filter((source) => source.monitorId === monitor.id);
  const latestRun = store.runs.find((run) => run.id === monitor.latestRunId) || store.runs[0];
  const items = latestRun ? store.items.filter((item) => latestRun.itemIds.includes(item.id)) : [];
  return {
    workspace: safeWorkspace(runtimeWorkspace(store.workspace)),
    monitors: store.monitors,
    monitor,
    sources,
    latestRun,
    items,
    alerts: store.alerts.filter((alert) => alert.monitorId === monitor.id),
    reports: store.reports.filter((report) => report.monitorId === monitor.id)
  };
}

async function handleApi(req, res, url) {
  const store = await loadStore();
  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    return json(res, 200, buildMonitorPayload(store, url.searchParams.get("monitorId") || undefined));
  }
  if (req.method === "POST" && url.pathname === "/api/settings") {
    const body = await readJson(req);
    if (typeof body.workspaceName === "string" && body.workspaceName.trim()) {
      store.workspace.name = body.workspaceName.trim();
    }
    if (body.recentCount || body.topCount) {
      const monitor = store.monitors[0];
      if (monitor) {
        monitor.scanSettings.recentCount = Math.max(1, Number(body.recentCount || monitor.scanSettings.recentCount || 20));
        monitor.scanSettings.topCount = Math.max(1, Number(body.topCount || monitor.scanSettings.topCount || 20));
      }
    }
    await saveStore(store);
    return json(res, 200, {
      workspace: safeWorkspace(runtimeWorkspace(store.workspace)),
      monitor: store.monitors[0] || null
    });
  }
  if (req.method === "POST" && url.pathname === "/api/demo/reset") {
    const fresh = defaultStore();
    await saveStore(fresh);
    return json(res, 200, buildMonitorPayload(fresh));
  }
  if (req.method === "POST" && url.pathname === "/api/monitors") {
    const body = await readJson(req);
    const monitor = {
      id: id("monitor"),
      subject: body.subject || "New Monitor",
      subjectType: body.subjectType || "company",
      description: body.description || "",
      keywords: body.keywords || [],
      aliases: body.aliases || [],
      excludedKeywords: body.excludedKeywords || [],
      intent: body.intent || "Brand reputation",
      region: body.region || "Global",
      scanSettings: { recentCount: 20, topCount: 20, frequency: "manual", ...(body.scanSettings || {}) },
      sourceIds: [],
      latestRunId: "",
      createdAt: now()
    };
    store.monitors.unshift(monitor);
    await saveStore(store);
    return json(res, 201, { monitor });
  }
  if (req.method === "POST" && url.pathname === "/api/sources") {
    const body = await readJson(req);
    if (!SOURCE_TYPES.includes(body.type)) return json(res, 400, { error: "Unsupported source type" });
    const monitor = store.monitors.find((entry) => entry.id === body.monitorId);
    if (!monitor) return json(res, 404, { error: "Monitor not found" });
    const source = {
      id: id("src"),
      monitorId: monitor.id,
      type: body.type,
      name: body.name || `${body.type.toUpperCase()} Source`,
      url: body.url || "",
      status: body.type === "rss" ? "pending" : "planned",
      lastFetchedAt: "",
      itemCount: 0,
      health: body.type === "rss" ? "pending validation" : "planned",
      error: ""
    };
    if (source.type === "rss" && source.url.startsWith("http")) {
      source.lastFetchedAt = now();
      try {
        const probe = await probeRssUrl(source.url);
        source.status = "active";
        source.health = "validated";
        source.itemCount = probe.count;
      } catch (error) {
        source.status = "error";
        source.health = "blocked or invalid";
        source.error = error.message;
      }
    }
    store.sources.unshift(source);
    monitor.sourceIds.push(source.id);
    await saveStore(store);
    return json(res, 201, { source });
  }
  if (req.method === "POST" && url.pathname === "/api/recommendations") {
    const body = await readJson(req);
    return json(res, 200, { recommendations: recommendSources(body.subject || "OpenAI") });
  }
  if (req.method === "POST" && url.pathname === "/api/scans") {
    const body = await readJson(req);
    const run = await runScan(store, body.monitorId || "monitor-openai");
    await saveStore(store);
    return json(res, 200, { run, payload: buildMonitorPayload(store, body.monitorId || "monitor-openai") });
  }
  if (req.method === "POST" && url.pathname === "/api/reports") {
    const body = await readJson(req);
    const payload = buildMonitorPayload(store, body.monitorId || "monitor-openai");
    const report = {
      id: id("report"),
      monitorId: payload.monitor.id,
      title: `${payload.monitor.subject} sentiment report`,
      createdAt: now(),
      markdown: renderReport(payload)
    };
    store.reports.unshift(report);
    await saveStore(store);
    return json(res, 201, { report });
  }
  return json(res, 404, { error: "Not found" });
}

function renderReport(payload) {
  const summary = payload.latestRun.summary;
  const evidence = payload.items.slice(0, 8).map((item) => `- [${item.title}](${item.url}) — ${item.author}`).join("\n");
  return `# ${payload.monitor.subject} Sentiment Report\n\nGenerated: ${now()}\n\n## Executive Summary\n${summary.executiveSummary}\n\n## Themes\n${summary.themes.map((theme) => `- ${theme.name}: ${theme.sentiment}`).join("\n")}\n\n## Risks\n${summary.risks.map((risk) => `- ${risk}`).join("\n")}\n\n## Recommended Actions\n${summary.recommendedActions.map((action) => `- ${action}`).join("\n")}\n\n## Evidence\n${evidence}\n`;
}

async function serveStatic(req, res, url) {
  const target = url.pathname === "/" ? "/index.html" : url.pathname;
  const path = normalize(join(PUBLIC_DIR, target));
  if (!path.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await readFile(path);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml"
    }[extname(path)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(data);
  } catch {
    const data = await readFile(join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(data);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Pronto running at http://localhost:${PORT}`);
});
