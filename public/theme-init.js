// Applies the theme before the page paints, so a dark-mode visitor never sees
// a flash of the light site. Loaded as the first thing in <body> (index.html)
// because the Content-Security-Policy allows no inline scripts. Same rule as
// app.ts initTheme(): the saved ☾/☀ choice, else the device setting.
(function () {
    var dark = false;
    try {
        var saved = localStorage.getItem('medtourney_theme');
        var value = saved ? JSON.parse(saved) : null;
        // Older versions wrapped it as {data, timestamp, version}
        if (value && typeof value === 'object') value = value.data;
        if (value === 'dark' || value === 'light') {
            dark = value === 'dark';
        } else if (window.matchMedia) {
            dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
    } catch (e) {
        // storage blocked - fall back to the light default
    }
    if (dark) document.body.classList.add('dark-theme');
})();
