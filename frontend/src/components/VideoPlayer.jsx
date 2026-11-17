import React, { useState } from "react";
import { ThumbsUp, Share2, Server, Download, Trash2, Radio } from "lucide-react";
import VideoCard from "./VideoCard";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ORIGIN_API_URL, DELHI_EDGE_URL, MUMBAI_EDGE_URL } from "../config/api";

export default function VideoPlayer({ video, recommendedVideos = [], onPlay, onDeleteVideo }) {
  const { isAdmin, token } = useAuth();
  const navigate = useNavigate();

  // Edge server selector: Delhi (4001), Mumbai (4002), Origin (5000)
  const [selectedNode, setSelectedNode] = useState("delhi"); // "delhi" | "mumbai" | "origin"

  if (!video) return null;

  // Determine stream endpoint based on selected node
  const filename = video.filename || (video.url ? video.url.replace("/videos/", "") : "");
  
  let videoSrc = "";
  let nodeLabel = "";
  if (selectedNode === "delhi") {
    videoSrc = `${DELHI_EDGE_URL}/videos/${filename}`;
    nodeLabel = "Delhi Edge Node (Port 4001)";
  } else if (selectedNode === "mumbai") {
    videoSrc = `${MUMBAI_EDGE_URL}/videos/${filename}`;
    nodeLabel = "Mumbai Edge Node (Port 4002)";
  } else {
    videoSrc = `${ORIGIN_API_URL}/videos/${filename}`;
    nodeLabel = "Origin Server (Port 5000)";
  }

  const handleDelete = async () => {
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
        if (onDeleteVideo) onDeleteVideo(video.id);
        navigate("/");
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete video");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to connect to backend server");
    }
  };

  const viewsCount = typeof video.views === "number" ? video.views : 0;

  return (
    <div className="watch-container">
      <div className="main-video-section">
        {/* Stream Source Selector for College Demo */}
        <div className="stream-source-selector">
          <div className="stream-source-label">
            <Radio size={16} color="var(--primary-accent)" />
            <span>Streaming Node:</span>
          </div>
          <div className="stream-source-buttons">
            <button
              className={`node-pill ${selectedNode === "delhi" ? "active" : ""}`}
              onClick={() => setSelectedNode("delhi")}
            >
              Delhi Edge (4001)
            </button>
            <button
              className={`node-pill ${selectedNode === "mumbai" ? "active" : ""}`}
              onClick={() => setSelectedNode("mumbai")}
            >
              Mumbai Edge (4002)
            </button>
            <button
              className={`node-pill ${selectedNode === "origin" ? "active" : ""}`}
              onClick={() => setSelectedNode("origin")}
            >
              Direct Origin (5000)
            </button>
          </div>
        </div>

        <div className="video-player-wrapper">
          <video
            key={videoSrc}
            src={videoSrc}
            controls
            controlsList="nodownload"
            preload="metadata"
            className="video-element"
            poster={video.thumbnail || ""}
            onPlay={() => {
              if (onPlay) onPlay(video.id);
            }}
          >
            Your browser does not support HTML5 video streaming.
          </video>
        </div>

        <h1 className="watch-title">{video.title}</h1>

        <div className="watch-meta-bar">
          <div className="watch-stats">
            <span>{viewsCount.toLocaleString()} {viewsCount === 1 ? "view" : "views"}</span>
            <span className="dot-separator" style={{ margin: "0 8px" }}></span>
            <span>Uploaded {video.uploadDate || "recently"}</span>
            <span className="dot-separator" style={{ margin: "0 8px" }}></span>
            <span style={{ color: "var(--primary-accent)", fontWeight: 600 }}>
              CDN Source: {nodeLabel}
            </span>
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

            {isAdmin && (
              <button 
                className="btn-action danger" 
                onClick={handleDelete}
                style={{ color: "#dc2626", borderColor: "#fecaca" }}
                title="Delete this video (Admin Only)"
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            )}
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
              <VideoCard key={rec.id} video={rec} onDelete={onDeleteVideo} />
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
