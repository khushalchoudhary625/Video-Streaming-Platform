# StreamCloud CDN Edge Servers - Testing & Evaluation Guide

This guide walks you through starting the **Origin Server** (Port 3000), **Delhi Edge Server** (Port 4001), and **Mumbai Edge Server** (Port 4002), and testing cache hit/miss behavior, range requests, seeking, and offline survival.

---

## 1. Architecture Overview

| Server | Port | Role | Cache Storage Directory |
|---|---|---|---|
| **Main / Origin Server** | `5000` | Authoritative Origin & Video Upload Storage | `backend/uploads/` |
| **Delhi Edge Server** | `4001` | North India CDN Edge PoP | `edge-delhi/cache/` |
| **Mumbai Edge Server** | `4002` | West India CDN Edge PoP | `edge-mumbai/cache/` |

---

## 2. Starting the Servers (Open 3 Separate PowerShell Terminals)

### Terminal 1: Origin Server (Port 5000)
```powershell
cd "c:\Users\LENOVO\OneDrive\Documents\Video Streaming Platform\backend"
npm run dev
```
*Expected log:*
```text
Server running on http://localhost:5000
```

### Terminal 2: Delhi Edge Server (Port 4001)
```powershell
cd "c:\Users\LENOVO\OneDrive\Documents\Video Streaming Platform\edge-delhi"
npm start
```
*Expected log:*
```text
====================================================
  StreamCloud CDN Edge Server - Delhi Node
  Running on: http://localhost:4001
  Origin URL: http://localhost:3000
  Cache Dir:  ...\edge-delhi\cache
  TTL:        86400s | Max Size: 1024MB
====================================================
```

### Terminal 3: Mumbai Edge Server (Port 4002)
```powershell
cd "c:\Users\LENOVO\OneDrive\Documents\Video Streaming Platform\edge-mumbai"
npm start
```
*Expected log:*
```text
====================================================
  StreamCloud CDN Edge Server - Mumbai Node
  Running on: http://localhost:4002
  Origin URL: http://localhost:3000
  Cache Dir:  ...\edge-mumbai\cache
  TTL:        86400s | Max Size: 1024MB
====================================================
```

---

## 3. Automated Test Suite

With all three servers running, open a 4th terminal in the project root:

```powershell
cd "c:\Users\LENOVO\OneDrive\Documents\Video Streaming Platform"
node test-cdn.js
```

The script will automatically execute:
1. Health checks on Delhi (4001) and Mumbai (4002).
2. Cache miss verification on Delhi.
3. Cache hit verification on Delhi.
4. Independent cache verification on Mumbai (confirming Mumbai stays a miss until requested).
5. HTTP Range requests (`bytes 0-1023` and `bytes 1000000-2000000`).
6. Out-of-bounds range checks (`416 Range Not Satisfiable`).
7. Security and path-traversal prevention (`400 Bad Request`).
8. 404 handling for non-existent video files.

---

## 4. Manual Verification Steps (Curl & Browser)

### Step 1: Health Checks
```powershell
curl http://localhost:4001/health
curl http://localhost:4002/health
```

### Step 2: Request from Delhi Edge (First Request -> CACHE MISS)
```powershell
curl -i http://localhost:4001/videos/1791289315853-250274887.mp4 -H "Range: bytes=0-1023"
```
- **Console Log on Delhi**: `[CACHE MISS] [Delhi] Video not in local cache: ... Fetching from origin ...`
- **Response Header**: `X-Cache: MISS`

### Step 3: Request again from Delhi Edge (Second Request -> CACHE HIT)
```powershell
curl -i http://localhost:4001/videos/1791289315853-250274887.mp4 -H "Range: bytes=0-1023"
```
- **Console Log on Delhi**: `[CACHE HIT] [Delhi] Video served from local cache: ...`
- **Response Header**: `X-Cache: HIT`

### Step 4: Verify Independent Cache on Mumbai Edge
Notice that `edge-mumbai/cache` is still empty! Now request the video from Mumbai:
```powershell
curl -i http://localhost:4002/videos/1791289315853-250274887.mp4 -H "Range: bytes=0-1023"
```
- **Console Log on Mumbai**: `[CACHE MISS] [Mumbai] ...`
- **Response Header**: `X-Cache: MISS`
- Now both `edge-delhi/cache` and `edge-mumbai/cache` hold their own separate local copies!

### Step 5: Test Offline Origin Survival
1. Go to Terminal 1 and press `Ctrl+C` to **stop the Origin server (Port 3000)**.
2. Request the cached video from Delhi Edge:
   ```powershell
   curl -i http://localhost:4001/videos/1791289315853-250274887.mp4 -H "Range: bytes=0-1023"
   ```
   **Result**: Works smoothly with `HTTP 206 Partial Content` and `X-Cache: HIT` even though Origin is offline!
3. Request an uncached video (e.g., `curl http://localhost:4001/videos/uncached-file.mp4`):
   **Result**: Controlled error `HTTP 502 Bad Gateway` reporting origin connection failure cleanly.
