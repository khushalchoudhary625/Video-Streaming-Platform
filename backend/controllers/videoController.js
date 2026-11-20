const fs = require("fs");
const path = require("path");
const http = require("http");
const Video = require("../models/Video");
const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

// Helper to safely fetch metrics from an edge server (supports both HTTP and HTTPS)
const fetchEdgeMetrics = async (url) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: { "Accept": "application/json" }
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            return { online: false, error: `HTTP ${res.status}` };
        }

        const json = await res.json();
        return { online: true, ...json };
    } catch (err) {
        return { online: false, error: err.message };
    }
};

// @desc    Get all videos from MongoDB
// @route   GET /api/videos
const getVideos = async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, "../uploads");

        // Sync any physical files in uploads/ into MongoDB if not present
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            const videoFiles = files.filter(
                (file) => !file.startsWith(".") && /\.(mp4|webm|ogg|mov|mkv)$/i.test(file)
            );

            for (const file of videoFiles) {
                try {
                    const exists = await Video.findOne({ filename: file });
                    if (!exists) {
                        const stats = fs.statSync(path.join(uploadsDir, file));
                        const cleanTitle = file
                            .replace(/^\d+-/, "")
                            .replace(/\.[^/.]+$/, "")
                            .replace(/[-_]/g, " ");

                        await Video.create({
                            title: cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : file,
                            description: `Uploaded video stream file (${(stats.size / (1024 * 1024)).toFixed(1)} MB)`,
                            filename: file,
                            url: `/videos/${file}`,
                            size: stats.size,
                            views: 0,
                            duration: "04:15",
                            uploaderName: "Admin",
                            createdAt: stats.birthtime || stats.mtime
                        });
                    }
                } catch (syncErr) {
                    // Ignore duplicate key or sync error
                }
            }
        }

        // Query all videos from MongoDB
        const dbVideos = await Video.find().sort({ createdAt: -1 });

        const formatted = dbVideos.map((v) => ({
            id: v._id.toString(),
            title: v.title,
            description: v.description,
            filename: v.filename,
            url: v.url,
            size: v.size,
            views: v.views || 0,
            duration: v.duration || "04:15",
            uploadDate: new Date(v.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            }),
            uploaderName: v.uploaderName || "Admin",
            isUserUploaded: true
        }));

        res.json(formatted);
    } catch (error) {
        console.error("Get videos error:", error);
        res.status(500).json({ message: "Unable to load videos" });
    }
};

// @desc    Upload video (Admin Only)
// @route   POST /api/videos/upload
const uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No video file uploaded."
            });
        }

        const cleanFilename = req.file.originalname
            .replace(/\.[^/.]+$/, "")
            .replace(/[-_]/g, " ");

        const title = req.body.title && req.body.title.trim().length > 0
            ? req.body.title.trim()
            : (cleanFilename ? cleanFilename.charAt(0).toUpperCase() + cleanFilename.slice(1) : "Untitled Stream");

        const description = req.body.description ? req.body.description.trim() : "CDN Edge Streamable Video";
        const videoUrl = `/videos/${req.file.filename}`;

        let cloudinaryUrl = "";
        let cloudinaryId = "";
        const MAX_CLOUDINARY_SIZE = 100 * 1024 * 1024; // 100 MB Cloudinary Free Plan limit

        // If Cloudinary is configured, upload for permanent persistence across Render reboots
        if (isCloudinaryConfigured()) {
            if (req.file.size > MAX_CLOUDINARY_SIZE) {
                console.warn(`[Cloudinary] Video size (${(req.file.size / (1024 * 1024)).toFixed(1)} MB) exceeds Cloudinary Free tier 100 MB limit. Stored on Origin local disk.`);
            } else {
                console.log(`[Cloudinary] Uploading ${req.file.filename} (${(req.file.size / (1024 * 1024)).toFixed(1)} MB) to Cloudinary permanent storage...`);
                try {
                    const uploadResult = await new Promise((resolve, reject) => {
                        cloudinary.uploader.upload_large(
                            req.file.path,
                            {
                                resource_type: "video",
                                folder: "video_streaming_platform",
                                public_id: path.parse(req.file.filename).name,
                                chunk_size: 6000000 // 6MB chunks for robust uploads
                            },
                            (error, result) => {
                                if (error) return reject(error);
                                resolve(result);
                            }
                        );
                    });

                    cloudinaryUrl = uploadResult.secure_url || uploadResult.url;
                    cloudinaryId = uploadResult.public_id;
                    console.log(`[Cloudinary] Permanent upload succeeded! Cloud URL: ${cloudinaryUrl}`);
                } catch (cloudErr) {
                    console.error("[Cloudinary] Upload failed, falling back to local storage:", cloudErr.message);
                }
            }
        } else {
            console.log("[Cloudinary] Not configured. Video stored only on local disk.");
        }

        // Save to MongoDB
        const savedVideo = await Video.create({
            title,
            description,
            filename: req.file.filename,
            url: videoUrl,
            cloudinaryUrl,
            cloudinaryId,
            size: req.file.size,
            views: 0,
            duration: req.body.duration || "04:30",
            uploader: req.user ? req.user._id : null,
            uploaderName: req.user ? req.user.name : "Admin"
        });

        const isPermanent = Boolean(cloudinaryUrl);
        res.status(201).json({
            message: isPermanent
                ? "Video uploaded successfully and stored permanently in Cloud storage"
                : (req.file.size > MAX_CLOUDINARY_SIZE
                    ? "Video uploaded to local storage. (Files over 100MB exceed Cloudinary Free Tier limit and stay on ephemeral storage)"
                    : "Video uploaded successfully to CDN origin storage"),
            filename: req.file.filename,
            url: videoUrl,
            isPermanent,
            video: {
                id: savedVideo._id.toString(),
                title: savedVideo.title,
                description: savedVideo.description,
                filename: savedVideo.filename,
                url: savedVideo.url,
                size: savedVideo.size,
                views: savedVideo.views,
                uploadDate: "Just now",
                uploaderName: savedVideo.uploaderName,
                isUserUploaded: true
            }
        });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({
            message: "Video upload failed. " + error.message
        });
    }
};

