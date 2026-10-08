<?php
declare(strict_types=1);

/* --- Solitaire (Klondike, one board per person in the bubble) --- */

function solitaire_new(int $userA, int $userB): array
{
    return [
        'userA' => $userA,
        'userB' => $userB,
        'players' => [
            (string) $userA => sol_player_deal(),
            (string) $userB => sol_player_deal(),
        ],
    ];
}

function sol_player_deal(): array
{
    $deck = range(0, 51);
    shuffle($deck);
    $tableau = [];
    $i = 0;
    for ($p = 0; $p < 7; $p++) {
        $tableau[$p] = [];
        for ($n = 0; $n <= $p; $n++) {
            $tableau[$p][] = ['c' => $deck[$i++], 'up' => $n === $p];
        }
    }
    return [
        'tableau' => $tableau,
        'stock' => array_slice($deck, $i),
        'waste' => [],
        'foundations' => [[], [], [], []],
        'won' => false,
        'moves' => 0,
    ];
}

function sol_rank(int $card): int
{
    return ($card % 13) + 1;
}

function sol_suit(int $card): int
{
    return intdiv($card, 13);
}

function sol_red(int $card): bool
{
    return sol_suit($card) % 2 === 1;
}

function sol_colors_ok(int $a, int $b): bool
{
    return sol_red($a) !== sol_red($b);
}

function sol_tableau_fits(int $card, ?int $destTop): bool
{
    if ($destTop === null) {
        return sol_rank($card) === 13;
    }
    return sol_colors_ok($card, $destTop) && sol_rank($card) === sol_rank($destTop) - 1;
}

function sol_foundation_fits(int $card, array $pile): bool
{
    if ($pile === []) {
        return sol_rank($card) === 1;
    }
    $top = $pile[count($pile) - 1];
    return sol_suit($card) === sol_suit($top) && sol_rank($card) === sol_rank($top) + 1;
}

function sol_player(array $state, int $uid): array
{
    $key = (string) $uid;
    if (!isset($state['players'][$key])) {
        throw new UserError('You are not in this game.');
    }
    return $state['players'][$key];
}

function sol_set_player(array $state, int $uid, array $player): array
{
    $state['players'][(string) $uid] = $player;
    return $state;
}

function sol_check_won(array $player): array
{
    $n = 0;
    foreach ($player['foundations'] as $pile) {
        $n += count($pile);
    }
    $player['won'] = $n === 52;
    return $player;
}

function sol_flip_top(array $player, int $pile): void
{
    $col = $player['tableau'][$pile];
    if ($col === []) {
        return;
    }
    $last = count($col) - 1;
    if (!$col[$last]['up']) {
        $col[$last]['up'] = true;
        $player['tableau'][$pile] = $col;
    }
}

