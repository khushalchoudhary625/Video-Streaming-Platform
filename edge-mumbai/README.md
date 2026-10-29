# StreamCloud CDN Edge Server - Mumbai Node (Port 4002)

This is an independent Content Delivery Network (CDN) Edge Server representing the **Mumbai Edge PoP (Point of Presence)** in the StreamCloud platform.

It maintains its own dedicated local disk cache in `edge-mumbai/cache/` completely separate from Delhi and the Origin server. It serves video streams to clients with full **HTTP 206 Partial Content Range** support. When a requested video is not present in its local cache, it pulls the video from the **Origin Server** (`http://localhost:3000`), caches it atomically, and serves it directly.

---

## Architecture & How It Works

```
[ Client / Browser in West India ]
         │
         │  1. GET /videos/:filename
         ▼
┌────────────────────────────────────────┐
│  StreamCloud Edge Server (Mumbai: 4002)│
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
- **Separate Local Disk Cache**: Stored in `edge-mumbai/cache/`.
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
Open PowerShell in the `edge-mumbai` directory:

```powershell
cd "c:\Users\LENOVO\OneDrive\Documents\Video Streaming Platform\edge-mumbai"
npm install
```

### 3. Configuration
The `.env` file is already configured:

```env
PORT=4002
EDGE_NAME=Mumbai
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
curl -i http://localhost:4002/health
```

### Test 2: First Request (Cache Miss)
Make sure the Origin server is running on port 3000 with a video file (e.g. `1791289315853-250274887.mp4`):

```powershell
curl -i http://localhost:4002/videos/1791289315853-250274887.mp4 -H "Range: bytes=0-1023"
```
**Console Log:**
```text
[CACHE MISS] [Mumbai] Video not in local cache: 1791289315853-250274887.mp4. Fetching from origin: http://localhost:3000/videos/1791289315853-250274887.mp4
[Mumbai] [ORIGIN FETCH START] Requesting: http://localhost:3000/videos/1791289315853-250274887.mp4
[Mumbai] [ORIGIN FETCH COMPLETE] Cached 1791289315853-250274887.mp4 (138.59 MB)
[Mumbai] [MISS] [RANGE 206] 1791289315853-250274887.mp4 bytes 0-1023/145324526 (1.0 KB)
```
**Response Header:** `X-Cache: MISS`

### Test 3: Second Request (Cache Hit)
```powershell
curl -i http://localhost:4002/videos/1791289315853-250274887.mp4 -H "Range: bytes=0-1023"
```
**Console Log:**
```text
[CACHE HIT] [Mumbai] Video served from local cache: 1791289315853-250274887.mp4
[Mumbai] [HIT] [RANGE 206] 1791289315853-250274887.mp4 bytes 0-1023/145324526 (1.0 KB)
```
**Response Header:** `X-Cache: HIT`

---

## Deployment Note on Multiple Ports vs. Geo-Distribution

Both edge servers currently run locally on distinct ports (`4001` for Delhi, `4002` for Mumbai). This simulates two independent CDN edge nodes running in separate geographical locations with isolated caches.

For real-world production deployment:
1. Copy the `edge-mumbai` folder to a VM in West India (Mumbai).
2. Set `PORT=80` or `PORT=443` and `ORIGIN_URL=https://origin.streamcloud.example.com`.
3. Point your DNS (e.g., GeoDNS or Anycast) to route West/South Indian users to the Mumbai edge IP.
