<?php
declare(strict_types=1);

require __DIR__ . '/games_extra.php';
require __DIR__ . '/games_quick.php';

function ttt_new(int $xUser, int $oUser): array
{
    return [
        'board' => array_fill(0, 9, null),
        'turn' => 'X',
        'winner' => null,
        'xUser' => $xUser,
        'oUser' => $oUser,
        'lastMove' => null,
    ];
}

function ttt_winner(array $board): ?string
{
    $lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    foreach ($lines as [$a, $b, $c]) {
        if ($board[$a] && $board[$a] === $board[$b] && $board[$b] === $board[$c]) {
            return $board[$a];
        }
    }
    foreach ($board as $cell) {
        if ($cell === null) {
            return null;
        }
    }
    return 'draw';
}

function ttt_legal(array $state): array
{
    if (!empty($state['winner'])) {
        return [];
    }
    $open = [];
    foreach ($state['board'] as $i => $cell) {
        if ($cell === null) {
            $open[] = $i;
        }
    }
    return $open;
}

function ttt_apply(array $state, int $userId, int $index): array
{
    if (!empty($state['winner'])) {
        throw new UserError('This game is already over.');
    }
    if ($index < 0 || $index > 8) {
        throw new UserError('That square is not on the board.');
    }
    $you = null;
    if ((int) $state['xUser'] === $userId) {
        $you = 'X';
    }
    if ((int) $state['oUser'] === $userId) {
        $you = 'O';
    }
    if ($you === null) {
        throw new UserError('You are not in this game.');
    }
    if ($you !== $state['turn']) {
        throw new UserError('It is not your turn yet.');
    }
    if ($state['board'][$index] !== null) {
        throw new UserError('That square is already taken.');
    }
    $state['board'][$index] = $you;
    $state['lastMove'] = $index;
    $state['winner'] = ttt_winner($state['board']);
    if ($state['winner'] === null) {
        $state['turn'] = $you === 'X' ? 'O' : 'X';
    }
    return $state;
}

function checkers_new(int $redUser, int $blackUser): array
{
    $board = [];
    for ($r = 0; $r < 8; $r++) {
        $board[$r] = array_fill(0, 8, null);
        for ($c = 0; $c < 8; $c++) {
            if ((($r + $c) % 2) !== 1) {
                continue;
            }
            if ($r <= 2) {
                $board[$r][$c] = 'b';
            } elseif ($r >= 5) {
                $board[$r][$c] = 'r';
            }
        }
    }
    return [
        'board' => $board,
        'turn' => 'red',
        'mustFrom' => null,
        'winner' => null,
        'redUser' => $redUser,
        'blackUser' => $blackUser,
        'lastMove' => null,
    ];
}

function piece_side(?string $piece): ?string
{
    if ($piece === 'r' || $piece === 'R') {
        return 'red';
    }
    if ($piece === 'b' || $piece === 'B') {
        return 'black';
    }
    return null;
}

function checker_dirs(string $piece): array
{
    $up = [[-1, -1], [-1, 1]];
    $down = [[1, -1], [1, 1]];
    return match ($piece) {
        'r' => $up,
        'b' => $down,
        'R', 'B' => array_merge($up, $down),
        default => [],
    };
}

function on_board(int $r, int $c): bool
{
    return $r >= 0 && $r < 8 && $c >= 0 && $c < 8;
}

function moves_from(array $board, int $r, int $c): array
{
    $piece = $board[$r][$c] ?? null;
    if (!$piece) {
        return [];
    }
    $out = [];
    foreach (checker_dirs($piece) as [$dr, $dc]) {
        $mr = $r + $dr;
        $mc = $c + $dc;
        $jr = $r + (2 * $dr);
        $jc = $c + (2 * $dc);
        $mid = on_board($mr, $mc) ? ($board[$mr][$mc] ?? null) : null;
        if (on_board($jr, $jc) && piece_side($mid) !== null && piece_side($mid) !== piece_side($piece) && ($board[$jr][$jc] ?? null) === null) {
            $out[] = ['from' => [$r, $c], 'to' => [$jr, $jc], 'capture' => true];
        } elseif (on_board($mr, $mc) && ($board[$mr][$mc] ?? null) === null) {
            $out[] = ['from' => [$r, $c], 'to' => [$mr, $mc], 'capture' => false];
        }
    }
    return $out;
}

