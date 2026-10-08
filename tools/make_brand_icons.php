<?php
declare(strict_types=1);

$root = dirname(__DIR__) . '/assets';
$srcPath = $root . '/logo.png';
$src = imagecreatefrompng($srcPath);
if (!$src) {
    fwrite(STDERR, "Could not read logo.png\n");
    exit(1);
}
$sw = imagesx($src);
$sh = imagesy($src);

function hex(int $r, int $g, int $b): array
{
    return [$r, $g, $b];
}

function paint_round_rect($im, int $size, array $tl, array $br): void
{
    $blush = imagecolorallocate($im, 253, 224, 227);
    imagefilledrectangle($im, 0, 0, $size, $size, $blush);
    for ($y = 0; $y < $size; $y++) {
        $t = $size > 1 ? $y / ($size - 1) : 0;
        $r = (int) round($tl[0] + ($br[0] - $tl[0]) * $t);
        $g = (int) round($tl[1] + ($br[1] - $tl[1]) * $t);
        $b = (int) round($tl[2] + ($br[2] - $tl[2]) * $t);
        $c = imagecolorallocatealpha($im, $r, $g, $b, 96);
        imageline($im, 0, $y, $size, $y, $c);
    }
}

function crop_square($src, int $sw, int $sh)
{
    $side = min($sw, (int) round($sh * 0.72));
    $x = (int) max(0, ($sw - $side) / 2);
    $y = (int) max(0, $sh * 0.04);
    if ($x + $side > $sw) {
        $x = 0;
        $side = $sw;
    }
    if ($y + $side > $sh) {
        $y = 0;
        $side = min($sw, $sh);
    }
    $out = imagecreatetruecolor($side, $side);
    imagealphablending($out, false);
    imagesavealpha($out, true);
    $clear = imagecolorallocatealpha($out, 0, 0, 0, 127);
    imagefilledrectangle($out, 0, 0, $side, $side, $clear);
    imagealphablending($out, true);
    imagecopy($out, $src, 0, 0, $x, $y, $side, $side);
    return $out;
}

function save_png($im, string $path): void
{
    imagepng($im, $path, 6);
}

$crop = crop_square($src, $sw, $sh);
$cw = imagesx($crop);
$ch = imagesy($crop);

foreach ([32, 180, 192, 512] as $size) {
    $im = imagecreatetruecolor($size, $size);
    imagealphablending($im, true);
    imagesavealpha($im, true);
    paint_round_rect($im, $size, [249, 123, 110], [242, 112, 156]);
    $pad = (int) round($size * 0.08);
    $inner = $size - $pad * 2;
    imagecopyresampled($im, $crop, $pad, $pad, 0, 0, $inner, $inner, $cw, $ch);
    save_png($im, $root . "/icon-{$size}.png");
    imagedestroy($im);
}

$og = imagecreatetruecolor(1200, 630);
imagealphablending($og, true);
imagesavealpha($og, false);
$blush = imagecolorallocate($og, 253, 224, 227);
imagefilledrectangle($og, 0, 0, 1200, 630, $blush);
$targetH = 420;
$targetW = (int) round($sw * ($targetH / $sh));
$ox = (int) ((1200 - $targetW) / 2);
$oy = 36;
imagecopyresampled($og, $src, $ox, $oy, 0, 0, $targetW, $targetH, $sw, $sh);
save_png($og, $root . '/og.png');
imagedestroy($og);
imagedestroy($crop);
imagedestroy($src);
echo "icons ok\n";
