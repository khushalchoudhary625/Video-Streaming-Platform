import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import UploadPage from "./pages/Upload";
import AuthModal from "./components/AuthModal";
import { AuthProvider } from "./context/AuthContext";

// Sample initial demo videos for Cloud Computing presentation
const INITIAL_DEMO_VIDEOS = [
  {
    id: "demo-cloud-1",
    title: "Introduction to Cloud Computing & CDN Architecture",
    description: "Learn how content delivery networks (CDNs) distribute video content globally with minimal latency, edge caching, and origin shield servers.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
    views: 1245,
    uploadDate: "2 days ago",
    duration: "09:56",
    isUserUploaded: false
  },
  {
    id: "demo-cloud-2",
    title: "High Performance Video Streaming Protocols (HLS & DASH)",
    description: "Deep dive into adaptive bitrate streaming, chunking media segments, and optimizing throughput across edge nodes.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80",
    views: 540,
    uploadDate: "3 days ago",
    duration: "10:53",
    isUserUploaded: false
  },
  {
    id: "demo-cloud-3",
    title: "CDN Edge Cache Hit Ratio & Latency Benchmarks",
    description: "Measuring origin server load reduction and edge node responsiveness for high quality video playback.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80",
    views: 2100,
    uploadDate: "5 days ago",
    duration: "00:15",
    isUserUploaded: false
  }
];

function AppContent() {
  const [videos, setVideos] = useState(INITIAL_DEMO_VIDEOS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [searchFilter, setSearchFilter] = useState("");
  const [showCloudStats, setShowCloudStats] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Fetch uploaded videos from backend API
  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch("http://localhost:5000/api/videos");
      if (res.ok) {
        const backendVideos = await res.json();
        // Combine user uploaded videos from backend with demo videos
        const combined = [
          ...backendVideos,
          ...INITIAL_DEMO_VIDEOS
        ];
        setVideos(combined);
      } else {
        console.warn("Backend API endpoint failed, falling back to local demo list.");
      }
    } catch (err) {
      console.error("Error fetching uploaded videos:", err);
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
                />
              }
            />
            <Route
              path="/watch/:id"
              element={
                <Watch 
                  videos={videos} 
                  showCloudStats={showCloudStats} 
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