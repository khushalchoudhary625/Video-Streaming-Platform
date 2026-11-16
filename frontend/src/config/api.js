// API and CDN Edge Node endpoints configuration
// Defaults to local ports for development; uses Vite environment variables or Vercel serverless API in production.

const isBrowser = typeof window !== "undefined";
const isLocalhost = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// If VITE_API_URL is configured in Vercel, use it.
// Otherwise, on localhost use port 5000; on Vercel use relative "" (hits /api on same domain)
export const ORIGIN_API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
  : (isLocalhost ? "http://localhost:5000" : "");

export const DELHI_EDGE_URL = import.meta.env.VITE_DELHI_URL
  ? import.meta.env.VITE_DELHI_URL.replace(/\/+$/, "")
  : (isLocalhost ? "http://localhost:4001" : "");

export const MUMBAI_EDGE_URL = import.meta.env.VITE_MUMBAI_URL
  ? import.meta.env.VITE_MUMBAI_URL.replace(/\/+$/, "")
  : (isLocalhost ? "http://localhost:4002" : "");
