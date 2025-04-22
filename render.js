console.log('[Renderer] Script loaded');

const urlbar = document.getElementById('urlbar');

if (!window.electronAPI) {
    console.error('[Renderer] CRITICAL: electronAPI is not defined.');
    alert('Error: Browser components failed to load.');
} else {
    console.log('[Renderer] electronAPI found.');

    // --- Listeners for events from Main Process ---

    window.electronAPI.onShowUrlBar((currentURL) => {
        console.log('[Renderer] Received show-url-bar, Current URL:', currentURL);
        urlbar.classList.remove('hidden');
        urlbar.value = currentURL || '';
        urlbar.select();
        urlbar.focus();
    });

    window.electronAPI.onHideUrlBar(() => {
        console.log('[Renderer] Received hide-url-bar');
        urlbar.value = '';
        urlbar.classList.add('hidden');
        urlbar.blur(); // Just remove focus from bar
        // **Remove:** window.electronAPI.sendFocusView(); // Main handles this now
    });

    // --- Event listeners for the URL Bar Input ---

    urlbar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const urlValue = urlbar.value.trim();
            if (urlValue) {
                console.log(`[Renderer] Enter pressed. Sending URL: ${urlValue}`);
                window.electronAPI.sendLoadURL(urlValue);
            } else {
                 console.log('[Renderer] Enter pressed on empty bar. Hiding.');
                 window.electronAPI.sendUrlBarEscape();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            console.log('[Renderer] Escape pressed. Notifying main.');
            window.electronAPI.sendUrlBarEscape();
        }
    });

    console.log('[Renderer] Event listeners attached.');
}