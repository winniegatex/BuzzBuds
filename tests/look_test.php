<?php
require dirname(__DIR__) . '/includes/bootstrap.php';
$u = appearance_normalize([
    'preset' => 'nope',
    'mode' => 'dark',
    'accent' => '#AABBCC',
    'bg' => 'red',
    'density' => 'compact',
    'nav' => 'top',
    'home' => 'stack',
    'corners' => 'sharp',
    'span' => 'wide',
    'notes' => 'flat',
]);
$ok = $u['preset'] === 'ember'
    && $u['mode'] === 'dark'
    && $u['accent'] === '#aabbcc'
    && $u['bg'] === ''
    && $u['density'] === 'compact'
    && $u['nav'] === 'top'
    && $u['corners'] === 'sharp';
echo $ok ? "ok\n" : "bad\n";
echo json_encode($u), "\n";
$bad = appearance_public('{');
echo $bad['preset'] === 'ember' ? "empty-ok\n" : "empty-bad\n";
