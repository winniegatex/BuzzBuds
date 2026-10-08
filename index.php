<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#241610">
  <meta name="description" content="BuzzBuds is a private bubble for two people in different places.">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="BuzzBuds">
  <title>BuzzBuds</title>
  <link rel="icon" href="assets/icon.svg" type="image/svg+xml">
  <link rel="manifest" href="assets/manifest.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,650&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/app.css?v=19">
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
  <div id="app"><div id="view-root"><p class="booting">Opening BuzzBuds…</p></div></div>
  <div id="toast" class="toast" hidden>
    <p id="toast-text"></p>
    <div id="toast-actions"></div>
  </div>
  <noscript><p class="booting">BuzzBuds needs JavaScript turned on.</p></noscript>
  <script src="assets/motion.js?v=19"></script>
  <script src="assets/activities.js?v=19"></script>
  <script src="assets/app.js?v=19"></script>
</body>
</html>
