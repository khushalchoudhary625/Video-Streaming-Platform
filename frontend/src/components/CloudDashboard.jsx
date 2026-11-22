import React, { useState, useEffect, useCallback } from "react";
import { 
  Server, 
  Activity, 
  Zap, 
  HardDrive, 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  Database,
  ArrowRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ORIGIN_API_URL } from "../config/api";

export default function CloudDashboard() {
  const { token, isAdmin } = useAuth();

  const [metricsData, setMetricsData] = useState({
    overview: {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatio: "0.0%",
      originRequests: 0,
      bandwidthServedMB: "0.00",
      activeEdgeServers: 0,
      totalVideosStored: 0,
      originStorageUsedMB: "0.00 MB"
    },
    delhi: {
      edge: "Delhi",
      port: 4001,
      online: false,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatio: "0.0%",
      originFetches: 0,
      bytesServedMB: "0.00",
      cacheStorageUsedMB: "0.00",
      cachedFiles: 0,
      uptimeSeconds: 0,
      recentActivity: []
    },
    mumbai: {
      edge: "Mumbai",
      port: 4002,
      online: false,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatio: "0.0%",
      originFetches: 0,
      bytesServedMB: "0.00",
      cacheStorageUsedMB: "0.00",
      cachedFiles: 0,
      uptimeSeconds: 0,
      recentActivity: []
    },
    recentActivity: []
  });

  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async (isManual = false) => {
    if (!isAdmin || !token) return;
    if (isManual) setLoading(true);

    try {
      const res = await fetch(`${ORIGIN_API_URL}/api/videos/metrics`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setMetricsData({
          overview: data.overview || {},
          delhi: data.delhi || { online: false },
          mumbai: data.mumbai || { online: false },
          recentActivity: Array.isArray(data.recentActivity) ? data.recentActivity : []
        });
        setLastUpdated(new Date().toLocaleTimeString());
        setError(null);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || `Server responded with status ${res.statusCode}`);
      }
    } catch (err) {
      console.warn("Could not fetch CDN metrics:", err.message);
      setError("Cannot connect to Origin Server metrics endpoint (Port 5000).");
    } finally {
      if (isManual) setLoading(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    fetchMetrics();

    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMetrics(false);
    }, 6000);

    return () => clearInterval(interval);
  }, [fetchMetrics, autoRefresh]);

  const overview = metricsData.overview;
  const delhi = metricsData.delhi;
  const mumbai = metricsData.mumbai;
  const recentActivity = metricsData.recentActivity;

  // Overview metric cards configuration
  const overviewCards = [
    { 
      label: "Total Requests", 
      value: overview.totalRequests ?? 0, 
      icon: Zap, 
      color: "#2563eb",
      desc: "All Edge server queries"
    },
    { 
      label: "Cache Hits", 
      value: overview.cacheHits ?? 0, 
      icon: CheckCircle2, 
      color: "#16a34a",
      desc: "Served from disk cache"
    },
    { 
      label: "Cache Misses", 
      value: overview.cacheMisses ?? 0, 
      icon: AlertCircle, 
      color: "#ea580c",
      desc: "Required origin fetch"
    },
    { 
      label: "Cache Hit Ratio", 
      value: overview.hitRatio || "0.0%", 
      icon: TrendingUp, 
      color: "#9333ea",
      desc: "Efficiency indicator"
    },
    { 
      label: "Origin Requests", 
      value: overview.originRequests ?? 0, 
      icon: Server, 
      color: "#0284c7",
      desc: "Traffic sent to port 5000"
    },
    { 
      label: "Bandwidth Served", 
      value: `${overview.bandwidthServedMB || "0.00"} MB`, 
      icon: HardDrive, 
      color: "#d97706",
      desc: "Delivered edge data"
    },
    { 
      label: "Active Edge Nodes", 
      value: `${overview.activeEdgeServers ?? 0} / 2`, 
      icon: Radio, 
      color: overview.activeEdgeServers === 2 ? "#059669" : "#dc2626",
      desc: "Delhi (4001) & Mumbai (4002)"
    }
  ];

  // Helper to format timestamps
  const formatTime = (isoString) => {
    if (!isoString) return "--";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return isoString;
    }
  };

  // Helper to calculate hit ratio percentage number
  const parseRatio = (ratioStr) => {
    if (!ratioStr) return 0;
    const num = parseFloat(ratioStr.replace("%", ""));
    return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
  };

  const delhiHitPct = parseRatio(delhi.hitRatio);
  const mumbaiHitPct = parseRatio(mumbai.hitRatio);
  const totalHitPct = parseRatio(overview.hitRatio);

  return (
    <div className="cloud-dashboard-card">
      {/* Top Header */}
      <div className="cloud-dashboard-header">
        <div>
          <div className="cloud-title">
            <Server size={22} color="#E50914" />
            <span>NetNoflix CDN & Edge Telemetry Dashboard</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "3px" }}>
            Real-time live metrics aggregated across Origin (5000), Delhi Edge (4001) and Mumbai Edge (4002)
          </div>
        </div>

        <div className="cloud-controls">
          {lastUpdated && (
            <span className="cloud-update-time">
              Updated: <strong>{lastUpdated}</strong>
            </span>
          )}

          <button 
            className="node-pill" 
            style={{ fontSize: "0.75rem", padding: "4px 10px" }}
            onClick={() => setAutoRefresh(prev => !prev)}
            title="Toggle automatic refresh every 6 seconds"
          >
            Auto-refresh: {autoRefresh ? "ON (6s)" : "OFF"}
          </button>

          <button
            className="btn-refresh-metrics"
            onClick={() => fetchMetrics(true)}
            disabled={loading}
            title="Refresh metrics now"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-message error" style={{ marginBottom: "16px" }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Overview Metric Cards Grid */}
      <div className="cloud-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {overviewCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="metric-box">
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px" }}>
                <Icon size={18} color={card.color} />
              </div>
              <div className="metric-value">{card.value}</div>
              <div className="metric-label">{card.label}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: "4px", opacity: 0.8 }}>
                {card.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Edge Servers Comparison: Delhi vs Mumbai */}
      <div className="dashboard-subheading">
        <Activity size={18} color="#2563eb" />
        <span>Custom CDN Edge Nodes: Real-Time Status & Performance</span>
      </div>

      <div className="edge-comparison-grid">
        {/* Delhi Node Card */}
        <div className="edge-node-card">
          <div className="edge-node-header">
            <div className="edge-node-title">
              <Radio size={16} color={delhi.online ? "#10b981" : "#ef4444"} />
              <span>Delhi Edge Server {delhi.port ? `(Port ${delhi.port})` : ""}</span>
            </div>
            <span className={`edge-status-pill ${delhi.online ? "online" : "offline"}`}>
              <span className="status-dot-pulse"></span>
              {delhi.online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          <div className="edge-mini-stats">
            <div className="mini-stat-box">
              <div className="mini-stat-val">{delhi.totalRequests ?? 0}</div>
              <div className="mini-stat-lbl">Total Requests</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val" style={{ color: "#16a34a" }}>{delhi.cacheHits ?? 0}</div>
              <div className="mini-stat-lbl">Cache Hits</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val" style={{ color: "#ea580c" }}>{delhi.cacheMisses ?? 0}</div>
              <div className="mini-stat-lbl">Cache Misses</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val" style={{ color: "#9333ea" }}>{delhi.hitRatio || "0.0%"}</div>
              <div className="mini-stat-lbl">Hit Ratio</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val">{delhi.bytesServedMB || "0.00"} MB</div>
              <div className="mini-stat-lbl">Bandwidth</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val">{delhi.cachedFiles ?? 0} ({delhi.cacheStorageUsedMB || "0.00"} MB)</div>
              <div className="mini-stat-lbl">Disk Cache</div>
            </div>
          </div>

          {/* Delhi Hit Ratio Bar */}
          <div className="ratio-meter-container">
            <div className="ratio-meter-header">
              <span>Cache Efficiency (Hits vs Misses)</span>
              <span>{delhi.hitRatio || "0.0%"}</span>
            </div>
            <div className="ratio-meter-bar">
              <div className="ratio-segment-hit" style={{ width: `${delhiHitPct}%` }}></div>
              <div className="ratio-segment-miss" style={{ width: `${100 - delhiHitPct}%` }}></div>
            </div>
          </div>
        </div>

        {/* Mumbai Node Card */}
        <div className="edge-node-card">
          <div className="edge-node-header">
            <div className="edge-node-title">
              <Radio size={16} color={mumbai.online ? "#10b981" : "#ef4444"} />
              <span>Mumbai Edge Server {mumbai.port ? `(Port ${mumbai.port})` : ""}</span>
            </div>
            <span className={`edge-status-pill ${mumbai.online ? "online" : "offline"}`}>
              <span className="status-dot-pulse"></span>
              {mumbai.online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          <div className="edge-mini-stats">
            <div className="mini-stat-box">
              <div className="mini-stat-val">{mumbai.totalRequests ?? 0}</div>
              <div className="mini-stat-lbl">Total Requests</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val" style={{ color: "#16a34a" }}>{mumbai.cacheHits ?? 0}</div>
              <div className="mini-stat-lbl">Cache Hits</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val" style={{ color: "#ea580c" }}>{mumbai.cacheMisses ?? 0}</div>
              <div className="mini-stat-lbl">Cache Misses</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val" style={{ color: "#9333ea" }}>{mumbai.hitRatio || "0.0%"}</div>
              <div className="mini-stat-lbl">Hit Ratio</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val">{mumbai.bytesServedMB || "0.00"} MB</div>
              <div className="mini-stat-lbl">Bandwidth</div>
            </div>
            <div className="mini-stat-box">
              <div className="mini-stat-val">{mumbai.cachedFiles ?? 0} ({mumbai.cacheStorageUsedMB || "0.00"} MB)</div>
              <div className="mini-stat-lbl">Disk Cache</div>
            </div>
          </div>

          {/* Mumbai Hit Ratio Bar */}
          <div className="ratio-meter-container">
            <div className="ratio-meter-header">
              <span>Cache Efficiency (Hits vs Misses)</span>
              <span>{mumbai.hitRatio || "0.0%"}</span>
            </div>
            <div className="ratio-meter-bar">
              <div className="ratio-segment-hit" style={{ width: `${mumbaiHitPct}%` }}></div>
              <div className="ratio-segment-miss" style={{ width: `${100 - mumbaiHitPct}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Visual Charts & Traffic Comparison */}
      <div className="dashboard-subheading">
        <TrendingUp size={18} color="#2563eb" />
        <span>Performance & Edge Traffic Distribution</span>
      </div>

      <div className="cdn-visualizer-row">
        {/* Hit Ratio Comparison */}
        <div className="visual-chart-card">
          <div className="chart-card-title">
            <span>Cache Hit Ratio Comparison</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Higher = Lower Origin Load</span>
          </div>
          <div className="chart-bar-group">
            <div className="chart-bar-item">
              <div className="chart-bar-label">
                <span>Combined CDN Average</span>
                <strong>{overview.hitRatio || "0.0%"}</strong>
              </div>
              <div className="chart-progress-track">
                <div 
                  className="chart-progress-fill" 
                  style={{ width: `${totalHitPct}%`, backgroundColor: "#9333ea" }}
                ></div>
              </div>
            </div>

            <div className="chart-bar-item">
              <div className="chart-bar-label">
                <span>Delhi Node (4001)</span>
                <strong>{delhi.hitRatio || "0.0%"}</strong>
              </div>
              <div className="chart-progress-track">
                <div 
                  className="chart-progress-fill" 
                  style={{ width: `${delhiHitPct}%`, backgroundColor: "#2563eb" }}
                ></div>
              </div>
            </div>

            <div className="chart-bar-item">
              <div className="chart-bar-label">
                <span>Mumbai Node (4002)</span>
                <strong>{mumbai.hitRatio || "0.0%"}</strong>
              </div>
              <div className="chart-progress-track">
                <div 
                  className="chart-progress-fill" 
                  style={{ width: `${mumbaiHitPct}%`, backgroundColor: "#0284c7" }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Origin Storage & Request Load */}
        <div className="visual-chart-card">
          <div className="chart-card-title">
            <span>Origin vs Edge Offload Summary</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Origin Server: Port 5000</span>
          </div>
          <div className="chart-bar-group">
            <div className="chart-bar-item">
              <div className="chart-bar-label">
                <span>Origin Stored Videos</span>
                <strong>{overview.totalVideosStored ?? 0} videos ({overview.originStorageUsedMB || "0.00 MB"})</strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Physical files stored in <code>backend/uploads/</code> and synced to MongoDB.
              </div>
            </div>

            <div className="chart-bar-item" style={{ marginTop: "6px" }}>
              <div className="chart-bar-label">
                <span>Total Edge Offloaded Bandwidth</span>
                <strong style={{ color: "#16a34a" }}>{overview.bandwidthServedMB || "0.00"} MB</strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Bandwidth served directly by Delhi and Mumbai edge caches without loading the origin.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Real Activity Logs */}
      <div className="dashboard-subheading">
        <Clock size={18} color="#2563eb" />
        <span>Recent Edge Server Activity Stream (Real Requests)</span>
      </div>

      <div className="activity-stream-container">
        {recentActivity.length === 0 ? (
          <div className="empty-activity-state">
            <p><strong>No CDN requests recorded yet in edge server memory.</strong></p>
            <p style={{ marginTop: "4px" }}>
              Open a video above and select either <em>Delhi Edge (4001)</em> or <em>Mumbai Edge (4002)</em> to observe real CACHE MISS and CACHE HIT events.
            </p>
          </div>
        ) : (
          <div className="activity-table-wrapper">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Node</th>
                  <th>Action</th>
                  <th>Requested Video</th>
                  <th>Bytes / Range</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((log, index) => {
                  let badgeClass = "badge-log ";
                  if (log.type === "CACHE HIT") badgeClass += "hit";
                  else if (log.type === "CACHE MISS") badgeClass += "miss";
                  else if (log.type === "ORIGIN FETCH") badgeClass += "origin";
                  else badgeClass += "error";

                  return (
                    <tr key={index}>
                      <td style={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                        {formatTime(log.timestamp)}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {log.edge || "Edge"}
                      </td>
                      <td>
                        <span className={badgeClass}>{log.type}</span>
                      </td>
                      <td style={{ fontFamily: "monospace", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.filename}>
                        {log.filename}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {log.bytes ? `${(log.bytes / 1024).toFixed(1)} KB` : log.range || "--"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {typeof log.durationMs === "number" ? `${log.durationMs}ms` : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
