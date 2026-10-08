<?php
declare(strict_types=1);

/* Connect Four — 6 rows x 7 cols, drop in column */
function c4_new(int $redUser, int $blackUser): array
{
    return [
        'redUser' => $redUser,
        'blackUser' => $blackUser,
        'board' => array_fill(0, 6, array_fill(0, 7, null)),
        'turn' => 'red',
        'winner' => null,
        'lastCol' => null,
    ];
}

function c4_drop(array $state, int $col): array
{
    if ($col < 0 || $col > 6) {
        throw new UserError('That column is off the board.');
    }
    for ($r = 5; $r >= 0; $r--) {
        if ($state['board'][$r][$col] === null) {
            $state['board'][$r][$col] = $state['turn'];
            $state['lastCol'] = $col;
            $state['winner'] = c4_winner($state['board'], $r, $col) ?: c4_full($state['board']) ? 'draw' : null;
            if ($state['winner'] === null) {
                $state['turn'] = $state['turn'] === 'red' ? 'black' : 'red';
            }
            return $state;
        }
    }
    throw new UserError('That column is full.');
}

function c4_full(array $board): bool
{
    foreach ($board[0] as $cell) {
        if ($cell === null) {
            return false;
        }
    }
    return true;
}

function c4_winner(array $board, int $r, int $c): ?string
{
    $color = $board[$r][$c];
    if ($color === null) {
        return null;
    }
    $dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    foreach ($dirs as [$dr, $dc]) {
        $n = 1;
        for ($i = 1; $i < 4; $i++) {
            $nr = $r + $dr * $i;
            $nc = $c + $dc * $i;
            if ($nr < 0 || $nr > 5 || $nc < 0 || $nc > 6 || $board[$nr][$nc] !== $color) {
                break;
            }
            $n++;
        }
        for ($i = 1; $i < 4; $i++) {
            $nr = $r - $dr * $i;
            $nc = $c - $dc * $i;
            if ($nr < 0 || $nr > 5 || $nc < 0 || $nc > 6 || $board[$nr][$nc] !== $color) {
                break;
            }
            $n++;
        }
        if ($n >= 4) {
            return $color;
        }
    }
    return null;
}

function c4_apply(array $state, int $userId, int $col): array
{
    if (!empty($state['winner'])) {
        throw new UserError('This game is over.');
    }
    $you = (int) $state['redUser'] === $userId ? 'red' : 'black';
    if ($you !== $state['turn']) {
        throw new UserError('It is not your turn yet.');
    }
    return c4_drop($state, $col);
}

/* Memory match — 4x4, 8 pairs, hidden until flipped */
function memory_new(int $a, int $b): array
{
    $symbols = ['🌸', '🌙', '⭐', '💕', '🎵', '🦋', '🍓', '☀️'];
    $deck = [];
    foreach ($symbols as $sym) {
        $deck[] = $sym;
        $deck[] = $sym;
    }
    shuffle($deck);
    return [
        'userA' => $a,
        'userB' => $b,
        'cards' => array_map(static fn ($v) => ['v' => $v, 'up' => false, 'matched' => false], $deck),
        'turn' => $a,
        'flipped' => [],
        'winner' => null,
        'scores' => [(string) $a => 0, (string) $b => 0],
    ];
}

function memory_apply(array $state, int $userId, int $index): array
{
    if (!empty($state['winner'])) {
        throw new UserError('This round is over.');
    }
    if ((int) $state['turn'] !== $userId) {
        throw new UserError('It is not your turn yet.');
    }
    if ($index < 0 || $index > 15) {
        throw new UserError('That card is not on the board.');
    }
    $card = $state['cards'][$index];
    if ($card['matched'] || $card['up']) {
        throw new UserError('That card is already showing.');
    }
    $flipped = $state['flipped'];
    if (count($flipped) >= 2) {
        foreach ($flipped as $fi) {
            $state['cards'][$fi]['up'] = false;
        }
        $flipped = [];
    }
    $state['cards'][$index]['up'] = true;
    $flipped[] = $index;
    $state['flipped'] = $flipped;
    if (count($flipped) === 2) {
        [$i, $j] = $flipped;
        if ($state['cards'][$i]['v'] === $state['cards'][$j]['v']) {
            $state['cards'][$i]['matched'] = true;
            $state['cards'][$j]['matched'] = true;
            $state['scores'][(string) $userId] = (int) ($state['scores'][(string) $userId] ?? 0) + 1;
            $state['flipped'] = [];
        } else {
            $other = (int) $state['userA'] === $userId ? (int) $state['userB'] : (int) $state['userA'];
            $state['turn'] = $other;
        }
        $all = true;
        foreach ($state['cards'] as $c) {
            if (!$c['matched']) {
                $all = false;
                break;
            }
        }
        if ($all) {
            $sa = (int) ($state['scores'][(string) $state['userA']] ?? 0);
            $sb = (int) ($state['scores'][(string) $state['userB']] ?? 0);
            $state['winner'] = $sa === $sb ? 'draw' : ($sa > $sb ? (string) $state['userA'] : (string) $state['userB']);
        }
    }
    return $state;
}

/* Hangman — setter picks word, guesser guesses letters */
function hangman_new(int $setter, int $guesser): array
{
    return [
        'setter' => $setter,
        'guesser' => $guesser,
        'phase' => 'word',
        'word' => '',
        'mask' => '',
        'guessed' => [],
        'wrong' => 0,
        'winner' => null,
    ];
}

function hangman_apply(array $state, int $userId, array $data): array
{
    $action = (string) ($data['action'] ?? '');
    if ($action === 'word') {
        if ((int) $state['setter'] !== $userId) {
            throw new UserError('Only the setter picks the word.');
        }
        $word = strtolower(preg_replace('/[^a-z]/', '', (string) ($data['word'] ?? '')) ?? '');
        if (strlen($word) < 3 || strlen($word) > 12) {
            throw new UserError('Pick a word between 3 and 12 letters.');
        }
        $state['word'] = $word;
        $state['mask'] = str_repeat('_', strlen($word));
        $state['phase'] = 'guess';
        return $state;
    }
    if ($action === 'guess') {
        if ((int) $state['guesser'] !== $userId) {
            throw new UserError('Only the guesser picks letters.');
        }
        if ($state['phase'] !== 'guess') {
            throw new UserError('Wait for a word first.');
        }
        $letter = strtolower(substr((string) ($data['letter'] ?? ''), 0, 1));
        if (!preg_match('/^[a-z]$/', $letter)) {
            throw new UserError('Pick a letter A–Z.');
        }
        $guessed = $state['guessed'];
        if (in_array($letter, $guessed, true)) {
            throw new UserError('You already tried that letter.');
        }
        $guessed[] = $letter;
        $state['guessed'] = $guessed;
        $word = $state['word'];
        if (str_contains($word, $letter)) {
            $mask = '';
            for ($i = 0; $i < strlen($word); $i++) {
                $mask .= $word[$i] === $letter || ($state['mask'][$i] ?? '_') !== '_' ? $word[$i] : '_';
            }
            $state['mask'] = $mask;
            if ($mask === $word) {
                $state['winner'] = 'guesser';
            }
        } else {
            $state['wrong'] = (int) $state['wrong'] + 1;
            if ($state['wrong'] >= 6) {
                $state['winner'] = 'setter';
            }
        }
        return $state;
    }
    throw new UserError('Unknown action.');
}
