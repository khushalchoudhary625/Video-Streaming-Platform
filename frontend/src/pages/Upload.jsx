import React from "react";
import UploadForm from "../components/UploadForm";
import CloudDashboard from "../components/CloudDashboard";
import { ShieldAlert, LogIn, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function UploadPage({ onUploadSuccess, showCloudStats }) {
  const { isAdmin, openLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin) {
    return (
      <div className="upload-page-container" style={{ textAlign: "center", padding: "48px 24px" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "#fef2f2",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto"
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
          Admin Access Required
        </h2>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: "440px", margin: "0 auto 24px auto", lineHeight: 1.5 }}>
          {isAuthenticated
            ? "Your current account has viewer/student permissions. Only Administrators can upload videos and manage CDN origin storage."
            : "Video uploading is restricted to platform Administrators. Please log in with an administrator account to continue."}
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button className="btn-action" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
            <span>Back to Browse</span>
          </button>

          <button className="btn-upload" onClick={openLogin}>
            <LogIn size={16} />
            <span>Sign In as Admin</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {showCloudStats && <CloudDashboard />}
      <UploadForm onUploadSuccess={onUploadSuccess} />
    </div>
  );
}
