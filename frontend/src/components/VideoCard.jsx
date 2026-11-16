import React from "react";
import { useNavigate } from "react-router-dom";
import { Play, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function VideoCard({ video, onDelete }) {
  const navigate = useNavigate();
  const { isAdmin, token } = useAuth();

  const handleCardClick = () => {
    navigate(`/watch/${encodeURIComponent(video.id)}`, { state: { video } });
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${video.title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/videos/${video.id}`, {
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
        {video.thumbnail ? (
          <img 
            src={video.thumbnail} 
            alt={video.title} 
            className="thumbnail-preview" 
            loading="lazy"
          />
        ) : (
          <div className="thumbnail-fallback">
            <Play size={28} style={{ opacity: 0.8 }} />
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>CDN Stream Node</span>
          </div>
        )}

        <div className="duration-badge">{video.duration || "04:15"}</div>
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