// @desc    Increment video view count
// @route   POST /api/videos/:id/view
const incrementViewCount = async (req, res) => {
    try {
        const { id } = req.params;
        let video = null;

        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            video = await Video.findByIdAndUpdate(
                id,
                { $inc: { views: 1 } },
                { returnDocument: 'after' }
            );
        } else {
            video = await Video.findOneAndUpdate(
                { filename: id },
                { $inc: { views: 1 } },
                { returnDocument: 'after' }
            );
        }

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        res.json({
            success: true,
            views: video.views
        });
    } catch (error) {
        console.error("Increment view error:", error);
        res.status(500).json({ message: "Failed to update view count" });
    }
};

// @desc    Delete video (Admin Only)
// @route   DELETE /api/videos/:id
const deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;
        let video = null;

        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            video = await Video.findById(id);
        } else {
            video = await Video.findOne({ filename: id });
        }

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        // Delete physical file from uploads folder
        const uploadsDir = path.join(__dirname, "../uploads");
        const filePath = path.join(uploadsDir, video.filename);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (unlinkErr) {
                console.warn("Could not delete physical video file:", unlinkErr.message);
            }
        }

        // Delete from Cloudinary if configured
        if (video.cloudinaryId && isCloudinaryConfigured()) {
            try {
                await cloudinary.uploader.destroy(video.cloudinaryId, { resource_type: "video" });
                console.log(`[Cloudinary] Deleted ${video.cloudinaryId} from Cloudinary`);
            } catch (destroyErr) {
                console.warn("[Cloudinary] Could not delete from Cloudinary:", destroyErr.message);
            }
        }

        // Delete from MongoDB
        await Video.findByIdAndDelete(video._id);

        res.json({
            success: true,
            message: `Video "${video.title}" deleted successfully`,
            id: video._id.toString()
        });
    } catch (error) {
        console.error("Delete video error:", error);
        res.status(500).json({ message: "Failed to delete video: " + error.message });
    }
};

