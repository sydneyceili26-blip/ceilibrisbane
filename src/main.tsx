import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Load AdSense only when running in a real browser (not Capacitor native)
if (typeof window !== "undefined" && window.location.protocol !== "capacitor:") {
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5768325702216711";
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

try {
  createRoot(rootEl).render(<App />);
} catch (err) {
  rootEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;padding:2rem;text-align:center;font-family:sans-serif"><h1 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">Something went wrong</h1><p style="color:#666;max-width:24rem">${err instanceof Error ? err.message : "Unknown error"}</p><a href="/" style="margin-top:1.5rem;padding:0.5rem 1.5rem;background:#1e5a3a;color:#fff;border-radius:999px;text-decoration:none">Go home</a></div>`;
}
