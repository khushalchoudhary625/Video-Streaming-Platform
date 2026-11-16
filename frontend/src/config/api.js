// API and CDN Edge Node endpoints configuration
// Defaults to local ports for development; uses Vite environment variables in production (Vercel)

export const ORIGIN_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const DELHI_EDGE_URL = import.meta.env.VITE_DELHI_URL || "http://localhost:4001";
export const MUMBAI_EDGE_URL = import.meta.env.VITE_MUMBAI_URL || "http://localhost:4002";
