<?php
declare(strict_types=1);

/** @return list<string> */
function activity_keys(): array
{
    return [
        'daily', 'mood', 'timeline', 'playlist', 'draw',
        'wyr', 'quiz', 'scrapbook', 'bucket', 'jar', 'hub',
    ];
}

function activity_key(string $key): string
{
    if (!in_array($key, activity_keys(), true)) {
        throw new UserError('Unknown activity.');
    }
    return $key;
}

function daily_questions(): array
{
    return [
        'What made you smile today?',
        'What is one thing you are grateful for about us?',
        'If we had a free evening, what would you want to do?',
        'What song reminds you of us right now?',
        'What is a small dream you want us to chase this year?',
        'When did you last feel really close to me?',
        'What is your favorite memory from this month?',
        'What should we try together that we have not yet?',
        'What is one habit that would make our days sweeter?',
        'If you could relive one day with me, which would it be?',
    ];
}

function daily_question_for_day(string $dayKey): string
{
    $list = daily_questions();
    $idx = abs(crc32($dayKey)) % count($list);
    return $list[$idx];
}

function activity_row(PDO $db, int $bubbleId, string $key): ?array
{
    $stmt = $db->prepare('SELECT * FROM activities WHERE bubble_id = ? AND activity_key = ?');
    $stmt->execute([$bubbleId, $key]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function activity_fresh_state(string $key, array $bubble, int $uid): array
{
    $a = (int) $bubble['user_a_id'];
    $b = (int) $bubble['user_b_id'];
    $day = gmdate('Y-m-d');
    return match ($key) {
        'daily' => [
            'dayKey' => $day,
            'question' => daily_question_for_day($day),
            'answers' => [],
        ],
        'mood' => [
            'dayKey' => $day,
            'moods' => [],
        ],
        'timeline' => [
            'milestones' => [],
            'pins' => [],
        ],
        'playlist' => [
            'tracks' => [],
            'nowId' => null,
            'reactions' => [],
        ],
        'draw' => [
            'strokes' => [],
            'seq' => 0,
        ],
        'wyr' => [
            'round' => 0,
            'prompt' => wyr_prompt(0),
            'picks' => [],
        ],
        'quiz' => [
            'phase' => 'build',
            'questions' => [],
            'scores' => [$a => 0, $b => 0],
            'guesses' => [],
        ],
        'scrapbook' => ['pages' => []],
        'bucket' => ['items' => []],
        'jar' => ['notes' => []],
        'hub' => [
            'favorites' => [],
            'calendar' => [],
            'notify' => [],
            'dateNightSeed' => random_int(1, 99999),
        ],
        default => [],
    };
}

function wyr_prompt(int $round): array
{
    $pool = [
        ['kind' => 'wyr', 'a' => 'Beach sunset', 'b' => 'Mountain cabin'],
        ['kind' => 'wyr', 'a' => 'Cook together', 'b' => 'Order takeout'],
        ['kind' => 'tot', 'a' => 'Movie night', 'b' => 'Game night'],
        ['kind' => 'tot', 'a' => 'Road trip', 'b' => 'Staycation'],
        ['kind' => 'wyr', 'a' => 'Dance in the kitchen', 'b' => 'Stargaze on the roof'],
    ];
    return $pool[$round % count($pool)];
}

function activity_load(PDO $db, array $bubble, string $key, int $uid): array
{
    $bid = (int) $bubble['id'];
    $row = activity_row($db, $bid, $key);
    if (!$row) {
        $state = activity_fresh_state($key, $bubble, $uid);
        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $db->prepare('INSERT INTO activities (bubble_id, activity_key, state_json, version, updated_at) VALUES (?,?,?,?,?)')
            ->execute([$bid, $key, $json, 1, gmdate('c')]);
        return [$state, 1];
    }
    $state = json_decode((string) $row['state_json'], true);
    if (!is_array($state)) {
        $state = activity_fresh_state($key, $bubble, $uid);
    }
    $state = activity_roll_day($key, $state, $bubble);
    return [$state, (int) $row['version']];
}

function activity_roll_day(string $key, array $state, array $bubble): array
{
    $day = gmdate('Y-m-d');
    if ($key === 'daily' && ($state['dayKey'] ?? '') !== $day) {
        return activity_fresh_state('daily', $bubble, 0);
    }
    if ($key === 'mood' && ($state['dayKey'] ?? '') !== $day) {
        return activity_fresh_state('mood', $bubble, 0);
    }
    return $state;
}

function activity_save(PDO $db, int $id, array $state, int $version): int
{
    $stmt = $db->prepare('UPDATE activities SET state_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?');
    $stmt->execute([
        json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        gmdate('c'),
        $id,
        $version,
    ]);
    if ($stmt->rowCount() !== 1) {
        throw new UserError('Your partner just updated this. Refresh and try again.');
    }
    return $version + 1;
}

function activity_read_row(PDO $db, int $uid, int $bubbleId, string $key): array
{
    $stmt = $db->prepare('SELECT * FROM activity_reads WHERE user_id = ? AND bubble_id = ? AND activity_key = ?');
    $stmt->execute([$uid, $bubbleId, $key]);
    $row = $stmt->fetch();
    if ($row) {
        return $row;
    }
    $db->prepare('INSERT INTO activity_reads (user_id, bubble_id, activity_key, last_version, last_comment_id) VALUES (?,?,?,0,0)')
        ->execute([$uid, $bubbleId, $key]);
    $stmt->execute([$uid, $bubbleId, $key]);
    return $stmt->fetch() ?: ['last_version' => 0, 'last_comment_id' => 0];
}

function activity_mark_read(PDO $db, int $uid, int $bubbleId, string $key, int $version): void
{
    activity_read_row($db, $uid, $bubbleId, $key);
    $db->prepare('UPDATE activity_reads SET last_version = ? WHERE user_id = ? AND bubble_id = ? AND activity_key = ?')
        ->execute([$version, $uid, $bubbleId, $key]);
}

function activity_comment_mark_read(PDO $db, int $uid, int $bubbleId, string $key): void
{
    activity_read_row($db, $uid, $bubbleId, $key);
    $max = $db->prepare('SELECT COALESCE(MAX(id), 0) FROM activity_comments WHERE bubble_id = ? AND activity_key = ?');
    $max->execute([$bubbleId, $key]);
    $last = (int) $max->fetchColumn();
    $db->prepare('UPDATE activity_reads SET last_comment_id = ? WHERE user_id = ? AND bubble_id = ? AND activity_key = ?')
        ->execute([$last, $uid, $bubbleId, $key]);
}

function present_activity(string $key, array $state, int $version, int $uid, array $bubble): array
{
    $a = (int) $bubble['user_a_id'];
    $b = (int) $bubble['user_b_id'];
    $partner = $uid === $a ? $b : $a;
    $view = [
        'key' => $key,
        'version' => $version,
        'yourTurn' => false,
        'needsYou' => false,
        'revealed' => false,
    ];
    if ($key === 'daily') {
        $answers = $state['answers'] ?? [];
        $mine = isset($answers[$uid]);
        $theirs = isset($answers[$partner]);
        $both = $mine && $theirs;
        $view['question'] = $state['question'] ?? '';
        $view['dayKey'] = $state['dayKey'] ?? '';
        $view['mine'] = $mine ? (string) $answers[$uid] : null;
        $view['theirs'] = $both ? (string) ($answers[$partner] ?? '') : null;
        $view['revealed'] = $both;
        $view['needsYou'] = !$mine;
        $view['waiting'] = $mine && !$theirs;
    } elseif ($key === 'mood') {
        $moods = $state['moods'] ?? [];
        $view['dayKey'] = $state['dayKey'] ?? '';
        $view['mine'] = $moods[$uid] ?? null;
        $view['theirs'] = $moods[$partner] ?? null;
        $view['needsYou'] = !isset($moods[$uid]);
        $view['revealed'] = isset($moods[$uid]) && isset($moods[$partner]);
    } elseif ($key === 'playlist') {
        $view['tracks'] = $state['tracks'] ?? [];
        $view['nowId'] = $state['nowId'] ?? null;
        $view['reactions'] = $state['reactions'] ?? [];
    } elseif ($key === 'draw') {
        $view['strokes'] = $state['strokes'] ?? [];
        $view['seq'] = (int) ($state['seq'] ?? 0);
        $last = $view['strokes'] !== [] ? $view['strokes'][count($view['strokes']) - 1] : null;
        $view['yourTurn'] = $last && (int) ($last['userId'] ?? 0) !== $uid;
    } elseif ($key === 'timeline') {
        $view['milestones'] = $state['milestones'] ?? [];
        $view['pins'] = $state['pins'] ?? [];
    } elseif ($key === 'wyr') {
        $picks = $state['picks'] ?? [];
        $view['prompt'] = $state['prompt'] ?? wyr_prompt(0);
        $view['round'] = (int) ($state['round'] ?? 0);
        $view['mine'] = $picks[$uid] ?? null;
        $view['theirs'] = isset($picks[$partner]) ? $picks[$partner] : null;
        $view['matched'] = isset($picks[$uid], $picks[$partner]) && $picks[$uid] === $picks[$partner];
        $view['needsYou'] = !isset($picks[$uid]);
        $view['revealed'] = isset($picks[$uid]) && isset($picks[$partner]);
    } elseif ($key === 'bucket') {
        $view['items'] = $state['items'] ?? [];
    } elseif ($key === 'quiz') {
        $view['phase'] = $state['phase'] ?? 'build';
        $view['questions'] = $state['questions'] ?? [];
        $view['myQuestions'] = array_values(array_filter($view['questions'], static fn ($q) => (int) ($q['aboutUserId'] ?? 0) === $uid));
        $view['current'] = (int) ($state['current'] ?? 0);
        $view['scores'] = $state['scores'] ?? [];
        $view['myScore'] = (int) ($state['scores'][(string) $uid] ?? 0);
        $view['theirScore'] = (int) ($state['scores'][(string) $partner] ?? 0);
        $qList = $state['playOrder'] ?? [];
        $cur = $qList[$view['current']] ?? null;
        $view['activeQuestion'] = null;
        if ($view['phase'] === 'play' && $cur) {
            foreach ($state['questions'] ?? [] as $q) {
                if ((int) ($q['id'] ?? 0) === (int) $cur) {
                    $view['activeQuestion'] = [
                        'id' => (int) $q['id'],
                        'prompt' => $q['prompt'],
                        'choices' => $q['choices'],
                        'aboutUserId' => (int) $q['aboutUserId'],
                    ];
                    break;
                }
            }
        }
        $aboutActive = (int) ($view['activeQuestion']['aboutUserId'] ?? 0);
        $view['needsYou'] = ($view['phase'] === 'build' && count($view['myQuestions']) < 1)
            || ($view['phase'] === 'play' && $cur && $aboutActive !== $uid && empty($state['guesses'][(string) $uid][(string) $cur]));
        $view['yourTurn'] = !empty($view['needsYou']);
        $view['canStart'] = $view['phase'] === 'build'
            && count(array_filter($view['questions'], static fn ($q) => (int) ($q['aboutUserId'] ?? 0) === $a)) >= 1
            && count(array_filter($view['questions'], static fn ($q) => (int) ($q['aboutUserId'] ?? 0) === $b)) >= 1;
        $view['revealed'] = ($view['phase'] === 'results');
    } elseif ($key === 'scrapbook') {
        $view['pages'] = $state['pages'] ?? [];
    } elseif ($key === 'jar') {
        $now = time();
        $notes = [];
        foreach ($state['notes'] ?? [] as $n) {
            $unlock = strtotime((string) ($n['unlockAt'] ?? ''));
            $mine = (int) ($n['by'] ?? 0) === $uid;
            $open = !empty($n['opened']) || $unlock <= $now;
            if ($open || $mine) {
                $notes[] = $n + ['locked' => !$open && !$mine, 'ready' => $unlock <= $now && empty($n['opened'])];
            } elseif ($unlock <= $now) {
                $notes[] = $n + ['locked' => true, 'ready' => true];
            } else {
                $notes[] = ['id' => $n['id'], 'unlockAt' => $n['unlockAt'], 'sticker' => $n['sticker'] ?? '💌', 'locked' => true, 'ready' => false];
            }
        }
        $view['notes'] = $notes;
        $view['needsYou'] = (bool) array_filter($notes, static fn ($n) => !empty($n['ready']));
    } elseif ($key === 'hub') {
        $view['favorites'] = $state['favorites'] ?? [];
        $view['calendar'] = $state['calendar'] ?? [];
        $view['notify'] = $state['notify'] ?? [];
    } else {
        $view['state'] = $state;
    }
    return $view;
}

function activity_apply(string $key, array $state, int $uid, array $bubble, array $data): array
{
    $a = (int) $bubble['user_a_id'];
    $b = (int) $bubble['user_b_id'];
    $partner = $uid === $a ? $b : $a;
    return match ($key) {
        'daily' => activity_apply_daily($state, $uid, $data),
        'mood' => activity_apply_mood($state, $uid, $data),
        'playlist' => activity_apply_playlist($state, $uid, $data),
        'draw' => activity_apply_draw($state, $uid, $data),
        'timeline' => activity_apply_timeline($state, $uid, $data),
        'wyr' => activity_apply_wyr($state, $uid, $bubble, $data),
        'bucket' => activity_apply_bucket($state, $uid, $data),
        'quiz' => activity_apply_quiz($state, $uid, $bubble, $data),
        'scrapbook' => activity_apply_scrapbook($state, $uid, $data),
        'jar' => activity_apply_jar($state, $uid, $data),
        'hub' => activity_apply_hub($state, $uid, $data),
        default => throw new UserError('This activity is not ready yet.'),
    };
}

function activity_apply_daily(array $state, int $uid, array $data): array
{
    $action = (string) ($data['action'] ?? 'answer');
    if ($action !== 'answer') {
        throw new UserError('Unknown action.');
    }
    $text = clean_block((string) ($data['text'] ?? ''), 500, 'Write your answer first.');
    $answers = $state['answers'] ?? [];
    if (isset($answers[$uid])) {
        throw new UserError('You already answered today.');
    }
    $answers[$uid] = $text;
    $state['answers'] = $answers;
    return $state;
}

function activity_apply_mood(array $state, int $uid, array $data): array
{
    $emoji = trim((string) ($data['emoji'] ?? ''));
    $allowed = ['😊', '🥰', '😌', '😢', '😤', '😴', '🤩', '😍'];
    if (!in_array($emoji, $allowed, true)) {
        throw new UserError('Pick a mood emoji.');
    }
    $moods = $state['moods'] ?? [];
    $moods[$uid] = $emoji;
    $state['moods'] = $moods;
    return $state;
}

function activity_apply_playlist(array $state, int $uid, array $data): array
{
    $action = (string) ($data['action'] ?? '');
    $tracks = $state['tracks'] ?? [];
    if ($action === 'add') {
        $url = trim((string) ($data['url'] ?? ''));
        $title = trim((string) ($data['title'] ?? ''));
        if ($url === '' && $title === '') {
            throw new UserError('Add a link or title.');
        }
        if ($url !== '' && !preg_match('#^https?://#i', $url)) {
            throw new UserError('Paste a full link starting with http.');
        }
        $id = count($tracks) + 1;
        $tracks[] = [
            'id' => $id,
            'url' => $url,
            'title' => $title !== '' ? mb_substr($title, 0, 120) : 'Track ' . $id,
            'addedBy' => $uid,
            'at' => gmdate('c'),
        ];
        $state['tracks'] = $tracks;
        return $state;
    }
    if ($action === 'play') {
        $state['nowId'] = (int) ($data['trackId'] ?? 0);
        return $state;
    }
    if ($action === 'react') {
        $trackId = (int) ($data['trackId'] ?? 0);
        $emoji = trim((string) ($data['emoji'] ?? '❤️'));
        if ($trackId <= 0) {
            throw new UserError('Pick a track.');
        }
        $reactions = $state['reactions'] ?? [];
        $key = $trackId . ':' . $uid;
        $reactions[$key] = $emoji;
        $state['reactions'] = $reactions;
        return $state;
    }
    throw new UserError('Unknown action.');
}

function activity_apply_draw(array $state, int $uid, array $data): array
{
    $action = (string) ($data['action'] ?? 'stroke');
    if ($action === 'clear') {
        $state['strokes'] = [];
        $state['seq'] = (int) ($state['seq'] ?? 0) + 1;
        return $state;
    }
    if ($action !== 'stroke') {
        throw new UserError('Unknown action.');
    }
    $stroke = $data['stroke'] ?? null;
    if (!is_array($stroke)) {
        throw new UserError('Bad stroke.');
    }
    $points = $stroke['points'] ?? [];
    if (!is_array($points) || count($points) < 2) {
        throw new UserError('Draw a little longer.');
    }
    $color = preg_match('/^#[0-9a-f]{6}$/i', (string) ($stroke['color'] ?? '')) ? strtolower((string) $stroke['color']) : '#e85d6f';
    $width = max(1, min(12, (int) ($stroke['width'] ?? 3)));
    $trimmed = [];
    foreach (array_slice($points, 0, 120) as $pt) {
        if (!is_array($pt) || count($pt) < 2) {
            continue;
        }
        $trimmed[] = [max(0, min(1, (float) $pt[0])), max(0, min(1, (float) $pt[1]))];
    }
    if (count($trimmed) < 2) {
        throw new UserError('Draw a little longer.');
    }
    $strokes = $state['strokes'] ?? [];
    $strokes[] = ['userId' => $uid, 'color' => $color, 'width' => $width, 'points' => $trimmed, 'at' => gmdate('c')];
    if (count($strokes) > 400) {
        $strokes = array_slice($strokes, -400);
    }
    $state['strokes'] = $strokes;
    $state['seq'] = (int) ($state['seq'] ?? 0) + 1;
    return $state;
}

function activity_apply_timeline(array $state, int $uid, array $data): array
{
    $action = (string) ($data['action'] ?? '');
    if ($action === 'milestone') {
        $title = clean_block((string) ($data['title'] ?? ''), 80, 'Name this milestone.');
        $date = trim((string) ($data['date'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new UserError('Use a date like 2026-06-01.');
        }
        $milestones = $state['milestones'] ?? [];
        $milestones[] = ['title' => $title, 'date' => $date, 'by' => $uid];
        usort($milestones, static fn ($x, $y) => strcmp($x['date'], $y['date']));
        $state['milestones'] = $milestones;
        return $state;
    }
    throw new UserError('Unknown action.');
}

function activity_apply_wyr(array $state, int $uid, array $bubble, array $data): array
{
    $action = (string) ($data['action'] ?? 'pick');
    $picks = $state['picks'] ?? [];
    if ($action === 'pick') {
        $choice = (string) ($data['choice'] ?? '');
        if (!in_array($choice, ['a', 'b'], true)) {
            throw new UserError('Pick A or B.');
        }
        if (isset($picks[$uid])) {
            throw new UserError('You already picked this round.');
        }
        $picks[$uid] = $choice;
        $a = (int) $bubble['user_a_id'];
        $b = (int) $bubble['user_b_id'];
        $partner = $uid === $a ? $b : $a;
        if (isset($picks[$partner])) {
            $state['round'] = (int) ($state['round'] ?? 0) + 1;
            $state['prompt'] = wyr_prompt((int) $state['round']);
            $state['picks'] = [];
        } else {
            $state['picks'] = $picks;
        }
        return $state;
    }
    throw new UserError('Unknown action.');
}

function activity_apply_bucket(array $state, int $uid, array $data): array
{
    $action = (string) ($data['action'] ?? '');
    $items = $state['items'] ?? [];
    if ($action === 'add') {
        $text = clean_block((string) ($data['text'] ?? ''), 120, 'Write something to dream about.');
        $items[] = ['id' => count($items) + 1, 'text' => $text, 'done' => false, 'by' => $uid];
        $state['items'] = $items;
        return $state;
    }
    if ($action === 'done') {
        $id = (int) ($data['id'] ?? 0);
        foreach ($items as &$item) {
            if ((int) ($item['id'] ?? 0) === $id) {
                $item['done'] = true;
                $item['doneAt'] = gmdate('c');
            }
        }
        unset($item);
        $state['items'] = $items;
        return $state;
    }
    throw new UserError('Unknown action.');
}

function activity_apply_quiz(array $state, int $uid, array $bubble, array $data): array
{
    $action = (string) ($data['action'] ?? '');
    $a = (int) $bubble['user_a_id'];
    $b = (int) $bubble['user_b_id'];
    $questions = $state['questions'] ?? [];
    if ($action === 'add') {
        if (($state['phase'] ?? 'build') !== 'build') {
            throw new UserError('The quiz already started.');
        }
        $prompt = clean_block((string) ($data['prompt'] ?? ''), 200, 'Write a question about you.');
        $choices = $data['choices'] ?? [];
        if (!is_array($choices) || count($choices) !== 4) {
            throw new UserError('Add exactly four choices.');
        }
        $clean = [];
        foreach ($choices as $c) {
            $t = trim((string) $c);
            if ($t === '') {
                throw new UserError('Fill in every choice.');
            }
            $clean[] = mb_substr($t, 0, 80);
        }
        $correct = (int) ($data['correct'] ?? 0);
        if ($correct < 0 || $correct > 3) {
            throw new UserError('Pick the correct answer.');
        }
        $id = count($questions) + 1;
        $questions[] = [
            'id' => $id,
            'aboutUserId' => $uid,
            'prompt' => $prompt,
            'choices' => $clean,
            'correct' => $correct,
        ];
        $state['questions'] = $questions;
        return $state;
    }
    if ($action === 'start') {
        $mine = count(array_filter($questions, static fn ($q) => (int) ($q['aboutUserId'] ?? 0) === $a));
        $theirs = count(array_filter($questions, static fn ($q) => (int) ($q['aboutUserId'] ?? 0) === $b));
        if ($mine < 1 || $theirs < 1) {
            throw new UserError('Each of you needs at least one question.');
        }
        $order = array_map(static fn ($q) => (int) $q['id'], $questions);
        shuffle($order);
        $state['phase'] = 'play';
        $state['playOrder'] = $order;
        $state['current'] = 0;
        $state['guesses'] = [];
        $state['scores'] = [(string) $a => 0, (string) $b => 0];
        return $state;
    }
    if ($action === 'guess') {
        if (($state['phase'] ?? '') !== 'play') {
            throw new UserError('The quiz is not in play.');
        }
        $order = $state['playOrder'] ?? [];
        $idx = (int) ($state['current'] ?? 0);
        $qid = (int) ($order[$idx] ?? 0);
        $question = null;
        foreach ($questions as $q) {
            if ((int) ($q['id'] ?? 0) === $qid) {
                $question = $q;
                break;
            }
        }
        if (!$question || (int) $question['aboutUserId'] === $uid) {
            throw new UserError('You answer questions about your partner.');
        }
        $guesses = $state['guesses'] ?? [];
        if (!empty($guesses[(string) $uid][(string) $qid])) {
            throw new UserError('You already answered this one.');
        }
        $choice = (int) ($data['choice'] ?? -1);
        if ($choice < 0 || $choice > 3) {
            throw new UserError('Pick an answer.');
        }
        $guesses[(string) $uid][(string) $qid] = $choice;
        $state['guesses'] = $guesses;
        if ($choice === (int) $question['correct']) {
            $scores = $state['scores'] ?? [];
            $scores[(string) $uid] = (int) ($scores[(string) $uid] ?? 0) + 1;
            $state['scores'] = $scores;
        }
        $state['current'] = $idx + 1;
        if ($state['current'] >= count($order)) {
            $state['phase'] = 'results';
        }
        return $state;
    }
    throw new UserError('Unknown action.');
}

function activity_apply_scrapbook(array $state, int $uid, array $data): array
{
    $action = (string) ($data['action'] ?? 'page');
    if ($action !== 'page') {
        throw new UserError('Unknown action.');
    }
    $caption = trim((string) ($data['caption'] ?? ''));
    $body = trim((string) ($data['body'] ?? ''));
    $momentId = (int) ($data['momentId'] ?? 0);
    $sticker = trim((string) ($data['sticker'] ?? '📎'));
    if ($caption === '' && $body === '' && $momentId <= 0) {
        throw new UserError('Add a caption, note, or moment.');
    }
    $pages = $state['pages'] ?? [];
    $pages[] = [
        'id' => count($pages) + 1,
        'caption' => mb_substr($caption, 0, 200),
        'body' => mb_substr($body, 0, 500),
        'momentId' => $momentId > 0 ? $momentId : null,
        'sticker' => mb_substr($sticker, 0, 4),
        'by' => $uid,
        'at' => gmdate('c'),
    ];
    $state['pages'] = $pages;
    return $state;
}

function activity_apply_jar(array $state, int $uid, array $data): array
{
    $action = (string) ($data['action'] ?? '');
    $notes = $state['notes'] ?? [];
    if ($action === 'add') {
        $body = clean_block((string) ($data['body'] ?? ''), 500, 'Write a note first.');
        $unlockAt = trim((string) ($data['unlockAt'] ?? ''));
        if ($unlockAt !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/', $unlockAt)) {
            throw new UserError('Use a date and time for unlock.');
        }
        if ($unlockAt === '') {
            $unlockAt = gmdate('c');
        }
        $notes[] = [
            'id' => count($notes) + 1,
            'body' => $body,
            'sticker' => trim((string) ($data['sticker'] ?? '💌')) ?: '💌',
            'unlockAt' => $unlockAt,
            'voiceFile' => trim((string) ($data['voiceFile'] ?? '')),
            'by' => $uid,
            'opened' => false,
        ];
        $state['notes'] = $notes;
        return $state;
    }
    if ($action === 'open') {
        $id = (int) ($data['id'] ?? 0);
        $now = time();
        foreach ($notes as &$note) {
            if ((int) ($note['id'] ?? 0) !== $id) {
                continue;
            }
            $unlock = strtotime((string) ($note['unlockAt'] ?? ''));
            if ($unlock > $now) {
                throw new UserError('That note is still sealed.');
            }
            $note['opened'] = true;
        }
        unset($note);
        $state['notes'] = $notes;
        return $state;
    }
    throw new UserError('Unknown action.');
}

function activity_apply_hub(array $state, int $uid, array $data): array
{
    $action = (string) ($data['action'] ?? '');
    if ($action === 'favorite') {
        $favorites = $state['favorites'] ?? [];
        $entry = [
            'type' => (string) ($data['type'] ?? 'note'),
            'id' => (int) ($data['id'] ?? 0),
            'label' => mb_substr(trim((string) ($data['label'] ?? '')), 0, 80),
        ];
        $favorites = array_values(array_filter($favorites, static fn ($f) => !($f['type'] === $entry['type'] && (int) $f['id'] === $entry['id'])));
        $favorites[] = $entry;
        $state['favorites'] = array_slice($favorites, -30);
        return $state;
    }
    if ($action === 'calendar') {
        $events = $state['calendar'] ?? [];
        $title = clean_block((string) ($data['title'] ?? ''), 80, 'Name this event.');
        $at = trim((string) ($data['at'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $at)) {
            throw new UserError('Use a date like 2026-12-01.');
        }
        $events[] = ['id' => count($events) + 1, 'title' => $title, 'at' => $at, 'kind' => (string) ($data['kind'] ?? 'date')];
        $state['calendar'] = $events;
        return $state;
    }
    if ($action === 'notify') {
        $notify = $state['notify'] ?? [];
        $key = preg_replace('/[^a-z_]/', '', (string) ($data['key'] ?? ''));
        if ($key === '') {
            throw new UserError('Unknown preference.');
        }
        $notify[$key] = [
            'sound' => !empty($data['sound']),
            'mute' => !empty($data['mute']),
        ];
        $state['notify'] = $notify;
        return $state;
    }
    throw new UserError('Unknown action.');
}

function activity_hub_badges(PDO $db, int $uid, int $bubbleId): array
{
    $out = [
        'daily' => 0,
        'mood' => 0,
        'playlist' => 0,
        'draw' => 0,
        'play' => 0,
        'share' => 0,
        'plan' => 0,
        'create' => 0,
    ];
    $bubble = bubble_for_member($db, $uid, $bubbleId);
    if (!$bubble) {
        return $out;
    }
    foreach (['daily', 'mood', 'playlist', 'draw', 'quiz', 'jar', 'scrapbook'] as $key) {
        $row = activity_row($db, $bubbleId, $key);
        if (!$row) {
            continue;
        }
        $read = activity_read_row($db, $uid, $bubbleId, $key);
        $version = (int) $row['version'];
        if ($version <= (int) $read['last_version']) {
            continue;
        }
        [$state] = activity_load($db, $bubble, $key, $uid);
        $view = present_activity($key, $state, $version, $uid, $bubble);
        if (!empty($view['needsYou'])) {
            $out[$key] = 1;
        } elseif ($key === 'daily' && !empty($view['revealed']) && (int) $read['last_version'] < $version) {
            $out[$key] = 1;
        } elseif ($key === 'draw' && !empty($view['yourTurn'])) {
            $out['draw'] = 1;
        }
        $stmt = $db->prepare('SELECT COUNT(*) FROM activity_comments WHERE bubble_id = ? AND activity_key = ? AND id > ? AND sender_id != ?');
        $stmt->execute([$bubbleId, $key, (int) $read['last_comment_id'], $uid]);
        $comments = (int) $stmt->fetchColumn();
        if ($comments > 0) {
            $out[$key] = max($out[$key], $comments);
        }
    }
    $hubRow = activity_row($db, $bubbleId, 'hub');
    if ($hubRow) {
        $state = json_decode((string) $hubRow['state_json'], true);
        if (is_array($state)) {
            $read = activity_read_row($db, $uid, $bubbleId, 'hub');
            if ((int) $hubRow['version'] > (int) $read['last_version']) {
                $out['plan'] = count($state['calendar'] ?? []) > 0 ? 1 : 0;
            }
        }
    }
    $out['play'] = ($out['daily'] ?? 0) + ($out['mood'] ?? 0) + ($out['quiz'] ?? 0);
    $out['share'] = ($out['playlist'] ?? 0) + ($out['mood'] ?? 0) + ($out['scrapbook'] ?? 0);
    $out['create'] = ($out['draw'] ?? 0) + ($out['jar'] ?? 0);
    return $out;
}
