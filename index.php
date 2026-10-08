<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#4A1038">
  <meta name="description" content="BuzzBuds is a private bubble for two. Chat, watch together, play games, share moments and keep your love close, however far apart.">
  <meta property="og:title" content="BuzzBuds — a private bubble for two">
  <meta property="og:description" content="A private bubble for two, however far apart. Chat, watch together, play games, and share moments.">
  <meta property="og:image" content="assets/og.png">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="BuzzBuds">
  <title>BuzzBuds — a private bubble for two</title>
  <link rel="icon" href="assets/icon.svg" type="image/svg+xml">
  <link rel="icon" href="assets/icon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="assets/icon-180.png" sizes="180x180">
  <link rel="manifest" href="assets/manifest.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/app.css?v=21">
</head>
<body class="theme-dark">
  <div id="ambience" class="ambience" aria-hidden="true">
    <span class="drift-heart" style="--x:12%;--y:78%;--s:22px;--d:0s">♥</span>
    <span class="drift-heart" style="--x:82%;--y:65%;--s:16px;--d:-4s">♥</span>
    <span class="drift-heart" style="--x:68%;--y:18%;--s:14px;--d:-9s">♥</span>
    <span class="drift-heart" style="--x:24%;--y:32%;--s:18px;--d:-6s">♥</span>
    <span class="drift-heart soft" style="--x:48%;--y:88%;--s:26px;--d:-11s">♥</span>
    <span class="drift-heart soft" style="--x:92%;--y:28%;--s:12px;--d:-2s">♥</span>
    <span class="drift-sparkle" style="--x:18%;--y:42%;--d:-3s"></span>
    <span class="drift-sparkle" style="--x:74%;--y:52%;--d:-8s"></span>
    <span class="drift-sparkle" style="--x:56%;--y:12%;--d:-5s"></span>
  </div>
  <div id="fx-layer" class="fx-layer" aria-hidden="true"></div>
  <div id="mascot-layer" class="mascot-layer" aria-hidden="true"></div>
  <div id="app"><div id="view-root">
    <div class="booting boot-pulse" role="status" aria-live="polite">
      <div class="boot-logo">
        <img class="boot-mark" src="assets/logo-mark.svg" alt="" width="220" height="165">
      </div>
      <p>Opening your bubble…</p>
    </div>
  </div></div>
  <div id="toast" class="toast" hidden>
    <p id="toast-text"></p>
    <div id="toast-actions"></div>
  </div>
  <noscript><p class="booting">BuzzBuds needs JavaScript turned on.</p></noscript>
  <script src="assets/motion.js?v=21"></script>
  <script src="assets/activities.js?v=21"></script>
  <script src="assets/app.js?v=21"></script>
</body>
</html>
