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

// Serve uploaded videos statically
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
