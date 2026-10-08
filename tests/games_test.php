<?php
declare(strict_types=1);

class UserError extends RuntimeException
{
    public function __construct(string $message, public int $status = 400)
    {
        parent::__construct($message);
    }
}

require dirname(__DIR__) . '/includes/games.php';

function expect(bool $cond, string $label): void
{
    if (!$cond) {
        fwrite(STDERR, "FAIL: $label\n");
        exit(1);
    }
    fwrite(STDOUT, "ok: $label\n");
}

$state = ttt_new(1, 2);
$state = ttt_apply($state, 1, 0);
$state = ttt_apply($state, 2, 3);
$state = ttt_apply($state, 1, 1);
$state = ttt_apply($state, 2, 4);
$state = ttt_apply($state, 1, 2);
expect($state['winner'] === 'X', 'ttt x wins');

$draw = ttt_new(1, 2);
foreach ([0, 1, 2, 4, 3, 5, 7, 6, 8] as $i => $cell) {
    $draw = ttt_apply($draw, $i % 2 === 0 ? 1 : 2, $cell);
}
expect($draw['winner'] === 'draw', 'ttt draw');

$fresh = checkers_new(1, 2);
expect(count(checkers_legal($fresh)) === 7, 'checkers opening has 7 moves');

$capture = checkers_new(1, 2);
for ($r = 0; $r < 8; $r++) {
    for ($c = 0; $c < 8; $c++) {
        $capture['board'][$r][$c] = null;
    }
}
$capture['board'][5][0] = 'r';
$capture['board'][4][1] = 'b';
$capture['board'][2][3] = 'b';
$capture['board'][5][4] = 'r';
$legal = checkers_legal($capture);
expect(count($legal) === 1 && $legal[0]['to'] == [3, 2], 'forced capture only');
$capture = checkers_apply($capture, 1, 5, 0, 3, 2);
expect($capture['turn'] === 'red' && $capture['mustFrom'] == [3, 2], 'multi-jump continues');
$capture = checkers_apply($capture, 1, 3, 2, 1, 4);
expect($capture['winner'] === 'red', 'capturing the last piece wins');

$promo = checkers_new(1, 2);
for ($r = 0; $r < 8; $r++) {
    for ($c = 0; $c < 8; $c++) {
        $promo['board'][$r][$c] = null;
    }
}
$promo['board'][1][0] = 'r';
$promo['board'][0][1] = null;
$promo['board'][7][0] = 'b';
$promo = checkers_apply($promo, 1, 1, 0, 0, 1);
expect($promo['board'][0][1] === 'R' && $promo['turn'] === 'black', 'man promotes and turn passes');

try {
    checkers_apply(checkers_new(1, 2), 2, 5, 0, 4, 1);
    expect(false, 'black cannot move first');
} catch (UserError $e) {
    expect(str_contains($e->getMessage(), 'not your turn'), 'black cannot move first');
}

fwrite(STDOUT, "all game tests passed\n");
