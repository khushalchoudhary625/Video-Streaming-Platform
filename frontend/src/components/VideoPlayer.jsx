import React, { useState, useEffect, useCallback } from "react";
import { ThumbsUp, Share2, Server, Download, Trash2, Radio, Zap, Globe2 } from "lucide-react";
import VideoCard from "./VideoCard";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ORIGIN_API_URL, DELHI_EDGE_URL, MUMBAI_EDGE_URL } from "../config/api";

export default function VideoPlayer({ video, recommendedVideos = [], onPlay, onDeleteVideo }) {
  const { isAdmin, token } = useAuth();
  const navigate = useNavigate();

  // Edge server selector and Geo-routing state
  const [routingMode, setRoutingMode] = useState("auto"); // "auto" | "manual"
  const [selectedNode, setSelectedNode] = useState("delhi"); // "delhi" | "mumbai" | "origin"
  const [latencies, setLatencies] = useState({ delhi: null, mumbai: null });
  const [probing, setProbing] = useState(false);
  const [routingStatus, setRoutingStatus] = useState("Probing nearest CDN edge node...");

  // Probe latency to an edge node using its /health endpoint
  const pingNode = async (url) => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${url}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });
      clearTimeout(id);
      if (!res.ok) return Infinity;
      return Math.round(performance.now() - start);
    } catch {
      return Infinity;
    }
  };

  // Automatically detect the lowest-latency edge server (Geo-Routing Simulation)
  const detectNearestEdge = useCallback(async () => {
    setProbing(true);
    setRoutingStatus("Measuring latency to global CDN edge servers...");

    const [delhiMs, mumbaiMs] = await Promise.all([
      pingNode(DELHI_EDGE_URL),
      pingNode(MUMBAI_EDGE_URL)
    ]);

    setLatencies({ delhi: delhiMs, mumbai: mumbaiMs });
    setProbing(false);

    // Failover if both nodes are unreachable
    if (delhiMs === Infinity && mumbaiMs === Infinity) {
      setSelectedNode("origin");
      setRoutingStatus("Edge nodes unreachable. Automatically failed over to Direct Origin.");
      return;
    }

    if (delhiMs === Infinity) {
      setSelectedNode("mumbai");
      setRoutingStatus(`Delhi node unreachable. Auto-routed to Mumbai Edge (${mumbaiMs}ms).`);
      return;
    }

    if (mumbaiMs === Infinity) {
      setSelectedNode("delhi");
      setRoutingStatus(`Mumbai node unreachable. Auto-routed to Delhi Edge (${delhiMs}ms).`);
      return;
    }

    // Auto-select node with lowest latency (nearest geographical PoP)
    if (delhiMs <= mumbaiMs) {
      setSelectedNode("delhi");
      setRoutingStatus(`Smart Geo-Routing: Auto-routed to Delhi Edge Node (Lowest Latency: ${delhiMs}ms vs Mumbai ${mumbaiMs}ms)`);
    } else {
      setSelectedNode("mumbai");
      setRoutingStatus(`Smart Geo-Routing: Auto-routed to Mumbai Edge Node (Lowest Latency: ${mumbaiMs}ms vs Delhi ${delhiMs}ms)`);
    }
  }, []);

  // Run auto geo-routing when video loads or auto mode is re-triggered
  useEffect(() => {
    if (routingMode === "auto") {
      detectNearestEdge();
    }
  }, [video?.id, routingMode, detectNearestEdge]);

  if (!video) return null;

  // Determine stream endpoint based on selected node
  const filename = video.filename || (video.url ? video.url.replace("/videos/", "") : "");
  
  let videoSrc = "";
  let nodeLabel = "";
  if (selectedNode === "delhi") {
    videoSrc = `${DELHI_EDGE_URL}/videos/${filename}`;
    nodeLabel = `Delhi Edge Node${latencies.delhi !== null && latencies.delhi !== Infinity ? ` (${latencies.delhi}ms)` : ""}`;
  } else if (selectedNode === "mumbai") {
    videoSrc = `${MUMBAI_EDGE_URL}/videos/${filename}`;
    nodeLabel = `Mumbai Edge Node${latencies.mumbai !== null && latencies.mumbai !== Infinity ? ` (${latencies.mumbai}ms)` : ""}`;
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
        {/* Stream Source Selector for College Demo with Smart Geo-Routing */}
        <div className="stream-source-selector">
          <div className="stream-source-label">
            <Radio size={16} color="var(--primary-accent)" />
            <span>Streaming Node:</span>
          </div>
          <div className="stream-source-buttons">
            <button
              className={`node-pill ${routingMode === "auto" ? "active" : ""}`}
              onClick={() => {
                setRoutingMode("auto");
                detectNearestEdge();
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
              title="Automatically probe latency to nearest CDN edge server"
            >
              <Zap size={13} color={routingMode === "auto" ? "#facc15" : "currentColor"} />
              <span>Auto (Smart Geo-Routing)</span>
              {probing && <span style={{ fontSize: "10px", marginLeft: "2px" }}>⏳</span>}
            </button>
            <button
              className={`node-pill ${routingMode === "manual" && selectedNode === "delhi" ? "active" : ""}`}
              onClick={() => {
                setRoutingMode("manual");
                setSelectedNode("delhi");
                setRoutingStatus("Manual Override: Streaming from Delhi Edge Node");
              }}
            >
              Delhi Edge {latencies.delhi !== null && latencies.delhi !== Infinity ? `(${latencies.delhi}ms)` : ""}
            </button>
            <button
              className={`node-pill ${routingMode === "manual" && selectedNode === "mumbai" ? "active" : ""}`}
              onClick={() => {
                setRoutingMode("manual");
                setSelectedNode("mumbai");
                setRoutingStatus("Manual Override: Streaming from Mumbai Edge Node");
              }}
            >
              Mumbai Edge {latencies.mumbai !== null && latencies.mumbai !== Infinity ? `(${latencies.mumbai}ms)` : ""}
            </button>
            <button
              className={`node-pill ${routingMode === "manual" && selectedNode === "origin" ? "active" : ""}`}
              onClick={() => {
                setRoutingMode("manual");
                setSelectedNode("origin");
                setRoutingStatus("Manual Override: Streaming directly from Origin Server");
              }}
            >
              Direct Origin
            </button>
          </div>

          {/* Live Geo-Routing Status Feedback */}
          {routingStatus && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.8rem",
              color: routingMode === "auto" ? "#16a34a" : "var(--text-secondary)",
              marginTop: "4px",
              width: "100%",
              fontWeight: 500
            }}>
              <Globe2 size={14} color={routingMode === "auto" ? "#16a34a" : "var(--text-secondary)"} />
              <span>{routingStatus}</span>
            </div>
          )}
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
