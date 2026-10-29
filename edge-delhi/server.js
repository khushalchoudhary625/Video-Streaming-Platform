require("dotenv").config();
const express = require("express");
const cors = require("cors");
const CacheManager = require("./cacheManager");

const app = express();

const PORT = parseInt(process.env.PORT || 4001, 10);
const EDGE_NAME = process.env.EDGE_NAME || "Delhi";
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:5000";
const CACHE_DIR = process.env.CACHE_DIR || "./cache";
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || 86400, 10);
const MAX_CACHE_SIZE_MB = parseInt(process.env.MAX_CACHE_SIZE_MB || 1024, 10);
const ORIGIN_TIMEOUT_MS = parseInt(process.env.ORIGIN_TIMEOUT_MS || 20000, 10);

const cacheManager = new CacheManager({
  edgeName: EDGE_NAME,
  originUrl: ORIGIN_URL,
  cacheDir: CACHE_DIR,
  ttlSeconds: CACHE_TTL_SECONDS,
  maxCacheSizeMB: MAX_CACHE_SIZE_MB,
  originTimeoutMs: ORIGIN_TIMEOUT_MS
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/videos/")) {
      console.log(`[${EDGE_NAME}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Root welcome & info route
app.get("/", (req, res) => {
  res.json({
    name: `StreamCloud CDN Edge Server (${EDGE_NAME} Node)`,
    edge: EDGE_NAME,
    port: PORT,
    originUrl: ORIGIN_URL,
    status: "online",
    endpoints: {
      health: "/health",
      videoDelivery: "/videos/:filename",
      cacheInfo: "/cache"
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  const cacheInfo = cacheManager.getCacheInfo();
  const uptimeSeconds = Math.round(process.uptime());

  res.json({
    status: "healthy",
    edge: EDGE_NAME,
    port: PORT,
    origin: ORIGIN_URL,
    uptimeSeconds,
    cache: {
      cachedFiles: cacheInfo.cachedFilesCount,
      totalCacheSizeBytes: cacheInfo.totalSizeBytes,
      totalCacheSizeMB: cacheInfo.totalSizeMB,
      ttlSeconds: CACHE_TTL_SECONDS,
      maxCacheSizeMB: MAX_CACHE_SIZE_MB
    },
    metrics: {
      cacheHits: cacheManager.stats.hits,
      cacheMisses: cacheManager.stats.misses,
      originFetches: cacheManager.stats.originFetches,
      bytesServedMB: (cacheManager.stats.bytesServed / (1024 * 1024)).toFixed(2),
      hitRatio: cacheManager.stats.hits + cacheManager.stats.misses > 0
        ? `${((cacheManager.stats.hits / (cacheManager.stats.hits + cacheManager.stats.misses)) * 100).toFixed(1)}%`
        : "0.0%"
    },
    system: {
      nodeVersion: process.version,
      memoryUsageMB: (process.memoryUsage().rss / (1024 * 1024)).toFixed(2)
    }
  });
});

// Video delivery endpoint (Compatible with origin /videos/:filename)
app.get("/videos/:filename", async (req, res) => {
  const rawFilename = req.params.filename;
  const filename = cacheManager.sanitizeFilename(rawFilename);

  if (!filename) {
    console.warn(`[${EDGE_NAME}] [SECURITY ALERT] Rejected invalid or unsafe filename: "${rawFilename}"`);
    return res.status(400).json({
      error: "Invalid or unsafe video filename.",
      edge: EDGE_NAME
    });
  }

  // 1. Check local cache
  if (cacheManager.isCached(filename)) {
    cacheManager.stats.hits++;
    console.log(`[CACHE HIT] [${EDGE_NAME}] Video served from local cache: ${filename}`);
    return cacheManager.serveVideoWithRange(req, res, filename, "HIT");
  }

  // 2. Cache Miss: Fetch from Origin server
  cacheManager.stats.misses++;
  console.log(`[CACHE MISS] [${EDGE_NAME}] Video not in local cache: ${filename}. Fetching from origin: ${ORIGIN_URL}/videos/${filename}`);

  const fetchResult = await cacheManager.fetchFromOriginAndCache(filename);

  if (!fetchResult.success) {
    cacheManager.stats.errors++;
    const status = fetchResult.statusCode || 502;
    return res.status(status).json({
      error: fetchResult.error || "Failed to fetch video from origin server",
      edge: EDGE_NAME,
      origin: ORIGIN_URL,
      statusCode: status
    });
  }

  // 3. Serve newly cached video directly
  return cacheManager.serveVideoWithRange(req, res, filename, "MISS");
});

// Inspect cache content
app.get("/cache", (req, res) => {
  const cacheInfo = cacheManager.getCacheInfo();
  res.json({
    edge: EDGE_NAME,
    cacheDir: cacheManager.cacheDir,
    ...cacheInfo
  });
});

// Purge cache (useful for testing and reset)
app.delete("/cache", (req, res) => {
  const deletedCount = cacheManager.purgeCache();
  console.log(`[${EDGE_NAME}] Cache purged: ${deletedCount} files removed`);
  res.json({
    edge: EDGE_NAME,
    message: "Cache successfully purged",
    deletedFiles: deletedCount
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found on this Edge Server",
    edge: EDGE_NAME
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${EDGE_NAME}] Unhandled Server Error:`, err);
  res.status(500).json({
    error: err.message || "Internal Edge Server Error",
    edge: EDGE_NAME
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  StreamCloud CDN Edge Server - ${EDGE_NAME} Node`);
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`  Origin URL: ${ORIGIN_URL}`);
  console.log(`  Cache Dir:  ${cacheManager.cacheDir}`);
  console.log(`  TTL:        ${CACHE_TTL_SECONDS}s | Max Size: ${MAX_CACHE_SIZE_MB}MB`);
  console.log(`====================================================`);
});
