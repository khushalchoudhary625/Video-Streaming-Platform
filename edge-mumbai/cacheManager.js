const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

class CacheManager {
  constructor(config = {}) {
    this.edgeName = config.edgeName || "Mumbai";
    this.originUrl = (config.originUrl || "http://localhost:5000").replace(/\/+$/, "");
    this.cacheDir = path.resolve(config.cacheDir || "./cache");
    this.ttlSeconds = parseInt(config.ttlSeconds || 86400, 10);
    this.maxCacheSizeMB = parseInt(config.maxCacheSizeMB || 1024, 10);
    this.originTimeoutMs = parseInt(config.originTimeoutMs || 20000, 10);

    // In-flight download deduplication: filename -> Promise<{ success, error, statusCode }>
    this.inFlightFetches = new Map();

    // Stats counters
    this.stats = {
      hits: 0,
      misses: 0,
      bytesServed: 0,
      originFetches: 0,
      errors: 0
    };

    this.ensureCacheDir();
    this.cleanupOrphanedTempFiles();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log(`[${this.edgeName}] Created local cache directory: ${this.cacheDir}`);
    }
  }

  cleanupOrphanedTempFiles() {
    try {
      if (!fs.existsSync(this.cacheDir)) return;
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.startsWith(".tmp-")) {
          const tempPath = path.join(this.cacheDir, file);
          try {
            fs.unlinkSync(tempPath);
            console.log(`[${this.edgeName}] Cleaned up leftover temporary file: ${file}`);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (err) {
      console.warn(`[${this.edgeName}] Error cleaning temp files:`, err.message);
    }
  }

  /**
   * Strictly sanitize and validate video filename against path traversal
   */
  sanitizeFilename(rawFilename) {
    if (!rawFilename || typeof rawFilename !== "string") {
      return null;
    }

    let decoded;
    try {
      decoded = decodeURIComponent(rawFilename);
    } catch (e) {
      decoded = rawFilename;
    }

    if (decoded.includes("..") || decoded.includes("/") || decoded.includes("\\") || decoded.includes("\0")) {
      return null;
    }

    const base = path.basename(decoded);
    if (!/^[a-zA-Z0-9_\-.]+$/.test(base)) {
      return null;
    }

    const ext = path.extname(base).toLowerCase();
    const validExtensions = [".mp4", ".webm", ".ogg", ".mov", ".mkv"];
    if (!validExtensions.includes(ext)) {
      return null;
    }

    return base;
  }

  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".ogg": "video/ogg",
      ".mov": "video/quicktime",
      ".mkv": "video/x-matroska"
    };
    return mimeMap[ext] || "application/octet-stream";
  }

  getFilePath(filename) {
    return path.join(this.cacheDir, filename);
  }

  /**
   * Check if video exists in cache and is within TTL
   */
  isCached(filename) {
    const filePath = this.getFilePath(filename);
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        fs.unlinkSync(filePath);
        return false;
      }

      if (this.ttlSeconds > 0) {
        const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;
        if (ageSeconds > this.ttlSeconds) {
          console.log(`[${this.edgeName}] [CACHE EXPIRED] ${filename} age (${Math.round(ageSeconds)}s) exceeded TTL (${this.ttlSeconds}s)`);
          fs.unlinkSync(filePath);
          return false;
        }
      }

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Fetch video from Origin server and store atomically in cache
   */
  async fetchFromOriginAndCache(filename) {
    if (this.inFlightFetches.has(filename)) {
      console.log(`[${this.edgeName}] [COALESCING] Waiting for active origin fetch of: ${filename}`);
      return this.inFlightFetches.get(filename);
    }

    const fetchPromise = (async () => {
      this.stats.originFetches++;
      const originVideoUrl = `${this.originUrl}/videos/${encodeURIComponent(filename)}`;
      console.log(`[${this.edgeName}] [ORIGIN FETCH START] Requesting: ${originVideoUrl}`);

      const tempFilename = `.tmp-${Date.now()}-${Math.round(Math.random() * 1e9)}-${filename}`;
      const tempPath = path.join(this.cacheDir, tempFilename);

      return new Promise((resolve) => {
        const client = originVideoUrl.startsWith("https") ? https : http;
        let isResolved = false;
        let fileStream = null;

        const safeCleanupAndResolve = (result) => {
          if (isResolved) return;
          isResolved = true;

          if (fileStream) {
            fileStream.destroy();
          }

          if (!result.success && fs.existsSync(tempPath)) {
            try {
              fs.unlinkSync(tempPath);
            } catch (e) {
              // ignore
            }
          }

          resolve(result);
        };

        const req = client.get(
          originVideoUrl,
          {
            timeout: this.originTimeoutMs,
            headers: {
              "User-Agent": `StreamCloud-Edge/${this.edgeName}`
            }
          },
          (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return safeCleanupAndResolve({
                success: false,
                statusCode: res.statusCode,
                error: `Origin redirected to ${res.headers.location}`
              });
            }

            if (res.statusCode === 404) {
              console.warn(`[${this.edgeName}] [ORIGIN 404] Video not found on origin server: ${filename}`);
              return safeCleanupAndResolve({
                success: false,
                statusCode: 404,
                error: "Video not found on origin server"
              });
            }

            if (res.statusCode !== 200) {
              console.error(`[${this.edgeName}] [ORIGIN ERROR] HTTP ${res.statusCode} from origin for ${filename}`);
              return safeCleanupAndResolve({
                success: false,
                statusCode: res.statusCode,
                error: `Origin server returned HTTP ${res.statusCode}`
              });
            }

            fileStream = fs.createWriteStream(tempPath);
            let downloadedBytes = 0;

            res.on("data", (chunk) => {
              downloadedBytes += chunk.length;
            });

            res.pipe(fileStream);

            fileStream.on("finish", () => {
              fileStream.close(async () => {
                if (downloadedBytes === 0) {
                  return safeCleanupAndResolve({
                    success: false,
                    statusCode: 502,
                    error: "Origin sent empty 0-byte video"
                  });
                }

                const targetPath = this.getFilePath(filename);
                try {
                  await fs.promises.rename(tempPath, targetPath);
                  console.log(
                    `[${this.edgeName}] [ORIGIN FETCH COMPLETE] Cached ${filename} (${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB)`
                  );

                  this.enforceCacheSizeLimit();

                  safeCleanupAndResolve({
                    success: true,
                    statusCode: 200,
                    size: downloadedBytes
                  });
                } catch (renameErr) {
                  console.error(`[${this.edgeName}] [CACHE ERROR] Failed atomic rename: ${renameErr.message}`);
                  safeCleanupAndResolve({
                    success: false,
                    statusCode: 500,
                    error: "Failed to store file into edge cache"
                  });
                }
              });
            });

            fileStream.on("error", (err) => {
              console.error(`[${this.edgeName}] [CACHE WRITE ERROR] ${err.message}`);
              safeCleanupAndResolve({
                success: false,
                statusCode: 500,
                error: `Disk write error: ${err.message}`
              });
            });
          }
        );

        req.on("timeout", () => {
          req.destroy();
          console.error(`[${this.edgeName}] [ORIGIN TIMEOUT] Request timed out after ${this.originTimeoutMs}ms`);
          safeCleanupAndResolve({
            success: false,
            statusCode: 504,
            error: "Origin server timed out"
          });
        });

        req.on("error", (err) => {
          console.error(`[${this.edgeName}] [ORIGIN CONNECTION ERROR] ${err.message}`);
          safeCleanupAndResolve({
            success: false,
            statusCode: 502,
            error: `Failed to connect to origin server (${this.originUrl}): ${err.message}`
          });
        });
      });
    })();

    this.inFlightFetches.set(filename, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlightFetches.delete(filename);
    }
  }

  /**
   * Serve a video file with full HTTP Range request support
   */
  serveVideoWithRange(req, res, filename, cacheStatus = "HIT") {
    const filePath = this.getFilePath(filename);

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (err) {
      console.error(`[${this.edgeName}] File read error for ${filename}:`, err.message);
      return res.status(404).json({ error: "Video file not found", edge: this.edgeName });
    }

    const fileSize = stats.size;
    const contentType = this.getContentType(filename);
    const range = req.headers.range;

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Cache", cacheStatus);
    res.setHeader("X-Edge-Location", this.edgeName);
    res.setHeader("X-Edge-Origin", this.originUrl);
    res.setHeader("Last-Modified", stats.mtime.toUTCString());

    try {
      const now = new Date();
      fs.utimesSync(filePath, now, stats.mtime);
    } catch (e) {
      // ignore
    }

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const startStr = parts[0];
      const endStr = parts[1];

      let start = parseInt(startStr, 10);
      let end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      if (isNaN(start) && !isNaN(end)) {
        start = fileSize - end;
        end = fileSize - 1;
      }

      if (isNaN(start) || isNaN(end) || start < 0 || start >= fileSize || end < start) {
        console.warn(`[${this.edgeName}] [RANGE INVALID] Requested: "${range}" for size: ${fileSize}`);
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).send("Requested Range Not Satisfiable");
      }

      if (end >= fileSize) {
        end = fileSize - 1;
      }

      const chunkSize = end - start + 1;
      this.stats.bytesServed += chunkSize;

      console.log(
        `[${this.edgeName}] [${cacheStatus}] [RANGE 206] ${filename} bytes ${start}-${end}/${fileSize} (${(chunkSize / 1024).toFixed(1)} KB)`
      );

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunkSize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on("error", (streamErr) => {
        console.error(`[${this.edgeName}] ReadStream error:`, streamErr.message);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

      req.on("close", () => {
        stream.destroy();
      });

      stream.pipe(res);
    } else {
      this.stats.bytesServed += fileSize;
      console.log(
        `[${this.edgeName}] [${cacheStatus}] [FULL 200] ${filename} total ${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      );

      res.status(200);
      res.setHeader("Content-Length", fileSize);

      const stream = fs.createReadStream(filePath);
      stream.on("error", (streamErr) => {
        console.error(`[${this.edgeName}] ReadStream error:`, streamErr.message);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

      req.on("close", () => {
        stream.destroy();
      });

      stream.pipe(res);
    }
  }

  enforceCacheSizeLimit() {
    try {
      if (!fs.existsSync(this.cacheDir)) return;

      const files = fs.readdirSync(this.cacheDir);
      const fileStats = [];
      let totalSize = 0;

      for (const file of files) {
        if (file.startsWith(".")) continue;
        const filePath = path.join(this.cacheDir, file);
        try {
          const s = fs.statSync(filePath);
          fileStats.push({
            name: file,
            path: filePath,
            size: s.size,
            atimeMs: s.atimeMs || s.mtimeMs
          });
          totalSize += s.size;
        } catch (e) {
          // ignore
        }
      }

      const maxBytes = this.maxCacheSizeMB * 1024 * 1024;
      if (totalSize <= maxBytes) return;

      console.log(
        `[${this.edgeName}] Cache size (${(totalSize / (1024 * 1024)).toFixed(2)} MB) exceeded limit (${this.maxCacheSizeMB} MB). Starting LRU eviction.`
      );

      fileStats.sort((a, b) => a.atimeMs - b.atimeMs);

      for (const item of fileStats) {
        if (totalSize <= maxBytes) break;
        try {
          fs.unlinkSync(item.path);
          totalSize -= item.size;
          console.log(`[${this.edgeName}] [LRU EVICTED] Removed oldest cached file: ${item.name} (${(item.size / (1024 * 1024)).toFixed(2)} MB)`);
        } catch (unlinkErr) {
          console.error(`[${this.edgeName}] Failed to evict file: ${item.name}`);
        }
      }
    } catch (err) {
      console.error(`[${this.edgeName}] Error in enforceCacheSizeLimit:`, err.message);
    }
  }

  getCacheInfo() {
    let cachedFilesCount = 0;
    let totalSizeBytes = 0;
    const fileList = [];

    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.startsWith(".")) continue;
          const fp = path.join(this.cacheDir, file);
          try {
            const s = fs.statSync(fp);
            cachedFilesCount++;
            totalSizeBytes += s.size;
            fileList.push({
              filename: file,
              sizeBytes: s.size,
              sizeMB: (s.size / (1024 * 1024)).toFixed(2),
              cachedAt: s.mtime,
              lastAccessed: s.atime
            });
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore
    }

    return {
      cachedFilesCount,
      totalSizeBytes,
      totalSizeMB: (totalSizeBytes / (1024 * 1024)).toFixed(2),
      files: fileList
    };
  }

  purgeCache() {
    let deleted = 0;
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.startsWith(".")) continue;
          try {
            fs.unlinkSync(path.join(this.cacheDir, file));
            deleted++;
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return deleted;
  }
}

module.exports = CacheManager;
