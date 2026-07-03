(function () {
  const REPO = 'tonygoldcrest/sightkick';
  const RELEASES = 'https://github.com/' + REPO + '/releases';
  const heroMac = document.getElementById('hero-btn-mac');
  const heroWin = document.getElementById('hero-btn-win');
  const heroLinux = document.getElementById('hero-btn-linux');

  function applyPlatform(macUrl, winUrl, linuxUrl) {
    const ua = navigator.userAgent;
    const isWindows = /Win/.test(navigator.platform) || /Windows/.test(ua);
    const isLinux =
      !isWindows &&
      /Linux/.test(navigator.platform + ua) &&
      !/Android/.test(ua);

    heroMac.href = macUrl;
    heroWin.href = winUrl;
    heroLinux.href = linuxUrl;

    const primary = isWindows ? heroWin : isLinux ? heroLinux : heroMac;

    [heroMac, heroWin, heroLinux].forEach((btn) => {
      btn.className = btn === primary ? 'btn-primary' : 'btn-secondary';
    });
  }

  applyPlatform(RELEASES, RELEASES, RELEASES);

  fetch('https://api.github.com/repos/' + REPO + '/releases/latest')
    .then((r) => r.json())
    .then((data) => {
      const assets = data.assets || [];

      function urlFor(test) {
        const asset = assets.find((a) => test(a.name));

        return asset ? asset.browser_download_url : RELEASES;
      }

      const macArm = urlFor((n) => /arm64\.dmg$/.test(n));
      const macX64 = urlFor(
        (n) => /\.dmg$/.test(n) && !/arm64/.test(n) && !/blockmap/.test(n),
      );
      const win = urlFor((n) => /\.exe$/.test(n) && !/blockmap/.test(n));
      const linux = urlFor((n) => /\.AppImage$/.test(n));

      applyPlatform(macArm, win, linux);
      document.getElementById('dl-mac-arm').href = macArm;
      document.getElementById('dl-mac-x64').href = macX64;
      document.getElementById('dl-win').href = win;
      document.getElementById('dl-linux').href = linux;
    })
    .catch(() => {});

  fetch('https://api.github.com/repos/' + REPO)
    .then((r) => r.json())
    .then((data) => {
      if (typeof data.stargazers_count !== 'number') {
        return;
      }

      const el = document.getElementById('gh-stars');
      const compact = new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(data.stargazers_count);

      el.textContent = '★ ' + compact.toLowerCase();
      el.hidden = false;
    })
    .catch(() => {});
})();
