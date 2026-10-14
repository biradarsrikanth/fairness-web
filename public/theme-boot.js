// Sets the colour mode the user picked before the first paint, so the page doesn't flash the other mode.
// A file of its own because the Content-Security-Policy allows no inline script. ThemeService takes over
// once the app starts and uses the same storage key.
(function () {
  try {
    var mode = localStorage.getItem('fairness-web:mode');
    if (mode === 'paper' || mode === 'console') {
      document.documentElement.setAttribute('data-mode', mode);
    }
  } catch (e) {
    // Storage blocked: follow the operating system
  }
})();
