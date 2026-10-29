import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play, Search, Upload, Server, Menu, User, LogIn, LogOut, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar({
  searchFilter,
  setSearchFilter,
  toggleCloudStats,
  showCloudStats,
  toggleMobileSidebar
}) {
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, logout, openLogin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          className="menu-toggle"
          onClick={toggleMobileSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>

        <Link to="/" className="brand-logo">
          <div className="brand-icon">
            <Play size={18} fill="currentColor" />
          </div>
          <span>StreamCloud</span>
        </Link>
      </div>

      <div className="navbar-center">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search videos..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="navbar-right">
        {/* Admin only: Cloud Metrics toggle */}
        {isAdmin && (
          <button
            className="btn-cloud-toggle"
            onClick={toggleCloudStats}
            title="Toggle Cloud & CDN Metrics (Admin Only)"
          >
            <Server size={16} />
            <span className="desktop-only">
              {showCloudStats ? "Hide CDN Metrics" : "Cloud Metrics"}
            </span>
          </button>
        )}

        {/* Admin only: Upload Button */}
        {isAdmin && (
          <button
            className="btn-upload"
            onClick={() => navigate("/upload")}
            title="Upload Video (Admin Only)"
          >
            <Upload size={16} />
            <span className="desktop-only">Upload</span>
          </button>
        )}

        {/* Authentication State */}
        {isAuthenticated ? (
          <div className="user-menu-container" ref={dropdownRef}>
            <button
              className="user-profile-btn"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-label="User menu"
            >
              <div className="user-avatar-circle">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="user-name-text desktop-only">{user.name}</span>
              <span className={`role-badge ${user.role}`}>
                {user.role.toUpperCase()}
              </span>
            </button>

            {dropdownOpen && (
              <div className="user-dropdown-menu">
                <div className="dropdown-user-header">
                  <div className="dropdown-user-name">{user.name}</div>
                  <div className="dropdown-user-email">{user.email}</div>
                  <div className="dropdown-role-tag">
                    {isAdmin ? (
                      <span className="admin-tag">
                        <Shield size={12} /> Administrator
                      </span>
                    ) : (
                      <span className="user-tag">Viewer / Student</span>
                    )}
                  </div>
                </div>

                <div className="dropdown-divider" />

                {isAdmin && (
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      navigate("/upload");
                      setDropdownOpen(false);
                    }}
                  >
                    <Upload size={16} />
                    <span>Upload Video</span>
                  </button>
                )}

                <button
                  className="dropdown-item logout"
                  onClick={() => {
                    logout();
                    setDropdownOpen(false);
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn-signin" onClick={openLogin}>
            <LogIn size={16} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