function sol_apply(array $state, int $uid, array $move): array
{
    $action = (string) ($move['action'] ?? '');
    $player = sol_player($state, $uid);
    if ($player['won']) {
        throw new UserError('You already won this round.');
    }

    if ($action === 'draw') {
        if ($player['stock'] === [] && $player['waste'] === []) {
            throw new UserError('Nothing left to draw.');
        }
        if ($player['stock'] === []) {
            $player['stock'] = array_reverse($player['waste']);
            $player['waste'] = [];
        } else {
            $card = array_pop($player['stock']);
            $player['waste'][] = $card;
        }
        $player['moves']++;
        $player = sol_check_won($player);
        return sol_set_player($state, $uid, $player);
    }

    if ($action === 'waste_to_foundation') {
        if ($player['waste'] === []) {
            throw new UserError('Draw a card first.');
        }
        $card = $player['waste'][count($player['waste']) - 1];
        $placed = false;
        for ($f = 0; $f < 4; $f++) {
            if (sol_foundation_fits($card, $player['foundations'][$f])) {
                array_pop($player['waste']);
                $player['foundations'][$f][] = $card;
                $placed = true;
                break;
            }
        }
        if (!$placed) {
            throw new UserError('That card cannot go on a foundation.');
        }
        $player['moves']++;
        $player = sol_check_won($player);
        return sol_set_player($state, $uid, $player);
    }

    if ($action === 'waste_to_tableau') {
        $pile = (int) ($move['pile'] ?? -1);
        if ($pile < 0 || $pile > 6) {
            throw new UserError('Pick a tableau pile.');
        }
        if ($player['waste'] === []) {
            throw new UserError('Draw a card first.');
        }
        $card = $player['waste'][count($player['waste']) - 1];
        $dest = $player['tableau'][$pile];
        $destTop = $dest === [] ? null : $dest[count($dest) - 1]['c'];
        if (!sol_tableau_fits($card, $destTop)) {
            throw new UserError('That card cannot go there.');
        }
        array_pop($player['waste']);
        $player['tableau'][$pile][] = ['c' => $card, 'up' => true];
        $player['moves']++;
        return sol_set_player($state, $uid, $player);
    }

    if ($action === 'tableau_to_foundation') {
        $pile = (int) ($move['pile'] ?? -1);
        if ($pile < 0 || $pile > 6) {
            throw new UserError('Pick a tableau pile.');
        }
        $col = $player['tableau'][$pile];
        if ($col === [] || !$col[count($col) - 1]['up']) {
            throw new UserError('No face-up card there.');
        }
        $card = $col[count($col) - 1]['c'];
        $placed = false;
        for ($f = 0; $f < 4; $f++) {
            if (sol_foundation_fits($card, $player['foundations'][$f])) {
                array_pop($player['tableau'][$pile]);
                sol_flip_top($player, $pile);
                $player['foundations'][$f][] = $card;
                $placed = true;
                break;
            }
        }
        if (!$placed) {
            throw new UserError('That card cannot go on a foundation.');
        }
        $player['moves']++;
        $player = sol_check_won($player);
        return sol_set_player($state, $uid, $player);
    }

    if ($action === 'tableau_to_tableau') {
        $from = (int) ($move['from'] ?? -1);
        $to = (int) ($move['to'] ?? -1);
        $at = (int) ($move['at'] ?? -1);
        if ($from < 0 || $from > 6 || $to < 0 || $to > 6 || $from === $to) {
            throw new UserError('That move is not allowed.');
        }
        $src = $player['tableau'][$from];
        if ($src === [] || $at < 0 || $at >= count($src) || !$src[$at]['up']) {
            throw new UserError('Pick a face-up card to move.');
        }
        for ($i = 0; $i < $at; $i++) {
            if (!$src[$i]['up']) {
                throw new UserError('That stack is not open.');
            }
        }
        $moving = array_slice($src, $at);
        $bottom = $moving[0]['c'];
        $dest = $player['tableau'][$to];
        $destTop = $dest === [] ? null : $dest[count($dest) - 1]['c'];
        if (!sol_tableau_fits($bottom, $destTop)) {
            throw new UserError('That stack cannot go there.');
        }
        $player['tableau'][$from] = array_slice($src, 0, $at);
        sol_flip_top($player, $from);
        $player['tableau'][$to] = array_merge($dest, $moving);
        $player['moves']++;
        return sol_set_player($state, $uid, $player);
    }

    throw new UserError('Unknown solitaire action.');
}

function sol_partner_summary(array $state, int $uid): array
{
    $other = (int) $state['userA'] === $uid ? (int) $state['userB'] : (int) $state['userA'];
    $p = sol_player($state, $other);
    $found = 0;
    foreach ($p['foundations'] as $pile) {
        $found += count($pile);
    }
    return [
        'userId' => $other,
        'won' => (bool) $p['won'],
        'moves' => (int) $p['moves'],
        'foundationCards' => $found,
        'stockLeft' => count($p['stock']) + count($p['waste']),
    ];
}

function sol_present_player(array $player): array
{
    return [
        'tableau' => $player['tableau'],
        'stock' => count($player['stock']),
        'waste' => $player['waste'],
        'foundations' => $player['foundations'],
        'won' => (bool) $player['won'],
        'moves' => (int) $player['moves'],
    ];
}

/* --- Kahoot-style quiz for two --- */

