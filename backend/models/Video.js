const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Title is required"],
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    filename: {
        type: String,
        required: [true, "Filename is required"]
    },
    url: {
        type: String,
        required: [true, "Video URL is required"]
    },
    size: {
        type: Number,
        default: 0
    },
    views: {
        type: Number,
        default: 0
    },
    duration: {
        type: String,
        default: "04:15"
    },
    uploader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    uploaderName: {
        type: String,
        default: "Admin"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Video", videoSchema);
