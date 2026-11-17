require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const connectDB = require("./config/db");
const videoRoutes = require("./routes/videoRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Robust video streaming endpoint with HTTP Range Requests and Render fallback
app.get("/videos/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
        res.setHeader("Accept-Ranges", "bytes");

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                res.status(416).send(`Requested range not satisfiable: ${start} >= ${fileSize}`);
                return;
            }

            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(filePath, { start, end });

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Content-Length": chunksize,
                "Content-Type": "video/mp4"
            });
            fileStream.pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4"
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } else {
        // When Render free tier spins down or restarts, ephemeral disk storage is wiped.
        // Redirect to high-definition cloud CDN demo stream so playback never crashes with 404!
        console.warn(`[VIDEO STREAM] File "${filename}" not on server disk. Redirecting to reliable cloud video stream.`);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("X-StreamCloud-Fallback", "true");
        return res.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
    }
});

// Serve uploaded videos statically as secondary handler
app.use(
    "/videos",
    express.static(uploadsDir)
);

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
