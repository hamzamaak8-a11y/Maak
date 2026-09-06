import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/app-shell.css";
import "./styles/design-system.css";
import "./styles/wokka-inspired.css";
import "./styles/wokka-refinements.css";
import "./styles/mobile-shell-fix.css";
import "./styles/final-responsive-polish.css";

// Restore a deep-linked route saved by /Maak/404.html (GitHub Pages SPA fallback).
(function () {
  try {
    var stored = sessionStorage.getItem("maak:deep-link");
    if (stored) {
      sessionStorage.removeItem("maak:deep-link");
      var current = window.location.pathname + window.location.search + window.location.hash;
      if (stored !== current) {
        window.history.replaceState({}, "", stored);
      }
    }
  } catch (e) {
    /* sessionStorage may be unavailable; the app still boots at the root */
  }
})();

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", {
      scope: "./",
    }).catch(() => {
      // The app remains fully usable when service workers are unavailable.
    });
  });
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
