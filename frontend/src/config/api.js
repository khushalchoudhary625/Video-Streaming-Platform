// API and CDN Edge Node endpoints configuration
// Automatically connects to your live Render backend in production (Vercel)
// and falls back to local ports for offline/local development.

const isBrowser = typeof window !== "undefined";
const isLocalhost = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const RENDER_BACKEND = "https://video-streaming-platform-igsp.onrender.com";

// Origin API Server
export const ORIGIN_API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
  : (isLocalhost ? "http://localhost:5000" : RENDER_BACKEND);

// Delhi Edge Node (Deployed on Render, falls back to 4001 on localhost)
export const DELHI_EDGE_URL = import.meta.env.VITE_DELHI_URL
  ? import.meta.env.VITE_DELHI_URL.replace(/\/+$/, "")
  : (isLocalhost ? "http://localhost:4001" : "https://video-streaming-platform-2-29ky.onrender.com");

// Mumbai Edge Node (Deployed on Render, falls back to 4002 on localhost)
export const MUMBAI_EDGE_URL = import.meta.env.VITE_MUMBAI_URL
  ? import.meta.env.VITE_MUMBAI_URL.replace(/\/+$/, "")
  : (isLocalhost ? "http://localhost:4002" : "https://video-streaming-platform-1-l7z7.onrender.com");