function kahoot_new(int $userA, int $userB): array
{
    return [
        'userA' => $userA,
        'userB' => $userB,
        'host' => $userA,
        'phase' => 'build',
        'questions' => [],
        'current' => 0,
        'questionAt' => null,
        'answers' => [],
        'reveal' => null,
        'scores' => [(string) $userA => 0, (string) $userB => 0],
    ];
}

function kahoot_packs(): array
{
    return [
        'sweethearts' => [
            ['prompt' => 'What is the traditional gift for a 1-year anniversary?', 'choices' => ['Paper', 'Gold', 'Diamond', 'Cotton'], 'correct' => 0],
            ['prompt' => 'Which planet is known as the love planet in astrology?', 'choices' => ['Mars', 'Venus', 'Jupiter', 'Mercury'], 'correct' => 1],
            ['prompt' => 'How do you say “I love you” in French?', 'choices' => ['Te amo', 'Je t’aime', 'Ti amo', 'Ich liebe dich'], 'correct' => 1],
        ],
        'random' => [
            ['prompt' => 'What color is a ruby?', 'choices' => ['Blue', 'Red', 'Green', 'Yellow'], 'correct' => 1],
            ['prompt' => 'How many continents are there?', 'choices' => ['5', '6', '7', '8'], 'correct' => 2],
            ['prompt' => 'Which animal is the largest on Earth?', 'choices' => ['Elephant', 'Blue whale', 'Giraffe', 'Polar bear'], 'correct' => 1],
            ['prompt' => 'What gas do plants absorb?', 'choices' => ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], 'correct' => 2],
        ],
    ];
}

function kahoot_clean_question(array $q): array
{
    $prompt = trim((string) ($q['prompt'] ?? ''));
    if ($prompt === '') {
        throw new UserError('Write a question.');
    }
    if (mb_strlen($prompt) > 220) {
        throw new UserError('That question is too long.');
    }
    $choices = $q['choices'] ?? [];
    if (!is_array($choices) || count($choices) !== 4) {
        throw new UserError('Add exactly four answers.');
    }
    $clean = [];
    foreach ($choices as $choice) {
        $text = trim((string) $choice);
        if ($text === '') {
            throw new UserError('Every answer needs text.');
        }
        if (mb_strlen($text) > 90) {
            throw new UserError('An answer is too long.');
        }
        $clean[] = $text;
    }
    $correct = (int) ($q['correct'] ?? -1);
    if ($correct < 0 || $correct > 3) {
        throw new UserError('Pick which answer is correct.');
    }
    return ['prompt' => $prompt, 'choices' => $clean, 'correct' => $correct];
}

function kahoot_uid_in(array $state, int $uid): bool
{
    return $uid === (int) $state['userA'] || $uid === (int) $state['userB'];
}

function kahoot_both_ids(array $state): array
{
    return [(int) $state['userA'], (int) $state['userB']];
}

function kahoot_score_for(int $elapsedMs): int
{
    $window = 20000;
    if ($elapsedMs >= $window) {
        return 200;
    }
    return (int) max(200, 1000 - (int) (($elapsedMs / $window) * 800));
}

