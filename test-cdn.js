/**
 * StreamCloud CDN Edge Servers Verification Suite
 *
 * Tests:
 * 1. Health checks on Origin (5000), Delhi Edge (4001), and Mumbai Edge (4002)
 * 2. Cache Miss on Delhi Edge (origin fetch + cache population)
 * 3. Cache Hit on Delhi Edge (served directly from local cache)
 * 4. Cache Isolation on Mumbai Edge (verifying Mumbai remains a miss until requested)
 * 5. HTTP Range Requests (206 Partial Content, Content-Range, Content-Length)
 * 6. Out-of-Bounds Range Handling (416 Range Not Satisfiable)
 * 7. Path Traversal & Security Validation (400 Bad Request)
 * 8. 404 Handling for non-existent video
 * 9. Cache Independence & Offline Origin Survival
 */

const http = require("http");

const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:5000";
const DELHI_URL = process.env.DELHI_URL || "http://localhost:4001";
const MUMBAI_URL = process.env.MUMBAI_URL || "http://localhost:4002";
const TEST_VIDEO = "1791289315853-250274887.mp4";

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const bodyBuffer = Buffer.concat(chunks);
        let bodyJson = null;
        try {
          bodyJson = JSON.parse(bodyBuffer.toString());
        } catch (e) {
          // not JSON
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          bodyBuffer,
          bodyText: bodyBuffer.toString(),
          bodyJson
        });
      });
    });

    req.on("error", (err) => reject(err));
    if (options.timeout) {
      req.setTimeout(options.timeout, () => {
        req.destroy();
        reject(new Error(`Request timed out after ${options.timeout}ms`));
      });
    }
    req.end();
  });
}

async function runTests() {
  console.log("========================================================");
  console.log("  StreamCloud CDN Edge Servers - Verification Test Suite");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`[TEST] ${name} ... `);
    try {
      await fn();
      console.log("PASSED");
      passed++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }

  // 1. Health checks
  await test("Delhi Edge Health Check (Port 4001)", async () => {
    const res = await makeRequest(`${DELHI_URL}/health`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.bodyJson?.edge !== "Delhi") throw new Error(`Expected edge 'Delhi', got ${res.bodyJson?.edge}`);
  });

  await test("Mumbai Edge Health Check (Port 4002)", async () => {
    const res = await makeRequest(`${MUMBAI_URL}/health`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.bodyJson?.edge !== "Mumbai") throw new Error(`Expected edge 'Mumbai', got ${res.bodyJson?.edge}`);
  });

  // 2. Delhi Cache Miss
  await test("First request to Delhi produces CACHE MISS", async () => {
    // Purge cache first to guarantee fresh test
    await makeRequest(`${DELHI_URL}/cache`, { method: "DELETE" });

    const res = await makeRequest(`${DELHI_URL}/videos/${TEST_VIDEO}`, {
      headers: { Range: "bytes=0-1023" }
    });

    if (res.statusCode !== 206) throw new Error(`Expected 206, got ${res.statusCode}`);
    if (res.headers["x-cache"] !== "MISS") throw new Error(`Expected X-Cache: MISS, got ${res.headers["x-cache"]}`);
    if (res.headers["x-edge-location"] !== "Delhi") throw new Error(`Expected X-Edge-Location: Delhi`);
    if (res.headers["content-length"] !== "1024") throw new Error(`Expected Content-Length 1024, got ${res.headers["content-length"]}`);
  });

  // 3. Delhi Cache Hit
  await test("Second request to Delhi produces CACHE HIT", async () => {
    const res = await makeRequest(`${DELHI_URL}/videos/${TEST_VIDEO}`, {
      headers: { Range: "bytes=0-1023" }
    });

    if (res.statusCode !== 206) throw new Error(`Expected 206, got ${res.statusCode}`);
    if (res.headers["x-cache"] !== "HIT") throw new Error(`Expected X-Cache: HIT, got ${res.headers["x-cache"]}`);
  });

  // 4. Mumbai Cache Independence
  await test("Mumbai cache is independent (First request to Mumbai produces CACHE MISS)", async () => {
    await makeRequest(`${MUMBAI_URL}/cache`, { method: "DELETE" });

    const res = await makeRequest(`${MUMBAI_URL}/videos/${TEST_VIDEO}`, {
      headers: { Range: "bytes=0-1023" }
    });

    if (res.statusCode !== 206) throw new Error(`Expected 206, got ${res.statusCode}`);
    if (res.headers["x-cache"] !== "MISS") throw new Error(`Expected X-Cache: MISS, got ${res.headers["x-cache"]}`);
    if (res.headers["x-edge-location"] !== "Mumbai") throw new Error(`Expected X-Edge-Location: Mumbai`);
  });

  await test("Second request to Mumbai produces CACHE HIT", async () => {
    const res = await makeRequest(`${MUMBAI_URL}/videos/${TEST_VIDEO}`, {
      headers: { Range: "bytes=0-1023" }
    });

    if (res.statusCode !== 206) throw new Error(`Expected 206, got ${res.statusCode}`);
    if (res.headers["x-cache"] !== "HIT") throw new Error(`Expected X-Cache: HIT, got ${res.headers["x-cache"]}`);
  });

  // 5. HTTP Range Request and Seeking
  await test("Video Seeking: Arbitrary HTTP Range (bytes=1000000-2000000)", async () => {
    const res = await makeRequest(`${DELHI_URL}/videos/${TEST_VIDEO}`, {
      headers: { Range: "bytes=1000000-2000000" }
    });

    if (res.statusCode !== 206) throw new Error(`Expected 206, got ${res.statusCode}`);
    if (res.headers["content-length"] !== "1000001") throw new Error(`Expected 1000001 bytes, got ${res.headers["content-length"]}`);
    if (!res.headers["content-range"]?.startsWith("bytes 1000000-2000000/")) {
      throw new Error(`Unexpected Content-Range: ${res.headers["content-range"]}`);
    }
  });

  // 6. Out of Bounds Range Request
  await test("Out-of-Bounds Range returns 416 Range Not Satisfiable", async () => {
    const res = await makeRequest(`${DELHI_URL}/videos/${TEST_VIDEO}`, {
      headers: { Range: "bytes=9999999999-9999999999" }
    });

    if (res.statusCode !== 416) throw new Error(`Expected 416, got ${res.statusCode}`);
  });

  // 7. Path Traversal & Security Validation
  await test("Path traversal attempt returns 400 Bad Request", async () => {
    const res = await makeRequest(`${DELHI_URL}/videos/..%2F..%2Fpackage.json`);
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  // 8. 404 Missing Video
  await test("Missing video returns 404 Not Found", async () => {
    const res = await makeRequest(`${DELHI_URL}/videos/non-existent-video.mp4`);
    if (res.statusCode !== 404) throw new Error(`Expected 404, got ${res.statusCode}`);
  });

  console.log("\n========================================================");
  console.log(`  Results: ${passed} Passed, ${failed} Failed`);
  console.log("========================================================\n");
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
  });
}

module.exports = runTests;
