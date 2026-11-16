import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import UploadPage from "./pages/Upload";
import AuthModal from "./components/AuthModal";
import { AuthProvider } from "./context/AuthContext";
import { ORIGIN_API_URL } from "./config/api";

function AppContent() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [searchFilter, setSearchFilter] = useState("");
  const [showCloudStats, setShowCloudStats] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Fetch real uploaded videos from backend MongoDB API
  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch(`${ORIGIN_API_URL}/api/videos`);
      if (res.ok) {
        const backendVideos = await res.json();
        setVideos(backendVideos || []);
      } else {
        setError(true);
        console.warn("Backend API endpoint failed.");
      }
    } catch (err) {
      console.error("Error fetching uploaded videos:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleUploadSuccess = (newVideo) => {
    setVideos((prev) => [newVideo, ...prev]);
  };

  const handleDeleteVideo = (deletedId) => {
    setVideos((prev) => prev.filter((v) => String(v.id) !== String(deletedId)));
  };

  const handleViewIncrement = (videoId, newViews) => {
    setVideos((prev) =>
      prev.map((v) =>
        String(v.id) === String(videoId) ? { ...v, views: newViews } : v
      )
    );
  };

  return (
    <div className="app-container">
      <Navbar
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        toggleCloudStats={() => setShowCloudStats((prev) => !prev)}
        showCloudStats={showCloudStats}
        toggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
      />

      <div className="main-layout">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileSidebarOpen}
          closeMobileSidebar={() => setMobileSidebarOpen(false)}
          toggleCloudStats={() => setShowCloudStats((prev) => !prev)}
        />

        <main className="content-area">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  videos={videos}
                  loading={loading}
                  error={error}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  searchQuery={searchFilter}
                  showCloudStats={showCloudStats}
                  onDeleteVideo={handleDeleteVideo}
                />
              }
            />
            <Route
              path="/watch/:id"
              element={
                <Watch 
                  videos={videos} 
                  showCloudStats={showCloudStats}
                  onDeleteVideo={handleDeleteVideo}
                  onViewIncrement={handleViewIncrement}
                />
              }
            />
            <Route
              path="/upload"
              element={
                <UploadPage
                  onUploadSuccess={handleUploadSuccess}
                  showCloudStats={showCloudStats}
                />
              }
            />
          </Routes>
        </main>
      </div>

      {/* Global Authentication Modal */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}