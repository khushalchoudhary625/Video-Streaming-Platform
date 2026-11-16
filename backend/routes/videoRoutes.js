const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const {
    getVideos,
    uploadVideo,
    incrementViewCount,
    deleteVideo,
    getCloudMetrics
} = require("../controllers/videoController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Ensure physical uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
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

// Public: Get all videos from MongoDB
router.get("/", getVideos);

// Public: Increment view count when video is watched
router.post("/:id/view", incrementViewCount);

// Admin Only: Upload a new video
router.post("/upload", protect, adminOnly, upload.single("video"), uploadVideo);

// Admin Only: Delete a video
router.delete("/:id", protect, adminOnly, deleteVideo);

// Admin Only: Get Real-time Cloud & CDN metrics
router.get("/metrics", protect, adminOnly, getCloudMetrics);

module.exports = router;