// @desc    Get Real Cloud & CDN Performance Metrics (Admin Only)
// @route   GET /api/videos/metrics
const getCloudMetrics = async (req, res) => {
    try {
        // Query MongoDB for storage and video count
        const videoCount = await Video.countDocuments();
        const videos = await Video.find().select("size");
        const totalSizeBytes = videos.reduce((acc, curr) => acc + (curr.size || 0), 0);
        const storageUsedMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

        // Determine active Edge Node URLs (supports cloud deployment and local testing)
        const isProduction = process.env.NODE_ENV === "production" || !process.env.NODE_ENV;
        const defaultDelhi = isProduction ? "https://video-streaming-platform-2-29ky.onrender.com" : "http://localhost:4001";
        const defaultMumbai = isProduction ? "https://video-streaming-platform-1-l7z7.onrender.com" : "http://localhost:4002";
        const delhiBaseUrl = (process.env.DELHI_EDGE_URL || defaultDelhi).replace(/\/+$/, "");
        const mumbaiBaseUrl = (process.env.MUMBAI_EDGE_URL || defaultMumbai).replace(/\/+$/, "");

        // Fetch live metrics from Delhi and Mumbai in parallel
        const [delhiMetrics, mumbaiMetrics] = await Promise.all([
            fetchEdgeMetrics(`${delhiBaseUrl}/metrics`),
            fetchEdgeMetrics(`${mumbaiBaseUrl}/metrics`)
        ]);

        // Aggregate actual live edge metrics
        const delhiHits = (delhiMetrics.online && delhiMetrics.metrics?.cacheHits) || 0;
        const delhiMisses = (delhiMetrics.online && delhiMetrics.metrics?.cacheMisses) || 0;
        const delhiOriginFetches = (delhiMetrics.online && delhiMetrics.metrics?.originFetches) || 0;
        const delhiBytes = (delhiMetrics.online && delhiMetrics.metrics?.bytesServed) || 0;

        const mumbaiHits = (mumbaiMetrics.online && mumbaiMetrics.metrics?.cacheHits) || 0;
        const mumbaiMisses = (mumbaiMetrics.online && mumbaiMetrics.metrics?.cacheMisses) || 0;
        const mumbaiOriginFetches = (mumbaiMetrics.online && mumbaiMetrics.metrics?.originFetches) || 0;
        const mumbaiBytes = (mumbaiMetrics.online && mumbaiMetrics.metrics?.bytesServed) || 0;

        const totalHits = delhiHits + mumbaiHits;
        const totalMisses = delhiMisses + mumbaiMisses;
        const totalRequests = totalHits + totalMisses;
        const totalOriginRequests = delhiOriginFetches + mumbaiOriginFetches;
        const totalBytesServed = delhiBytes + mumbaiBytes;
        const totalBandwidthMB = (totalBytesServed / (1024 * 1024)).toFixed(2);

        const overallHitRatio = totalRequests > 0
            ? `${((totalHits / totalRequests) * 100).toFixed(1)}%`
            : "0.0%";

        let activeEdgeServers = 0;
        if (delhiMetrics.online) activeEdgeServers++;
        if (mumbaiMetrics.online) activeEdgeServers++;

        // Combine activity logs
        const delhiLogs = (delhiMetrics.online && delhiMetrics.recentActivity) || [];
        const mumbaiLogs = (mumbaiMetrics.online && mumbaiMetrics.recentActivity) || [];
        const combinedLogs = [...delhiLogs, ...mumbaiLogs]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 30);

        res.json({
            overview: {
                totalRequests,
                cacheHits: totalHits,
                cacheMisses: totalMisses,
                hitRatio: overallHitRatio,
                originRequests: totalOriginRequests,
                bandwidthServedMB: totalBandwidthMB,
                activeEdgeServers,
                totalVideosStored: videoCount,
                originStorageUsedMB: `${storageUsedMB} MB`
            },
            delhi: {
                edge: "Delhi",
                port: delhiMetrics.port || 4001,
                url: delhiBaseUrl,
                online: delhiMetrics.online,
                totalRequests: delhiHits + delhiMisses,
                cacheHits: delhiHits,
                cacheMisses: delhiMisses,
                hitRatio: delhiMetrics.online ? (delhiMetrics.metrics?.hitRatio || "0.0%") : "N/A",
                originFetches: delhiOriginFetches,
                bytesServedMB: delhiMetrics.online ? (delhiMetrics.metrics?.bytesServedMB || "0.00") : "0.00",
                cacheStorageUsedMB: delhiMetrics.online ? (delhiMetrics.cache?.totalCacheSizeMB || "0.00") : "0.00",
                cachedFiles: delhiMetrics.online ? (delhiMetrics.cache?.cachedFiles || 0) : 0,
                uptimeSeconds: delhiMetrics.uptimeSeconds || 0,
                recentActivity: delhiLogs
            },
            mumbai: {
                edge: "Mumbai",
                port: mumbaiMetrics.port || 10000,
                url: mumbaiBaseUrl,
                online: mumbaiMetrics.online,
                totalRequests: mumbaiHits + mumbaiMisses,
                cacheHits: mumbaiHits,
                cacheMisses: mumbaiMisses,
                hitRatio: mumbaiMetrics.online ? (mumbaiMetrics.metrics?.hitRatio || "0.0%") : "N/A",
                originFetches: mumbaiOriginFetches,
                bytesServedMB: mumbaiMetrics.online ? (mumbaiMetrics.metrics?.bytesServedMB || "0.00") : "0.00",
                cacheStorageUsedMB: mumbaiMetrics.online ? (mumbaiMetrics.cache?.totalCacheSizeMB || "0.00") : "0.00",
                cachedFiles: mumbaiMetrics.online ? (mumbaiMetrics.cache?.cachedFiles || 0) : 0,
                uptimeSeconds: mumbaiMetrics.uptimeSeconds || 0,
                recentActivity: mumbaiLogs
            },
            recentActivity: combinedLogs
        });
    } catch (error) {
        console.error("Metrics aggregation error:", error);
        res.status(500).json({ message: "Failed to fetch cloud metrics: " + error.message });
    }
};

module.exports = {
    getVideos,
    uploadVideo,
    incrementViewCount,
    deleteVideo,
    getCloudMetrics
};
