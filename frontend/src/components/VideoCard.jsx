import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ORIGIN_API_URL } from "../config/api";

export default function VideoCard({ video, onDelete }) {
  const navigate = useNavigate();
  const { isAdmin, token } = useAuth();

  // Compute playable stream URL
  const streamUrl = video.url?.startsWith("http")
    ? video.url
    : `${ORIGIN_API_URL}${video.url?.startsWith("/") ? "" : "/"}${video.url || ""}`;

  // Priority thumbnail resolution:
  // 1. Explicit video.thumbnail saved in DB
  // 2. Cloudinary thumbnail: replace .mp4 with .jpg
  const initialThumb = video.thumbnail ||
    (video.cloudinaryUrl ? video.cloudinaryUrl.replace(/\.[^/.]+$/, ".jpg") : "") ||
    (streamUrl.includes("res.cloudinary.com") ? streamUrl.replace(/\.[^/.]+$/, ".jpg") : "");

  const [thumbnailSrc, setThumbnailSrc] = useState(initialThumb);

  // Real duration state (detect if hardcoded "04:15" or "04:30")
  const isDefaultDuration = !video.duration || video.duration === "04:15" || video.duration === "04:30";
  const [realDuration, setRealDuration] = useState(isDefaultDuration ? "" : video.duration);

  // If duration is missing or was hardcoded default, probe actual video metadata
  useEffect(() => {
    if (realDuration && thumbnailSrc) return;

    if (!realDuration && streamUrl) {
      const probeEl = document.createElement("video");
      probeEl.preload = "metadata";
      probeEl.muted = true;
      probeEl.playsInline = true;

      probeEl.onloadedmetadata = () => {
        if (probeEl.duration && isFinite(probeEl.duration)) {
          const totalSecs = Math.round(probeEl.duration);
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          setRealDuration(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
        }
      };

      probeEl.src = streamUrl;
    }
  }, [streamUrl, realDuration, thumbnailSrc]);

  const handleCardClick = () => {
    navigate(`/watch/${encodeURIComponent(video.id)}`, { state: { video: { ...video, duration: realDuration || video.duration } } });
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${video.title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${ORIGIN_API_URL}/api/videos/${video.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        if (onDelete) onDelete(video.id);
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete video");
      }
    } catch (err) {
      console.error("Delete video error:", err);
      alert("Failed to connect to backend server");
    }
  };

  const viewsCount = typeof video.views === "number" ? video.views : 0;
  const formattedViews = viewsCount >= 1000
    ? `${(viewsCount / 1000).toFixed(1)}K`
    : viewsCount;

  return (
    <div className="video-card" onClick={handleCardClick}>
      <div className="thumbnail-container">
        {thumbnailSrc ? (
          <img 
            src={thumbnailSrc} 
            alt={video.title} 
            className="thumbnail-preview" 
            loading="lazy"
            onError={() => setThumbnailSrc("")}
          />
        ) : streamUrl ? (
          <video
            src={`${streamUrl}#t=0.5`}
            preload="metadata"
            muted
            playsInline
            className="thumbnail-preview"
            onLoadedMetadata={(e) => {
              if (e.target.duration && isFinite(e.target.duration) && !realDuration) {
                const totalSecs = Math.round(e.target.duration);
                const mins = Math.floor(totalSecs / 60);
                const secs = totalSecs % 60;
                setRealDuration(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
              }
            }}
          />
        ) : (
          <div className="thumbnail-fallback">
            <Play size={28} style={{ opacity: 0.8 }} />
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>NetNoflix Stream Node</span>
          </div>
        )}

        {/* Hover overlay with Netflix red play icon */}
        <div className="thumbnail-overlay">
          <div className="thumbnail-play-icon">
            <Play size={18} fill="white" color="white" />
          </div>
        </div>

        <div className="duration-badge">{realDuration || "HD Video"}</div>
        <div className="cdn-badge">Edge CDN</div>

        {isAdmin && onDelete && (
          <button
            className="card-delete-btn"
            onClick={handleDelete}
            title="Delete Video (Admin Only)"
            aria-label="Delete Video"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="card-info">
        <h3 className="card-title" title={video.title}>
          {video.title}
        </h3>
        
        {video.description && (
          <p className="card-description">
            {video.description}
          </p>
        )}

        <div className="card-meta">
          <span>{formattedViews} {formattedViews === 1 ? "view" : "views"}</span>
          <span className="dot-separator"></span>
          <span>{video.uploadDate || "Uploaded recently"}</span>
        </div>
      </div>
    </div>
  );
}
