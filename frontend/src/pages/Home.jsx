import React from "react";
import VideoGrid from "../components/VideoGrid";
import CloudDashboard from "../components/CloudDashboard";
import { AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Home({ 
  videos, 
  loading, 
  error, 
  activeTab, 
  setActiveTab, 
  searchQuery, 
  showCloudStats 
}) {
  const { isAdmin } = useAuth();

  const tabs = [
    { id: "home", label: "Home" },
    { id: "trending", label: "Trending" },
    { id: "latest", label: "Latest" },
    { id: "my-videos", label: "My Videos" },
  ];

  // Filter videos based on category tab and search query
  const filteredVideos = videos.filter((video) => {
    // Search query match
    if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Category filter
    if (activeTab === "my-videos") {
      return video.isUserUploaded === true;
    }

    return true;
  });

  return (
    <div>
      {/* Cloud Performance Metrics Card (Admin Only) */}
      {isAdmin && showCloudStats && <CloudDashboard />}

      {/* Hero Welcome Banner */}
      <div className="hero-banner">
        <div>
          <div className="hero-badge">Cloud Computing CDN Project</div>
          <h1 className="hero-title">Welcome to StreamCloud</h1>
          <p className="hero-subtitle">
            Watch and share high-definition videos with low latency content delivery.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="tabs-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="alert-message error" style={{ marginBottom: "20px" }}>
          <AlertCircle size={18} />
          <span>Unable to load videos. Please check your backend connection and try again.</span>
        </div>
      )}

      {/* Recommended / Filtered Videos Grid */}
      <div style={{ marginBottom: "16px" }}>
        <h2 className="section-title">
          {searchQuery ? `Search results for "${searchQuery}"` : (
            activeTab === "home" ? "Recommended Videos" : 
            activeTab === "trending" ? "Trending Videos" : 
            activeTab === "latest" ? "Latest Uploads" : "My Uploaded Videos"
          )}
        </h2>
      </div>

      <VideoGrid 
        videos={filteredVideos} 
        loading={loading} 
        emptyMessage={
          searchQuery 
            ? `No videos matching "${searchQuery}".` 
            : activeTab === "my-videos" 
              ? "You haven't uploaded any videos yet." 
              : "No videos available."
        }
      />
    </div>
  );
}
