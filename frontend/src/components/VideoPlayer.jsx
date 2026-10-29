import React from "react";
import { ThumbsUp, Share2, Server, Download } from "lucide-react";
import VideoCard from "./VideoCard";

export default function VideoPlayer({ video, recommendedVideos = [] }) {
  if (!video) return null;

  // Format full URL if relative
  const videoSrc = video.url?.startsWith("http")
    ? video.url
    : `http://localhost:5000${video.url}`;

  return (
    <div className="watch-container">
      <div className="main-video-section">
        <div className="video-player-wrapper">
          <video
            src={videoSrc}
            controls
            controlsList="nodownload"
            preload="metadata"
            className="video-element"
            poster={video.thumbnail || ""}
          >
            Your browser does not support HTML5 video streaming.
          </video>
        </div>

        <h1 className="watch-title">{video.title}</h1>

        <div className="watch-meta-bar">
          <div className="watch-stats">
            <span>{typeof video.views === "number" ? video.views.toLocaleString() : (video.views || "1,245")} views</span>
            <span className="dot-separator" style={{ margin: "0 8px" }}></span>
            <span>Uploaded {video.uploadDate || "recently"}</span>
            <span className="dot-separator" style={{ margin: "0 8px" }}></span>
            <span style={{ color: "#2563eb", fontWeight: 500 }}>Origin: CDN Edge Node 1</span>
          </div>

          <div className="watch-actions">
            <button className="btn-action">
              <ThumbsUp size={16} />
              <span>Like</span>
            </button>
            <button className="btn-action">
              <Share2 size={16} />
              <span>Share</span>
            </button>
            <a 
              href={videoSrc} 
              target="_blank" 
              rel="noreferrer" 
              download 
              className="btn-action"
            >
              <Download size={16} />
              <span>Download</span>
            </a>
          </div>
        </div>

        <div className="video-description-box">
          <div style={{ fontWeight: 600, marginBottom: "8px", color: "var(--text-secondary)" }}>
            Description
          </div>
          {video.description || "No description provided for this video stream."}
        </div>
      </div>

      <div className="recommended-sidebar">
        <h3 className="recommended-title">Recommended Videos</h3>
        <div className="recommended-list">
          {recommendedVideos.length > 0 ? (
            recommendedVideos.slice(0, 6).map((rec) => (
              <VideoCard key={rec.id} video={rec} />
            ))
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No recommendations available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