function checkers_legal(array $state): array
{
    if (!empty($state['winner'])) {
        return [];
    }
    $must = $state['mustFrom'] ?? null;
    $coords = [];
    if (is_array($must)) {
        $coords[] = [(int) $must[0], (int) $must[1]];
    } else {
        for ($r = 0; $r < 8; $r++) {
            for ($c = 0; $c < 8; $c++) {
                if (piece_side($state['board'][$r][$c] ?? null) === $state['turn']) {
                    $coords[] = [$r, $c];
                }
            }
        }
    }
    $caps = [];
    $quiet = [];
    foreach ($coords as [$r, $c]) {
        foreach (moves_from($state['board'], $r, $c) as $move) {
            if ($move['capture']) {
                $caps[] = ['from' => $move['from'], 'to' => $move['to']];
            } else {
                $quiet[] = ['from' => $move['from'], 'to' => $move['to']];
            }
        }
    }
    if ($caps) {
        return $caps;
    }
    if (is_array($must)) {
        return [];
    }
    return $quiet;
}

function count_side(array $state, string $side): int
{
    $n = 0;
    for ($r = 0; $r < 8; $r++) {
        for ($c = 0; $c < 8; $c++) {
            if (piece_side($state['board'][$r][$c] ?? null) === $side) {
                $n++;
            }
        }
    }
    return $n;
}

function checkers_apply(array $state, int $userId, int $fr, int $fc, int $tr, int $tc): array
{
    if (!empty($state['winner'])) {
        throw new UserError('This game is already over.');
    }
    $side = null;
    if ((int) $state['redUser'] === $userId) {
        $side = 'red';
    } elseif ((int) $state['blackUser'] === $userId) {
        $side = 'black';
    }
    if ($side === null) {
        throw new UserError('You are not in this game.');
    }
    if ($side !== $state['turn']) {
        throw new UserError('It is not your turn yet.');
    }
    $allowed = false;
    foreach (checkers_legal($state) as $move) {
        if ($move['from'] == [$fr, $fc] && $move['to'] == [$tr, $tc]) {
            $allowed = true;
            break;
        }
    }
    if (!$allowed) {
        throw new UserError('That move is not allowed.');
    }

    $piece = $state['board'][$fr][$fc];
    $state['board'][$fr][$fc] = null;
    $captured = abs($tr - $fr) === 2;
    if ($captured) {
        $state['board'][(int) (($fr + $tr) / 2)][(int) (($fc + $tc) / 2)] = null;
    }
    $promoted = false;
    if ($piece === 'r' && $tr === 0) {
        $piece = 'R';
        $promoted = true;
    }
    if ($piece === 'b' && $tr === 7) {
        $piece = 'B';
        $promoted = true;
    }
    $state['board'][$tr][$tc] = $piece;
    $state['lastMove'] = ['from' => [$fr, $fc], 'to' => [$tr, $tc]];

    $enemy = $state['turn'] === 'red' ? 'black' : 'red';
    if (count_side($state, $enemy) === 0) {
        $state['winner'] = $state['turn'];
        $state['mustFrom'] = null;
        return $state;
    }

    if ($captured && !$promoted) {
        $state['mustFrom'] = [$tr, $tc];
        if (checkers_legal($state)) {
            return $state;
        }
    }

    $state['mustFrom'] = null;
    $state['turn'] = $enemy;
    if (!checkers_legal($state)) {
        $state['winner'] = $state['turn'] === 'red' ? 'black' : 'red';
    }
    return $state;
}
