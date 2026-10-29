import React, { useState } from "react";
import { X, Lock, Mail, User, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AuthModal() {
  const { authModalOpen, authMode, setAuthMode, closeAuthModal, login, register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (authMode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password, role);
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoRole) => {
    setError("");
    setLoading(true);
    try {
      if (demoRole === "admin") {
        await login("admin@streamcloud.com", "admin123");
      } else {
        await login("user@streamcloud.com", "user123");
      }
    } catch (err) {
      setError(err.message || "Demo login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeAuthModal}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={closeAuthModal} aria-label="Close">
          <X size={20} />
        </button>

        <div className="modal-header">
          <h2 className="modal-title">
            {authMode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="modal-subtitle">
            {authMode === "login"
              ? "Sign in to access your video streaming dashboard"
              : "Register to join StreamCloud platform"}
          </p>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${authMode === "login" ? "active" : ""}`}
            onClick={() => {
              setAuthMode("login");
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            className={`modal-tab ${authMode === "register" ? "active" : ""}`}
            onClick={() => {
              setAuthMode("register");
              setError("");
            }}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="alert-message error" style={{ margin: "16px 0 0" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
          {authMode === "register" && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-with-icon">
                <User size={18} className="field-icon" />
                <input
                  type="text"
                  className="form-input with-icon"
                  placeholder="e.g. Alex Johnson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="field-icon" />
              <input
                type="email"
                className="form-input with-icon"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input
                type="password"
                className="form-input with-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          {authMode === "register" && (
            <div className="form-group">
              <label className="form-label">Account Role</label>
              <div className="role-selector-grid">
                <label className={`role-option-card ${role === "user" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="accountRole"
                    value="user"
                    checked={role === "user"}
                    onChange={() => setRole("user")}
                  />
                  <div>
                    <div className="role-option-title">Student / Viewer</div>
                    <div className="role-option-desc">Stream and browse videos</div>
                  </div>
                </label>

                <label className={`role-option-card ${role === "admin" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="accountRole"
                    value="admin"
                    checked={role === "admin"}
                    onChange={() => setRole("admin")}
                  />
                  <div>
                    <div className="role-option-title">Administrator</div>
                    <div className="role-option-desc">Upload videos & view metrics</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-submit-upload"
            style={{ marginTop: "20px" }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : authMode === "login" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="demo-login-divider">
          <span>Quick Demo Access (College Evaluation)</span>
        </div>

        <div className="demo-buttons-row">
          <button
            type="button"
            className="btn-demo-login admin"
            onClick={() => handleQuickDemoLogin("admin")}
            disabled={loading}
          >
            <ShieldCheck size={16} />
            <span>Admin Demo</span>
          </button>
          <button
            type="button"
            className="btn-demo-login user"
            onClick={() => handleQuickDemoLogin("user")}
            disabled={loading}
          >
            <User size={16} />
            <span>Student User Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
