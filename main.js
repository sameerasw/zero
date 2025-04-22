const {
  app,
  BrowserWindow,
  BrowserView,
  globalShortcut,
  ipcMain,
  Menu,
} = require("electron");
const path = require("path");

let mainWindow = null;
let webView = null;
let isUrlBarVisible = false;
const urlBarHeight = 40;
let animationInProgress = false; 

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
    } else {
      return `https://${input}`;
    }
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(input)}`;
}

function updateWebViewBounds(animate = true) {
  if (!mainWindow || !webView || webView.webContents.isDestroyed()) return;

  const bounds = mainWindow.getContentBounds();

  if (animate && !animationInProgress) {
    animationInProgress = true;

    if (isUrlBarVisible) {
      webView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height,
      });

      setTimeout(() => {
        webView.setBounds({
          x: 0,
          y: urlBarHeight,
          width: bounds.width,
          height: bounds.height - urlBarHeight,
        });

        setTimeout(() => {
          animationInProgress = false;
        }, 350);
      }, 10);
    } else {
      setTimeout(() => {
        webView.setBounds({
          x: 0,
          y: 0,
          width: bounds.width,
          height: bounds.height,
        });

        setTimeout(() => {
          animationInProgress = false;
        }, 350);
      }, 100);
    }
  } else if (!animate) {
    if (isUrlBarVisible) {
      webView.setBounds({
        x: 0,
        y: urlBarHeight,
        width: bounds.width,
        height: bounds.height - urlBarHeight,
      });
    } else {
      webView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height,
      });
    }
  }

  console.log(
    `[Main] Updated webView bounds: ${
      isUrlBarVisible ? "Below URL bar" : "Full window"
    }, BarVisible=${isUrlBarVisible}`
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    vibrancy: "under-window",
    titleBarStyle: "hiddenInset",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  console.log("[Main] index.html loaded for UI shell.");

  // Create the BrowserView
  webView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    console.log("[Main] Main window ready-to-show.");
    mainWindow.setBrowserView(webView); 
    console.log("[Main] BrowserView set to main window.");

    updateWebViewBounds(false);
    mainWindow.show();

    webView.webContents
      .loadURL("https://duckduckgo.com")
      .then(() => console.log("[Main] Initial page loaded in webView."))
      .catch((err) =>
        console.error("[Main] Initial webView loadURL failed:", err)
      );

    // mainWindow.webContents.openDevTools({ mode: "detach" });
    // console.log("[Main] Requested DevTools for main window.");

  });

  mainWindow.on("resize", () => updateWebViewBounds(false));

  mainWindow.on("closed", () => {
    webView = null;
    mainWindow = null;
    globalShortcut.unregisterAll();
    app.quit();
  });

  // --- Global Shortcuts ---
  globalShortcut.register("CommandOrControl+L", () => {
    if (mainWindow && webView && !animationInProgress) {
      isUrlBarVisible = !isUrlBarVisible;
      console.log(
        `[Main] Ctrl+L pressed. Toggling URL bar visibility to: ${isUrlBarVisible}`
      );

      updateWebViewBounds(true);

      const currentURL = isUrlBarVisible ? webView.webContents.getURL() : "";
      if (isUrlBarVisible) {
        mainWindow.webContents.send("show-url-bar", currentURL);
      } else {
        mainWindow.webContents.send("hide-url-bar");
        setTimeout(() => {
          webView.webContents.focus();
        }, 350);
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
          isUrlBarVisible = false;
          updateWebViewBounds(true);
          mainWindow.webContents.send("hide-url-bar");
          setTimeout(() => {
            webView.webContents.focus(); 
          }, 350);
        })
        .catch((err) => {
          console.error(`[Main] IPC: Failed to load URL "${finalUrl}":`, err);
        });
    } else {
      console.error("[Main] IPC: Cannot load URL - webView is missing.");
    }
  });

  ipcMain.on("url-bar-escape", () => {
    if (mainWindow && isUrlBarVisible) {
      console.log("[Main] IPC: url-bar-escape received.");
      isUrlBarVisible = false;
      updateWebViewBounds(true);
      mainWindow.webContents.send("hide-url-bar");
      setTimeout(() => {
        webView?.webContents.focus(); 
      }, 350);
    }
  });

  // --- menu ---
  const menuTemplate = [
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
        {
          label: "Toggle UI Developer Tools",
          accelerator: "Alt+CommandOrControl+I",
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
        {
          label: "Toggle Web Content Developer Tools",
          accelerator: "Shift+CommandOrControl+I",
          click: () => {
            if (webView) webView.webContents.toggleDevTools();
          },
        },
      ],
    },
    { role: "editMenu" },
    { role: "windowMenu" },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

// --- App Lifecycle ---
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
