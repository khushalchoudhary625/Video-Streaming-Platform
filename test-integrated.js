const { spawn, fork } = require("child_process");
const net = require("net");
const http = require("http");
const path = require("path");

function waitForTcp(port, host = "127.0.0.1", timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const socket = net.createConnection({ port, host }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", (err) => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for port ${port}: ${err.message}`));
        } else {
          setTimeout(tryConnect, 400);
        }
      });
    }
    tryConnect();
  });
}

function waitForHttp(url, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const parsed = new URL(url);
      const req = http.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "GET",
        timeout: 1500
      }, (res) => {
        if (res.statusCode === 200) {
          resolve(res.statusCode);
        } else {
          setTimeout(tryConnect, 400);
        }
      });

      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for HTTP ${url}`));
        } else {
          setTimeout(tryConnect, 400);
        }
      });

      req.end();
    }
    tryConnect();
  });
}

async function run() {
  console.log("=================================================");
  console.log("  NetNoflix Automated CDN Test Orchestrator");
  console.log("=================================================\n");

  const processes = [];

  const cleanup = () => {
    console.log("\nTerminating test processes...");
    for (const p of processes) {
      try {
        p.kill("SIGKILL");
      } catch (e) {}
    }
    console.log("Cleanup complete.");
  };

  let cleanedUp = false;
  const safeCleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    cleanup();
  };

  process.on("exit", safeCleanup);
  process.on("SIGINT", () => { safeCleanup(); process.exit(1); });
  process.on("SIGTERM", () => { safeCleanup(); process.exit(1); });

  try {
    // 1. Start MongoDB with FTDC disabled
    console.log("[1/4] Starting local MongoDB instance on port 27017...");
    const mongoDbPath = path.resolve(__dirname, "backend/db");
    const mongoBin = "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe";
    const mongoProc = spawn(mongoBin, [
      "--dbpath", mongoDbPath,
      "--port", "27017",
      "--bind_ip", "127.0.0.1",
      "--setParameter", "diagnosticDataCollectionEnabled=false"
    ], { stdio: "inherit" });
    processes.push(mongoProc);

    await waitForTcp(27017, "127.0.0.1", 20000);
    console.log("  MongoDB is ready on port 27017.\n");

    // 2. Start Origin Server (Port 5000)
    console.log("[2/4] Starting Origin Server (Port 5000)...");
    const backendProc = fork(path.resolve(__dirname, "backend/server.js"), [], {
      cwd: path.resolve(__dirname, "backend"),
      stdio: "inherit"
    });
    processes.push(backendProc);

    await waitForHttp("http://localhost:5000/api/videos", 15000);
    console.log("  Origin Server is healthy on port 5000.\n");

    // 3. Start Delhi Edge Server (Port 4001)
    console.log("[3/4] Starting Delhi Edge Server (Port 4001)...");
    const delhiProc = fork(path.resolve(__dirname, "edge-delhi/server.js"), [], {
      cwd: path.resolve(__dirname, "edge-delhi"),
      stdio: "inherit"
    });
    processes.push(delhiProc);

    await waitForHttp("http://localhost:4001/health", 12000);
    console.log("  Delhi Edge Server is healthy on port 4001.\n");

    // 4. Start Mumbai Edge Server (Port 4002)
    console.log("[4/4] Starting Mumbai Edge Server (Port 4002)...");
    const mumbaiProc = fork(path.resolve(__dirname, "edge-mumbai/server.js"), [], {
      cwd: path.resolve(__dirname, "edge-mumbai"),
      stdio: "inherit"
    });
    processes.push(mumbaiProc);

    await waitForHttp("http://localhost:4002/health", 12000);
    console.log("  Mumbai Edge Server is healthy on port 4002.\n");

    // Small delay to ensure all sockets are fully initialized
    await new Promise((r) => setTimeout(r, 1200));

    // 5. Run test-cdn.js
    console.log("=================================================");
    console.log("  Running Test Verification Suite");
    console.log("=================================================\n");
    const runTests = require("./test-cdn");
    await runTests();

  } catch (err) {
    console.error("Test Orchestrator Failed:", err);
    process.exitCode = 1;
  } finally {
    safeCleanup();
  }
}

run();
