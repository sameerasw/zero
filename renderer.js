console.log("[Renderer] Script loaded");

const urlbar = document.getElementById("urlbar");
const urlbarContainer = document.getElementById("urlbar-container");
const overlay = document.getElementById("overlay");
const browserContainer = document.getElementById("browser-container");

browserContainer.classList.add("browser-container-with-urlbar");

if (!window.electronAPI) {
  console.error("[Renderer] CRITICAL: electronAPI is not defined.");
  alert("Error: Browser components failed to load.");
} else {
  console.log("[Renderer] electronAPI found.");

  window.electronAPI.onShowUrlBar((currentURL) => {
    console.log("[Renderer] Received show-url-bar, Current URL:", currentURL);

    urlbarContainer.classList.add("visible");

    setTimeout(() => {
      urlbar.classList.add("visible");
      urlbar.value = currentURL || "";
      urlbar.select();
      urlbar.focus();
    }, 50);
  });

  window.electronAPI.onHideUrlBar(() => {
    console.log("[Renderer] Received hide-url-bar");

    urlbar.classList.remove("visible");

    setTimeout(() => {
      urlbarContainer.classList.remove("visible");
      urlbar.value = "";
      urlbar.blur();
    }, 100);
  });

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

  console.log("[Renderer] Event listeners attached.");
}
