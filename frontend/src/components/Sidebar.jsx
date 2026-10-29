import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home as HomeIcon,
  Flame,
  Clock,
  Video,
  Upload,
  History,
  ThumbsUp,
  Server,
  Shield
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({
  activeTab,
  setActiveTab,
  mobileOpen,
  closeMobileSidebar,
  toggleCloudStats
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, openLogin, isAuthenticated } = useAuth();

  const handleNavClick = (tab, path) => {
    if (setActiveTab) setActiveTab(tab);
    if (path) navigate(path);
    if (closeMobileSidebar) closeMobileSidebar();
  };

  const navItems = [
    { id: "home", label: "Home", icon: HomeIcon, path: "/" },
    { id: "trending", label: "Trending", icon: Flame, path: "/" },
    { id: "latest", label: "Latest", icon: Clock, path: "/" },
    { id: "my-videos", label: "My Videos", icon: Video, path: "/" },
  ];

  const secondaryNavItems = [
    { id: "history", label: "History", icon: History, path: "/" },
    { id: "liked", label: "Liked Videos", icon: ThumbsUp, path: "/" },
  ];

  return (
    <>
      <div
        className={`sidebar-backdrop ${mobileOpen ? "mobile-open" : ""}`}
        onClick={closeMobileSidebar}
      />

      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === "/" && activeTab === item.id;

          return (
            <button
              key={item.id}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => handleNavClick(item.id, item.path)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="sidebar-divider" />

        <div className="sidebar-heading">Library</div>

        {secondaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => handleNavClick(item.id, item.path)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="sidebar-divider" />

        <div className="sidebar-heading">Administration</div>

        {isAdmin ? (
          <>
            <button
              className={`sidebar-item ${location.pathname === "/upload" ? "active" : ""}`}
              onClick={() => handleNavClick("upload", "/upload")}
            >
              <Upload size={18} />
              <span>Upload Video</span>
              <span className="sidebar-admin-pill">Admin</span>
            </button>

            <button
              className="sidebar-item"
              onClick={() => {
                if (toggleCloudStats) toggleCloudStats();
                if (closeMobileSidebar) closeMobileSidebar();
              }}
            >
              <Server size={18} />
              <span>Cloud CDN Stats</span>
              <span className="sidebar-admin-pill">Admin</span>
            </button>
          </>
        ) : (
          <button
            className="sidebar-item locked"
            onClick={() => {
              if (!isAuthenticated) {
                openLogin();
              }
              if (closeMobileSidebar) closeMobileSidebar();
            }}
            title="Administrator features"
          >
            <Shield size={18} />
            <span>Admin Portal</span>
            <span className="sidebar-lock-pill">Restricted</span>
          </button>
        )}
      </aside>
    </>
  );
}
