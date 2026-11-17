require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const connectDB = require("./config/db");
const { streamFromGridFS, getGridFSBucket } = require("./config/gridfs");
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

// Robust video streaming endpoint with HTTP Range Requests and MongoDB GridFS cloud fallback
app.get("/videos/:filename", async (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
    res.setHeader("Accept-Ranges", "bytes");

    // 1. Check if the physical file exists on local container disk
    if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

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
            return fileStream.pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4"
            });
            return fs.createReadStream(filePath).pipe(res);
        }
    }

    // 2. Physical file not on local disk (e.g. Render free tier container restarted after 15 min sleep)
    // Stream directly from permanent MongoDB Atlas GridFS storage!
    const streamedFromGridFS = await streamFromGridFS(filename, req, res);
    if (streamedFromGridFS) {
        console.log(`[STREAMING] Video "${filename}" streamed directly from MongoDB GridFS cloud storage`);

        // Asynchronously cache file to local container disk for instant subsequent seeks
        try {
            const bucket = getGridFSBucket();
            if (bucket && !fs.existsSync(filePath)) {
                const downloadStream = bucket.openDownloadStreamByName(filename);
                const writeStream = fs.createWriteStream(filePath);
                downloadStream.pipe(writeStream).on("error", () => {});
            }
        } catch (cacheErr) {
            // Non-critical local cache error
        }
        return;
    }

    // 3. Not found on disk or in MongoDB GridFS
    console.warn(`[VIDEO STREAM] File "${filename}" not found in disk storage or MongoDB GridFS.`);
    return res.status(404).json({
        error: "Video file not found",
        filename: filename,
        message: "This video was uploaded to temporary server storage before persistent cloud GridFS storage was enabled. Please delete this video and re-upload it to store it permanently."
    });
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
