# StreamCloud CDN Edge Server - Delhi Node (Port 4001)

This is an independent Content Delivery Network (CDN) Edge Server representing the **Delhi Edge PoP (Point of Presence)** in the StreamCloud platform.

It caches videos locally on disk and serves video streams to clients with full **HTTP 206 Partial Content Range** support. When a requested video is not present in its local cache, it automatically pulls the video from the **Origin Server** (`http://localhost:3000`), caches it atomically, and delivers it to the user.

---

## Architecture & How It Works

```
[ Client / Browser ]
         │
         │  1. GET /videos/:filename
         ▼
┌────────────────────────────────────────┐
│  StreamCloud Edge Server (Delhi: 4001) │
│                                        │
│   ┌────────────────────────────────┐   │
│   │ Does video exist in ./cache?   │   │
│   └───────────────┬────────────────┘   │
│                   │                    │
│          YES      │        NO          │
│       ┌───────────┴──────────┐         │
│       ▼                      ▼         │
│  [ CACHE HIT ]        [ CACHE MISS ]   │
│   Serve directly      Pull from Origin │
└───────┬──────────────────────┬─────────┘
        │                      │
        │                      │ 2. GET http://localhost:3000/videos/:filename
        │                      ▼
        │          ┌───────────────────────────┐
        │          │  Main Origin Server       │
        │          │  (Port 3000)              │
        │          │  backend/uploads/         │
        │          └───────────┬───────────────┘
        │                      │
        │       3. Store to cache atomically
        │                      │
        ▼                      ▼
[ HTTP 206 Partial Content / 200 OK Stream ]
```

### Key Capabilities
- **Local Disk Cache**: Stored in `edge-delhi/cache/`.
- **Atomic Renaming**: Writes incoming origin streams to `.tmp-*` files first and renames only upon 100% successful completion, preventing partial/corrupt cache files.
- **HTTP Range Requests**: Supports `206 Partial Content`, `Content-Range: bytes start-end/total`, `Accept-Ranges: bytes`, and `416 Range Not Satisfiable` for smooth scrubbing and seeking.
- **In-flight Deduplication**: If multiple clients request an uncached video simultaneously, only one origin download is initiated.
- **Path Traversal Protection**: Rejects `..`, slashes, and restricts extensions to `.mp4`, `.webm`, `.ogg`, `.mov`, `.mkv`.
- **Cache Eviction**: Automatic LRU (Least Recently Used) eviction when disk usage exceeds `MAX_CACHE_SIZE_MB`.
- **Configurable TTL**: Cache expiry via `CACHE_TTL_SECONDS`.

---

## Windows 11 Quick Start

### 1. Prerequisites
- Node.js v18+ (tested with Node.js v24 on Windows 11).
- PowerShell or Windows Command Prompt.

### 2. Installation
Open PowerShell in the `edge-delhi` directory:

```powershell
cd "c:\Users\LENOVO\OneDrive\Documents\Video Streaming Platform\edge-delhi"
npm install
```

### 3. Configuration
The `.env` file is already configured:

```env
PORT=4001
EDGE_NAME=Delhi
ORIGIN_URL=http://localhost:3000
CACHE_DIR=./cache
CACHE_TTL_SECONDS=86400
MAX_CACHE_SIZE_MB=1024
ORIGIN_TIMEOUT_MS=20000
```

### 4. Start the Server
```powershell
npm start
```

For automatic reload on code changes:
```powershell
npm run dev
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Edge server status & node information |
| `GET` | `/health` | Health check, cache metrics & hit ratio |
| `GET` | `/videos/:filename` | Video delivery endpoint (Cache Hit / Miss) |
| `GET` | `/cache` | List of cached video files and storage size |
| `DELETE` | `/cache` | Purge all cached files (for testing/demo) |

---

## Testing & Verifying Cache Hit / Miss

### Test 1: Health Check
```powershell
curl -i http://localhost:4001/health
```

### Test 2: First Request (Cache Miss)
Make sure the Origin server is running on port 3000 with a video file (e.g. `1791289315853-250274887.mp4`):

```powershell
curl -i http://localhost:4001/videos/1791289315853-250274887.mp4 -H "Range: bytes=0-1023"
```
**Console Log:**
```text
[CACHE MISS] [Delhi] Video not in local cache: 1791289315853-250274887.mp4. Fetching from origin: http://localhost:3000/videos/1791289315853-250274887.mp4
[Delhi] [ORIGIN FETCH START] Requesting: http://localhost:3000/videos/1791289315853-250274887.mp4
[Delhi] [ORIGIN FETCH COMPLETE] Cached 1791289315853-250274887.mp4 (138.59 MB)
[Delhi] [MISS] [RANGE 206] 1791289315853-250274887.mp4 bytes 0-1023/145324526 (1.0 KB)
```
**Response Header:** `X-Cache: MISS`

### Test 3: Second Request (Cache Hit)
```powershell
curl -i http://localhost:4001/videos/1791289315853-250274887.mp4 -H "Range: bytes=0-1023"
```
**Console Log:**
```text
[CACHE HIT] [Delhi] Video served from local cache: 1791289315853-250274887.mp4
[Delhi] [HIT] [RANGE 206] 1791289315853-250274887.mp4 bytes 0-1023/145324526 (1.0 KB)
```
**Response Header:** `X-Cache: HIT`

### Test 4: Seeking & Range Support
```powershell
curl -i http://localhost:4001/videos/1791289315853-250274887.mp4 -H "Range: bytes=1000000-2000000"
```
Returns `HTTP/1.1 206 Partial Content` with `Content-Range: bytes 1000000-2000000/145324526`.

---

## Deployment Note on Multiple Ports vs. Geo-Distribution

Both edge servers currently run locally on distinct ports (`4001` for Delhi, `4002` for Mumbai). This simulates two independent CDN edge nodes running in separate geographical locations with isolated caches.

For real-world production deployment:
1. Copy the `edge-delhi` folder to a VM in North India (Delhi/Noida).
2. Set `PORT=80` or `PORT=443` and `ORIGIN_URL=https://origin.streamcloud.example.com`.
3. Point your DNS (e.g., GeoDNS or Anycast) to route North Indian users to the Delhi edge IP.
