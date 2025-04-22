console.log("[Renderer] Script loaded");

const urlbar = document.getElementById("urlbar");
const urlbarContainer = document.getElementById("urlbar-container");
const overlay = document.getElementById("overlay");
const browserContainer = document.getElementById("browser-container");

if (!window.electronAPI) {
  console.error("[Renderer] CRITICAL: electronAPI is not defined.");
  alert("Error: Browser components failed to load.");
} else {
  console.log("[Renderer] electronAPI found.");

  // --- Listeners for events from Main Process ---

  window.electronAPI.onShowUrlBar((currentURL) => {
    console.log("[Renderer] Received show-url-bar, Current URL:", currentURL);
    urlbar.classList.add("visible");
    urlbarContainer.classList.add("visible");
    urlbar.value = currentURL || "";
    urlbar.select();
    urlbar.focus();
  });

  window.electronAPI.onHideUrlBar(() => {
    console.log("[Renderer] Received hide-url-bar");
    urlbar.value = "";
    urlbar.classList.remove("visible");
    urlbarContainer.classList.remove("visible");
    urlbar.blur(); // Just remove focus from bar
  });

  // --- Event listeners for the URL Bar Input ---

  urlbar.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const urlValue = urlbar.value.trim();
      if (urlValue) {
        console.log(`[Renderer] Enter pressed. Sending URL: ${urlValue}`);
        window.electronAPI.sendLoadURL(urlValue);
      } else {
        console.log("[Renderer] Enter pressed on empty bar. Hiding.");
        window.electronAPI.sendUrlBarEscape();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      console.log("[Renderer] Escape pressed. Notifying main.");
      window.electronAPI.sendUrlBarEscape();
    }
  });

  // No need for overlay click handler for hiding URL bar anymore
  // But we'll keep the code structure for now

  console.log("[Renderer] Event listeners attached.");
}
