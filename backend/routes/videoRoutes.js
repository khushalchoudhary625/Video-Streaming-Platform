const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();

const { getVideos, uploadVideo, getCloudMetrics } = require("../controllers/videoController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, uniqueName + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500 MB
    }
});

// Public: Get all videos
router.get("/", getVideos);

// Admin Only: Upload a new video
router.post("/upload", protect, adminOnly, upload.single("video"), uploadVideo);

// Admin Only: Get Cloud & CDN metrics
router.get("/metrics", protect, adminOnly, getCloudMetrics);

module.exports = router;