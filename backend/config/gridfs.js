const mongoose = require("mongoose");
const fs = require("fs");

let gridFSBucket = null;

const getGridFSBucket = () => {
    if (!gridFSBucket && mongoose.connection.readyState === 1 && mongoose.connection.db) {
        gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "videos"
        });
    }
    return gridFSBucket;
};

/**
 * Upload a local file into MongoDB GridFS
 */
const uploadToGridFS = (filePath, filename, contentType = "video/mp4") => {
    return new Promise((resolve) => {
        try {
            const bucket = getGridFSBucket();
            if (!bucket) {
                console.warn("[GridFS] Bucket unavailable, skipping cloud upload");
                return resolve(null);
            }

            const uploadStream = bucket.openUploadStream(filename, {
                contentType: contentType || "video/mp4"
            });

            const readStream = fs.createReadStream(filePath);

            readStream.pipe(uploadStream)
                .on("error", (err) => {
                    console.error("[GridFS Upload Error]:", err.message);
                    resolve(null);
                })
                .on("finish", () => {
                    console.log(`[GridFS] Successfully saved "${filename}" to MongoDB Atlas permanently!`);
                    resolve(uploadStream.id);
                });
        } catch (err) {
            console.error("[GridFS Error]:", err.message);
            resolve(null);
        }
    });
};

/**
 * Delete a file from MongoDB GridFS
 */
const deleteFromGridFS = async (filename) => {
    try {
        const bucket = getGridFSBucket();
        if (!bucket) return false;

        const files = await bucket.find({ filename }).toArray();
        for (const file of files) {
            await bucket.delete(file._id);
        }
        return true;
    } catch (err) {
        console.warn("[GridFS Delete Error]:", err.message);
        return false;
    }
};

/**
 * Check if file exists in MongoDB GridFS
 */
const findInGridFS = async (filename) => {
    try {
        const bucket = getGridFSBucket();
        if (!bucket) return null;

        const files = await bucket.find({ filename }).toArray();
        if (files && files.length > 0) {
            return files[0];
        }
        return null;
    } catch (err) {
        return null;
    }
};

/**
 * Stream a video file from MongoDB GridFS with HTTP 206 Partial Content Range support
 */
const streamFromGridFS = async (filename, req, res) => {
    try {
        const bucket = getGridFSBucket();
        if (!bucket) return false;

        const files = await bucket.find({ filename }).toArray();
        if (!files || files.length === 0) return false;

        const file = files[0];
        const fileSize = file.length;
        const range = req.headers.range;
        const contentType = file.contentType || "video/mp4";

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
        res.setHeader("Accept-Ranges", "bytes");

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                res.status(416).send(`Requested range not satisfiable: ${start} >= ${fileSize}`);
                return true;
            }

            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Content-Length": chunkSize,
                "Content-Type": contentType
            });

            const downloadStream = bucket.openDownloadStreamByName(filename, {
                start: start,
                end: end + 1 // MongoDB driver end is exclusive
            });

            downloadStream.on("error", (err) => {
                console.error("[GridFS Download Stream Error]:", err.message);
            });

            downloadStream.pipe(res);
            return true;
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": contentType
            });

            const downloadStream = bucket.openDownloadStreamByName(filename);
            downloadStream.on("error", (err) => {
                console.error("[GridFS Download Stream Error]:", err.message);
            });

            downloadStream.pipe(res);
            return true;
        }
    } catch (err) {
        console.error("[GridFS Stream Exception]:", err.message);
        return false;
    }
};

module.exports = {
    getGridFSBucket,
    uploadToGridFS,
    deleteFromGridFS,
    findInGridFS,
    streamFromGridFS
};
