import React, { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, FileVideo, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ORIGIN_API_URL } from "../config/api";

export default function UploadForm({ onUploadSuccess }) {
  const navigate = useNavigate();
  const { token, isAdmin } = useAuth();

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [detectedDuration, setDetectedDuration] = useState("");
  const [detectedThumbnail, setDetectedThumbnail] = useState("");

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      if (!title) {
        const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }
      if (selected.size > 100 * 1024 * 1024) {
        setMessage({
          type: "warning",
          text: `Selected file is ${(selected.size / (1024 * 1024)).toFixed(1)} MB. Cloudinary Free Plan limits permanent storage to 100 MB. Please choose a video under 100 MB so it is permanently preserved!`
        });
      } else {
        setMessage(null);
      }

      // Automatically inspect actual duration and grab a thumbnail frame
      try {
        const videoEl = document.createElement("video");
        videoEl.preload = "metadata";
        videoEl.muted = true;
        videoEl.playsInline = true;
        const objectUrl = URL.createObjectURL(selected);
        videoEl.src = objectUrl;

        videoEl.onloadedmetadata = () => {
          if (videoEl.duration && isFinite(videoEl.duration)) {
            const totalSecs = Math.round(videoEl.duration);
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            const durStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
            setDetectedDuration(durStr);
            videoEl.currentTime = Math.min(1, Math.max(0.2, totalSecs / 4));
          }
        };

        videoEl.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 480;
            canvas.height = 270;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const thumbData = canvas.toDataURL("image/jpeg", 0.7);
            setDetectedThumbnail(thumbData);
          } catch (err) {
            // ignore canvas security/cross-origin
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        };

        videoEl.onerror = () => {
          URL.revokeObjectURL(objectUrl);
        };
      } catch (err) {
        console.warn("Could not preview video metadata:", err);
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      setMessage({
        type: "error",
        text: "Only Administrators are authorized to upload videos."
      });
      return;
    }

    if (!file) {
      setMessage({
        type: "error",
        text: "Please select a video file to upload."
      });
      return;
    }

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("description", description);
    if (detectedDuration) {
      formData.append("duration", detectedDuration);
    }
    if (detectedThumbnail) {
      formData.append("thumbnail", detectedThumbnail);
    }

    setUploading(true);
    setProgress(30);
    setMessage(null);

    try {
      const response = await fetch(`${ORIGIN_API_URL}/api/videos/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      setProgress(80);

      const data = await response.json();

      if (!response.ok) {
        setUploading(false);
        setMessage({
          type: "error",
          text: data.message || "Video upload failed. Administrator privileges required."
        });
        return;
      }

      setProgress(100);
      setUploading(false);
      setMessage({
        type: "success",
        text: "Video uploaded successfully to CDN Origin Storage!"
      });

      const newVideo = data.video || {
        id: data.filename || Date.now().toString(),
        title: title || file.name,
        description: description || "User uploaded video stream.",
        url: data.url,
        views: 1,
        uploadDate: "Just now",
        isUserUploaded: true,
        size: file.size
      };

      if (onUploadSuccess) {
        onUploadSuccess(newVideo);
      }

      setFile(null);
      setTitle("");
      setDescription("");

      setTimeout(() => {
        navigate(`/watch/${encodeURIComponent(newVideo.id)}`, { state: { video: newVideo } });
      }, 1200);

    } catch (error) {
      console.error(error);
      setUploading(false);
      setMessage({
        type: "error",
        text: "Video upload failed. Server error or network connection issue."
      });
    }
  };

  return (
    <div className="upload-page-container">
      <div className="upload-header">
        <div className="hero-badge" style={{ marginBottom: "12px" }}>
          Admin Authorization Active
        </div>
        <h2 className="upload-title">Upload Video to CDN</h2>
        <p className="upload-subtitle">
          Upload video files directly to CDN Origin Storage Server
        </p>
      </div>

      {message && (
        <div className={`alert-message ${message.type}`}>
          {message.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleUpload}>
        <label className="dropzone">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
            disabled={uploading}
          />
          <UploadCloud className="dropzone-icon" />
          <div className="dropzone-text">
            {file ? "Change selected video" : "Select a video"}
          </div>
          <div className="dropzone-hint">
            Supports MP4, WebM, MOV (Max 100MB for permanent cloud storage)
          </div>
        </label>

        {file && (
          <div className="file-info-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FileVideo size={18} color="var(--primary-accent)" />
              <span className="file-name">{file.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {detectedDuration && (
                <span className="file-size" style={{ color: "var(--primary-accent)", fontWeight: 600 }}>
                  Duration: {detectedDuration}
                </span>
              )}
              <span className="file-size">{formatFileSize(file.size)}</span>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Video Title</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Distributed CDN Architecture"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Video Description</label>
          <textarea
            className="form-input"
            placeholder="Provide context regarding video encoding, bitrate, or CDN routing..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={uploading}
          />
        </div>

        {uploading && (
          <div className="progress-container">
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-text">Uploading to CDN Origin... {progress}%</div>
          </div>
        )}

        <button
          type="submit"
          className="btn-submit-upload"
          disabled={uploading || !file}
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Uploading Video...</span>
            </>
          ) : (
            <span>Publish Video to CDN</span>
          )}
        </button>
      </form>
    </div>
  );
}
