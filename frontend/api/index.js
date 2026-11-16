// Vercel Serverless Function for StreamCloud API
// Handles /api/videos, /api/videos/metrics, /api/auth/* directly on Vercel

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";
  const method = req.method || "GET";

  // Parse body if it's a string
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  // Sample videos for live Vercel demonstration
  const sampleVideos = [
    {
      id: "1791289315853-250274887",
      title: "StreamCloud CDN Demonstration Stream",
      description: "High-definition video showcasing multi-node edge caching, HTTP range requests, and low latency streaming.",
      filename: "1791289315853-250274887.mp4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      size: 145324526,
      views: 128,
      duration: "09:56",
      uploadDate: "Recently",
      uploaderName: "College Admin",
      isUserUploaded: false
    },
    {
      id: "1794828246765-616025868",
      title: "Edge Caching & Performance Benchmark",
      description: "Comparative telemetry test video demonstrating cache hits vs misses across Delhi and Mumbai nodes.",
      filename: "1794828246765-616025868.mp4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      size: 145324526,
      views: 84,
      duration: "10:53",
      uploadDate: "Recently",
      uploaderName: "StreamCloud Team",
      isUserUploaded: false
    }
  ];

  // 1. GET /api/videos/metrics -> Cloud Telemetry Dashboard
  if (url.includes("/api/videos/metrics")) {
    return res.status(200).json({
      overview: {
        totalRequests: 24,
        cacheHits: 19,
        cacheMisses: 5,
        hitRatio: "79.2%",
        originRequests: 5,
        bandwidthServedMB: "142.80",
        activeEdgeServers: 2,
        totalVideosStored: sampleVideos.length,
        originStorageUsedMB: "277.18 MB"
      },
      delhi: {
        edge: "Delhi",
        port: 4001,
        online: true,
        totalRequests: 14,
        cacheHits: 11,
        cacheMisses: 3,
        hitRatio: "78.6%",
        originFetches: 3,
        bytesServedMB: "82.40",
        cacheStorageUsedMB: "138.59",
        cachedFiles: 1,
        uptimeSeconds: 3600,
        recentActivity: [
          {
            edge: "Delhi",
            type: "CACHE HIT",
            filename: "1791289315853-250274887.mp4",
            bytes: 1024,
            durationMs: 3,
            timestamp: new Date().toISOString()
          }
        ]
      },
      mumbai: {
        edge: "Mumbai",
        port: 4002,
        online: true,
        totalRequests: 10,
        cacheHits: 8,
        cacheMisses: 2,
        hitRatio: "80.0%",
        originFetches: 2,
        bytesServedMB: "60.40",
        cacheStorageUsedMB: "138.59",
        cachedFiles: 1,
        uptimeSeconds: 3600,
        recentActivity: [
          {
            edge: "Mumbai",
            type: "CACHE HIT",
            filename: "1791289315853-250274887.mp4",
            bytes: 1024,
            durationMs: 2,
            timestamp: new Date().toISOString()
          }
        ]
      },
      recentActivity: [
        {
          edge: "Delhi",
          type: "CACHE HIT",
          filename: "1791289315853-250274887.mp4",
          bytes: 1024,
          durationMs: 3,
          timestamp: new Date().toISOString()
        },
        {
          edge: "Mumbai",
          type: "CACHE HIT",
          filename: "1791289315853-250274887.mp4",
          bytes: 1024,
          durationMs: 2,
          timestamp: new Date(Date.now() - 45000).toISOString()
        },
        {
          edge: "Delhi",
          type: "CACHE MISS",
          filename: "1794828246765-616025868.mp4",
          bytes: 145324526,
          durationMs: 468,
          timestamp: new Date(Date.now() - 120000).toISOString()
        }
      ]
    });
  }

  // 2. POST /api/videos/:id/view -> Increment views
  if (url.includes("/view") && method === "POST") {
    return res.status(200).json({ success: true, views: 129 });
  }

  // 3. DELETE /api/videos/:id -> Delete video
  if (method === "DELETE" && url.includes("/api/videos/")) {
    const id = url.split("/").pop();
    return res.status(200).json({ success: true, message: "Video deleted successfully", id });
  }

  // 4. POST /api/videos/upload -> Upload video
  if (url.includes("/api/videos/upload") && method === "POST") {
    const newVideo = {
      id: Date.now().toString(),
      title: body?.title || "Uploaded Video",
      description: body?.description || "User uploaded demonstration video",
      filename: "uploaded-" + Date.now() + ".mp4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      size: 15420000,
      views: 1,
      duration: "00:15",
      uploadDate: "Just now",
      uploaderName: "Administrator",
      isUserUploaded: true
    };
    return res.status(201).json({ message: "Video uploaded successfully", video: newVideo });
  }

  // 5. GET /api/videos -> Video listing
  if (url.startsWith("/api/videos") && method === "GET") {
    return res.status(200).json(sampleVideos);
  }

  // 6. POST /api/auth/login -> User login
  if (url.includes("/api/auth/login") && method === "POST") {
    const email = body?.email || "admin@streamcloud.com";
    const isAdmin = email.includes("admin");
    return res.status(200).json({
      message: "Login successful",
      token: "demo_jwt_token_" + Date.now(),
      user: {
        id: "usr_" + Date.now(),
        name: isAdmin ? "System Administrator" : "Student Viewer",
        email: email,
        role: isAdmin ? "admin" : "user"
      }
    });
  }

  // 7. POST /api/auth/register -> User registration
  if (url.includes("/api/auth/register") && method === "POST") {
    const role = body?.role || "user";
    return res.status(201).json({
      message: "User registered successfully",
      token: "demo_jwt_token_" + Date.now(),
      user: {
        id: "usr_" + Date.now(),
        name: body?.name || "New User",
        email: body?.email || "user@streamcloud.com",
        role: role
      }
    });
  }

  // 8. GET /api/auth/me -> Current user
  if (url.includes("/api/auth/me")) {
    return res.status(200).json({
      user: {
        id: "usr_active",
        name: "Demonstration User",
        email: "demo@streamcloud.com",
        role: "admin"
      }
    });
  }

  // Default 404 for unknown API paths
  return res.status(404).json({ error: "Endpoint not found: " + url });
}
