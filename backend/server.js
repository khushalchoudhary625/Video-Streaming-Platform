require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const connectDB = require("./config/db");
const videoRoutes = require("./routes/videoRoutes");
const authRoutes = require("./routes/authRoutes");
const Video = require("./models/Video");
const https = require("https");
const http = require("http");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded videos statically
app.use(
    "/videos",
    express.static(uploadsDir)
);

// Fallback for /videos/:filename if local ephemeral disk was wiped (e.g. Render restart)
app.all("/videos/:filename", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
    }

    try {
        const { filename } = req.params;
        const video = await Video.findOne({ filename });

        if (!video || !video.cloudinaryUrl) {
            console.warn(`[Origin Proxy] Video not found on disk or Cloudinary: ${filename}`);
            return res.status(404).send("Video file not found on Origin or Cloud storage.");
        }

        console.log(`[Origin Proxy] Ephemeral disk missing ${filename}. Proxying from Cloudinary: ${video.cloudinaryUrl}`);

        const targetUrl = video.cloudinaryUrl;
        const client = targetUrl.startsWith("https") ? https : http;

        const proxyHeaders = {};
        if (req.headers.range) {
            proxyHeaders["range"] = req.headers.range;
        }

        const proxyReq = client.request(
            targetUrl,
            {
                method: req.method,
                headers: proxyHeaders
            },
            (proxyRes) => {
                res.status(proxyRes.statusCode);

                const headersToForward = [
                    "content-type",
                    "content-length",
                    "content-range",
                    "accept-ranges",
                    "last-modified",
                    "etag"
                ];

                headersToForward.forEach((h) => {
                    if (proxyRes.headers[h]) {
                        res.setHeader(h, proxyRes.headers[h]);
                    }
                });

                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Range, Authorization, Content-Type");
                res.setHeader("X-Served-By", "Origin-Cloudinary-Proxy");

                if (req.method === "HEAD") {
                    return res.end();
                }

                proxyRes.pipe(res);

                // Re-populate local uploads folder in background if it was a full GET (200 OK)
                if (!req.headers.range && proxyRes.statusCode === 200) {
                    const localFilePath = path.join(uploadsDir, filename);
                    const fileWriteStream = fs.createWriteStream(localFilePath);
                    proxyRes.pipe(fileWriteStream);
                    fileWriteStream.on("finish", () => {
                        console.log(`[Origin Proxy] Restored ${filename} to local ephemeral storage.`);
                    });
                    fileWriteStream.on("error", (err) => {
                        console.warn(`[Origin Proxy] Failed to restore local copy for ${filename}:`, err.message);
                    });
                }
            }
        );

        proxyReq.on("error", (err) => {
            console.error(`[Origin Proxy] Error fetching from Cloudinary:`, err.message);
            if (!res.headersSent) {
                res.status(502).send("Origin failed to stream video from permanent cloud storage.");
            }
        });

        proxyReq.end();
    } catch (err) {
        console.error("[Origin Proxy] Handler error:", err);
        next(err);
    }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);

// Health check endpoint
app.get("/", (req, res) => {
    res.send("Video Streaming Platform with CDN Backend is running!");
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Unhandled Server Error:", err);
    if (err.name === "MulterError") {
        return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    res.status(500).json({
        message: err.message || "An internal server error occurred."
    });
});

const PORT = process.env.PORT || 5000;

// Connect to Database first, then start listening
const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
};

startServer();
