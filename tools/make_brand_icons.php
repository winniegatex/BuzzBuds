<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$brand = $root . '/public/brand';
if (!is_dir($brand) && !mkdir($brand, 0775, true) && !is_dir($brand)) {
    fwrite(STDERR, "Could not create public/brand\n");
    exit(1);
}

$sources = [
    'logo-full.png' => $root . '/assets/logo-full.png',
    'logo-icon.png' => $root . '/assets/logo-icon.png',
    'app-icon-512.png' => $root . '/assets/app-icon-512.png',
];
foreach ($sources as $name => $from) {
    $to = $brand . '/' . $name;
    if (!is_file($from)) {
        if (!is_file($to)) {
            fwrite(STDERR, "Missing {$from}\n");
            exit(1);
        }
        continue;
    }
    if (!copy($from, $to)) {
        fwrite(STDERR, "Could not copy {$name}\n");
        exit(1);
    }
}

$srcPath = $brand . '/app-icon-512.png';
$src = imagecreatefrompng($srcPath);
if (!$src) {
    fwrite(STDERR, "Could not read app-icon-512.png\n");
    exit(1);
}
imagesavealpha($src, true);
$sw = imagesx($src);
$sh = imagesy($src);

function resample_contain($src, int $sw, int $sh, int $dw, int $dh)
{
    $out = imagecreatetruecolor($dw, $dh);
    imagealphablending($out, false);
    imagesavealpha($out, true);
    $clear = imagecolorallocatealpha($out, 0, 0, 0, 127);
    imagefilledrectangle($out, 0, 0, $dw, $dh, $clear);
    $scale = min($dw / $sw, $dh / $sh);
    $tw = (int) round($sw * $scale);
    $th = (int) round($sh * $scale);
    $ox = (int) (($dw - $tw) / 2);
    $oy = (int) (($dh - $th) / 2);
    imagealphablending($out, true);
    imagecopyresampled($out, $src, $ox, $oy, 0, 0, $tw, $th, $sw, $sh);
    return $out;
}

foreach ([32, 180, 192, 512] as $size) {
    $im = resample_contain($src, $sw, $sh, $size, $size);
    imagepng($im, $brand . "/icon-{$size}.png", 6);
    imagedestroy($im);
}

$og = resample_contain($src, $sw, $sh, 1200, 630);
imagepng($og, $brand . '/og.png', 6);
imagedestroy($og);
imagedestroy($src);
echo "brand icons ok\n";
