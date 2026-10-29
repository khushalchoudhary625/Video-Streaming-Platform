require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");
const { seedDefaultUsers } = require("./controllers/authController");
const videoRoutes = require("./routes/videoRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to Database & seed demo accounts
connectDB().then((connected) => {
    if (connected) {
        seedDefaultUsers();
    }
});

// Serve uploaded videos statically
app.use(
    "/videos",
    express.static(path.join(__dirname, "uploads"))
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
    res.status(500).json({
        message: err.message || "An internal server error occurred."
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});