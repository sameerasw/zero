const {
  app,
  BrowserWindow,
  BrowserView,
  globalShortcut,
  ipcMain,
  Menu,
} = require("electron"); // Added Menu
const path = require("path");

let mainWindow = null;
let webView = null;
let isUrlBarVisible = false; // Track URL bar state
const urlBarHeight = 60; // Define the height needed for the URL bar area (adjust as needed)

// --- Utility to process URL input (keep the previous version) ---
function processUrlInput(input) {
  input = input.trim();
  if (!input) return "about:blank";
  if (/^[a-z]+:\/\//i.test(input) || input.startsWith("about:")) {
    return input;
  }
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/.*)?$/i.test(input)) {
    return `http://${input}`;
  }
  if (input.includes(".") && !input.includes(" ") && !input.includes("/")) {
    if (input.match(/^[a-zA-Z0-9-]+$/) && input !== "localhost") {
      // Single word without dot, likely search
    } else {
      return `https://${input}`; // Default to https for domain-like strings
    }
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(input)}`;
}

// --- Function to Update webView Bounds ---
function updateWebViewBounds() {
  if (!mainWindow || !webView || webView.webContents.isDestroyed()) return;

  const bounds = mainWindow.getContentBounds();

  // Always set webView to full size regardless of URL bar visibility
  webView.setBounds({
    x: 0,
    y: 0,
    width: bounds.width,
    height: bounds.height,
  });

  console.log(
    `[Main] Updated webView bounds: Full window size, BarVisible=${isUrlBarVisible}`
  );
}

// Function to toggle BrowserView visibility
function toggleBrowserViewVisibility(visible) {
  if (!mainWindow || !webView || webView.webContents.isDestroyed()) return;

  if (visible) {
    mainWindow.addBrowserView(webView);
    console.log("[Main] BrowserView added to window");
  } else {
    mainWindow.removeBrowserView(webView);
    console.log("[Main] BrowserView removed from window");
  }
}

// --- Create the main application window ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    vibrancy: "under-window",
    titleBarStyle: "hidden",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Load the UI file (which only contains the URL bar now)
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  console.log("[Main] index.html loaded for UI shell.");

  // Create the BrowserView
  webView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Allow DevTools in the view as well
      devTools: true, // Explicitly allow DevTools for the view
    },
  });

  // *** Do NOT set BrowserView immediately ***
  // We'll add it once the main window is ready

  // --- Main Window Event Handling ---
  mainWindow.once("ready-to-show", () => {
    console.log("[Main] Main window ready-to-show.");
    // NOW add the BrowserView
    mainWindow.setBrowserView(webView); // Use setBrowserView instead of addBrowserView
    console.log("[Main] BrowserView set to main window.");

    updateWebViewBounds(); // Set initial bounds (bar hidden)
    mainWindow.show();

    webView.webContents
      .loadURL("https://duckduckgo.com")
      .then(() => console.log("[Main] Initial page loaded in webView."))
      .catch((err) =>
        console.error("[Main] Initial webView loadURL failed:", err)
      );

    // Open DevTools for the *main window* (UI shell) - USEFUL!
    // Make sure this one opens reliably
    mainWindow.webContents.openDevTools({ mode: "detach" });
    console.log("[Main] Requested DevTools for main window.");

    // You might also want DevTools for the webView content
    // webView.webContents.openDevTools({ mode: 'undocked' });
    // console.log("[Main] Requested DevTools for webView.");
  });

  mainWindow.on("resize", updateWebViewBounds); // Update view on resize

  mainWindow.on("closed", () => {
    // webView is automatically destroyed when using addBrowserView and window closes
    webView = null;
    mainWindow = null;
    globalShortcut.unregisterAll();
    app.quit(); // Ensure app quits cleanly
  });

  // --- Global Shortcuts ---
  globalShortcut.register("CommandOrControl+L", () => {
    if (mainWindow && webView) {
      isUrlBarVisible = !isUrlBarVisible; // Toggle state
      console.log(
        `[Main] Ctrl+L pressed. Toggling URL bar visibility to: ${isUrlBarVisible}`
      );

      // Toggle BrowserView visibility based on URL bar state
      toggleBrowserViewVisibility(!isUrlBarVisible);

      const currentURL = isUrlBarVisible ? webView.webContents.getURL() : "";
      // Send corresponding command
      if (isUrlBarVisible) {
        mainWindow.webContents.send("show-url-bar", currentURL);
        // No need to adjust bounds anymore
      } else {
        mainWindow.webContents.send("hide-url-bar");
        webView.webContents.focus(); // Focus content when hiding bar
      }
    }
  });

  // --- IPC Handlers ---
  ipcMain.on("load-url", (event, url) => {
    if (webView && !webView.webContents.isDestroyed()) {
      const finalUrl = processUrlInput(url);
      console.log(`[Main] IPC: load-url request. Loading: ${finalUrl}`);
      webView.webContents
        .loadURL(finalUrl)
        .then(() => {
          console.log(`[Main] IPC: Successfully loaded: ${finalUrl}`);
          isUrlBarVisible = false; // Hide bar on success
          toggleBrowserViewVisibility(true); // Show BrowserView again
          mainWindow.webContents.send("hide-url-bar"); // Tell renderer
          webView.webContents.focus(); // Focus content
        })
        .catch((err) => {
          console.error(`[Main] IPC: Failed to load URL "${finalUrl}":`, err);
          // Keep the bar open on failure? Or show an error?
          // For now, just log it. Bar remains visible.
        });
    } else {
      console.error("[Main] IPC: Cannot load URL - webView is missing.");
    }
  });

  ipcMain.on("url-bar-escape", () => {
    if (mainWindow && isUrlBarVisible) {
      console.log("[Main] IPC: url-bar-escape received.");
      isUrlBarVisible = false;
      toggleBrowserViewVisibility(true); // Show BrowserView again
      mainWindow.webContents.send("hide-url-bar"); // Tell renderer
      webView?.webContents.focus(); // Focus content
    }
  });

  // No need for 'focus-view' IPC, handled directly when hiding bar.

  // --- Setup Basic Application Menu (Includes DevTools Toggle) ---
  const menuTemplate = [
    // { role: 'appMenu' } // Basic macOS menu (App Name, About, Services, Hide, Quit)
    ...(process.platform === "darwin"
      ? [
          {
            label: app.getName(),
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideothers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forcereload" },
        { type: "separator" },
        // DevTools for the Main Window (URL Bar UI)
        {
          label: "Toggle UI Developer Tools",
          accelerator: "Alt+CommandOrControl+I",
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
        // DevTools for the Web Content (BrowserView)
        {
          label: "Toggle Web Content Developer Tools",
          accelerator: "Shift+CommandOrControl+I", // Different shortcut
          click: () => {
            if (webView) webView.webContents.toggleDevTools();
          },
        },
      ],
    },
    // Add other menus like Edit, Window if desired
    { role: "editMenu" },
    { role: "windowMenu" },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
} // --- End of createWindow ---

// --- App Lifecycle ---
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // On macOS, apps usually stay active until Cmd+Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
