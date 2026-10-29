import React from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";

export default function VideoCard({ video }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/watch/${encodeURIComponent(video.id)}`, { state: { video } });
  };

  const formattedViews = typeof video.views === "number"
    ? (video.views >= 1000 ? `${(video.views / 1000).toFixed(1)}K` : video.views)
    : (video.views || "1.2K");

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
          <span>{formattedViews} views</span>
          <span className="dot-separator"></span>
          <span>{video.uploadDate || "2 days ago"}</span>
        </div>
      </div>
    </div>
  );
}