function kahoot_apply(array $state, int $uid, array $move): array
{
    if (!kahoot_uid_in($state, $uid)) {
        throw new UserError('You are not in this quiz.');
    }
    $action = (string) ($move['action'] ?? '');

    if ($action === 'load_pack') {
        if ($state['phase'] !== 'build') {
            throw new UserError('The quiz already started.');
        }
        $packs = kahoot_packs();
        $id = (string) ($move['pack'] ?? '');
        if (!isset($packs[$id])) {
            throw new UserError('Unknown question pack.');
        }
        $state['questions'] = $packs[$id];
        return $state;
    }

    if ($action === 'add_question') {
        if ($state['phase'] !== 'build') {
            throw new UserError('The quiz already started.');
        }
        if (count($state['questions']) >= 12) {
            throw new UserError('Twelve questions is the max for now.');
        }
        $state['questions'][] = kahoot_clean_question($move);
        return $state;
    }

    if ($action === 'clear_questions') {
        if ($state['phase'] !== 'build') {
            throw new UserError('The quiz already started.');
        }
        $state['questions'] = [];
        return $state;
    }

    if ($action === 'start') {
        if ((int) $state['host'] !== $uid) {
            throw new UserError('Only the host can start the quiz.');
        }
        if (count($state['questions']) < 1) {
            throw new UserError('Add at least one question.');
        }
        $state['phase'] = 'question';
        $state['current'] = 0;
        $state['answers'] = [];
        $state['reveal'] = null;
        $state['questionAt'] = microtime(true);
        return $state;
    }

    if ($action === 'answer') {
        if ($state['phase'] !== 'question') {
            throw new UserError('There is no question open right now.');
        }
        $key = (string) $uid;
        if (isset($state['answers'][$key])) {
            throw new UserError('You already answered.');
        }
        $choice = (int) ($move['choice'] ?? -1);
        if ($choice < 0 || $choice > 3) {
            throw new UserError('Pick an answer.');
        }
        $elapsed = (int) round((microtime(true) - (float) $state['questionAt']) * 1000);
        $state['answers'][$key] = ['choice' => $choice, 'ms' => $elapsed];
        $need = kahoot_both_ids($state);
        $done = 0;
        foreach ($need as $id) {
            if (isset($state['answers'][(string) $id])) {
                $done++;
            }
        }
        if ($done >= 2) {
            $q = $state['questions'][$state['current']];
            $reveal = ['correct' => (int) $q['correct'], 'points' => []];
            foreach ($need as $id) {
                $ans = $state['answers'][(string) $id];
                $pts = 0;
                if ((int) $ans['choice'] === (int) $q['correct']) {
                    $pts = kahoot_score_for((int) $ans['ms']);
                    $state['scores'][(string) $id] = (int) $state['scores'][(string) $id] + $pts;
                }
                $reveal['points'][(string) $id] = $pts;
            }
            $state['reveal'] = $reveal;
            $state['phase'] = 'reveal';
        }
        return $state;
    }

    if ($action === 'next') {
        if ((int) $state['host'] !== $uid) {
            throw new UserError('Only the host can advance.');
        }
        if ($state['phase'] === 'reveal') {
            $state['current']++;
            $state['answers'] = [];
            $state['reveal'] = null;
            if ($state['current'] >= count($state['questions'])) {
                $state['phase'] = 'done';
                $state['questionAt'] = null;
                return $state;
            }
            $state['phase'] = 'question';
            $state['questionAt'] = microtime(true);
            return $state;
        }
        throw new UserError('Nothing to advance yet.');
    }

    throw new UserError('Unknown quiz action.');
}

function kahoot_present(array $state, int $uid): array
{
    $phase = $state['phase'];
    $currentQ = null;
    if (($phase === 'question' || $phase === 'reveal') && isset($state['questions'][$state['current']])) {
        $q = $state['questions'][$state['current']];
        $currentQ = [
            'prompt' => $q['prompt'],
            'choices' => $q['choices'],
            'correct' => $phase === 'reveal' ? (int) $q['correct'] : -1,
        ];
    }

    $scores = [];
    foreach (kahoot_both_ids($state) as $id) {
        $scores[] = ['userId' => $id, 'points' => (int) $state['scores'][(string) $id]];
    }

    $myAnswer = $state['answers'][(string) $uid] ?? null;

    $yourTurn = $phase === 'question' && !isset($state['answers'][(string) $uid]);

    return [
        'type' => 'kahoot',
        'phase' => $phase,
        'yourTurn' => $yourTurn,
        'youAreHost' => (int) $state['host'] === $uid,
        'hostId' => (int) $state['host'],
        'buildQuestions' => $phase === 'build' ? $state['questions'] : [],
        'questionCount' => count($state['questions']),
        'current' => (int) $state['current'],
        'currentQuestion' => $currentQ,
        'answered' => $myAnswer !== null,
        'yourChoice' => $myAnswer ? (int) $myAnswer['choice'] : null,
        'reveal' => $state['reveal'],
        'scores' => $scores,
        'packs' => $phase === 'build' ? array_keys(kahoot_packs()) : [],
    ];
}
