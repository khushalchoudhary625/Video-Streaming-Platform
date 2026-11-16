import React, { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import VideoPlayer from "../components/VideoPlayer";
import CloudDashboard from "../components/CloudDashboard";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Watch({ videos = [], showCloudStats, onDeleteVideo, onViewIncrement }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Find target video from state or videos list
  const currentVideo = location.state?.video || videos.find((v) => String(v.id) === String(id));
  const [viewTracked, setViewTracked] = useState(false);

  const recommended = videos.filter((v) => String(v.id) !== String(id));

  // Handler when video starts playing to increment views in MongoDB
  const handlePlay = async (videoId) => {
    if (viewTracked) return;
    setViewTracked(true);

    try {
      const res = await fetch(`http://localhost:5000/api/videos/${videoId}/view`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.views && onViewIncrement) {
          onViewIncrement(videoId, data.views);
        }
      }
    } catch (err) {
      console.warn("Could not increment views:", err.message);
    }
  };

  if (!currentVideo) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <h2>Video Not Found</h2>
        <p style={{ color: "var(--text-secondary)", margin: "12px 0 20px" }}>
          The requested video could not be loaded or may have been removed.
        </p>
        <button className="btn-upload" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Admin Only: Cloud CDN Telemetry */}
      {isAdmin && showCloudStats && <CloudDashboard />}
      
      <button 
        onClick={() => navigate(-1)} 
        className="btn-action" 
        style={{ marginBottom: "16px", cursor: "pointer" }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <VideoPlayer 
        video={currentVideo} 
        recommendedVideos={recommended} 
        onPlay={handlePlay}
        onDeleteVideo={onDeleteVideo}
      />
    </div>
  );
}
