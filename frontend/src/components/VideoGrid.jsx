import React from "react";
import VideoCard from "./VideoCard";
import SkeletonGrid from "./Loading";
import { Film, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function VideoGrid({ videos, loading, emptyMessage, onDeleteVideo }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  if (loading) {
    return <SkeletonGrid count={8} />;
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Film size={32} />
        </div>
        <h3 className="empty-title">No videos yet</h3>
        <p className="empty-desc">
          {emptyMessage || "Upload your first video and start building your video library."}
        </p>
        {isAdmin && (
          <button className="btn-upload" onClick={() => navigate("/upload")}>
            <Upload size={16} />
            Upload Video
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onDelete={onDeleteVideo}
        />
      ))}
    </div>
  );
}
