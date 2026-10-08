<?php
declare(strict_types=1);

require __DIR__ . '/includes/bootstrap.php';

$action = (string) ($_GET['action'] ?? '');

match ($action) {
    'state' => handle_state(),
    'register' => handle_register(),
    'login' => handle_login(),
    'logout' => handle_logout(),
    'forgot_password' => handle_forgot_password(),
    'verify_reset_code' => handle_verify_reset_code(),
    'reset_password' => handle_reset_password(),
    'profile' => handle_profile(),
    'invite' => handle_invite(),
    'respond' => handle_respond(),
    'cancel' => handle_cancel(),
    'leave' => handle_leave(),
    'messages' => handle_messages(),
    'message' => handle_message(),
    'notes' => handle_notes(),
    'note' => handle_note(),
    'delete_note' => handle_delete_note(),
    'moments' => handle_moments(),
    'moment' => handle_moment(),
    'delete_moment' => handle_delete_moment(),
    'moment_comments' => handle_moment_comments(),
    'moment_comment' => handle_moment_comment(),
    'moment_react' => handle_moment_react(),
    'moment_image' => handle_moment_image(),
    'jar_audio' => handle_jar_audio(),
    'game' => handle_game(),
    'games_list' => handle_games_list(),
    'game_move' => handle_game_move(),
    'game_reset' => handle_game_reset(),
    'watch' => handle_watch(),
    'watch_comments' => handle_watch_comments(),
    'watch_comment' => handle_watch_comment(),
    'game_comments' => handle_game_comments(),
    'game_comment' => handle_game_comment(),
    'notes_seen' => handle_notes_seen(),
    'chat_seen' => handle_chat_seen(),
    'moments_seen' => handle_moments_seen(),
    'watch_seen' => handle_watch_seen(),
    'signal' => handle_signal(),
    'presence' => handle_presence(),
    'bubble_meta' => handle_bubble_meta(),
    'activity' => handle_activity(),
    'activity_action' => handle_activity_action(),
    'activity_comments' => handle_activity_comments(),
    'activity_comment' => handle_activity_comment(),
    'activity_seen' => handle_activity_seen(),
    'timeline_feed' => handle_timeline_feed(),
    'search' => handle_search(),
    'jar_voice' => handle_jar_voice(),
    default => json_out(['ok' => false, 'error' => 'Unknown action.'], 404),
};

function handle_state(): void
{
    $db = db();
    $user = current_user();
    if (!$user) {
        json_ok(['user' => null, 'bubble' => null, 'preview' => null, 'badges' => bubble_badges_empty(), 'serverNow' => microtime(true)]);
    }
    $uid = (int) $user['id'];
    $selected = null;
    $want = (int) ($_GET['bubble'] ?? 0);
    $bubbles = [];
    foreach (links_for($db, $uid) as $link) {
        $public = bubble_public($db, $link, $uid);
        if ($link['status'] === 'active') {
            $snippet = preview_message($db, (int) $link['id']);
            $public['snippet'] = is_array($snippet) ? $snippet['body'] : '';
        }
        $bubbles[] = $public;
        if ($want > 0 && (int) $link['id'] === $want && $link['status'] === 'active') {
            $selected = $link;
        }
    }
    $preview = null;
    if ($selected) {
        $bid = (int) $selected['id'];
        $preview = [
            'message' => preview_message($db, $bid),
            'note' => preview_note($db, $bid),
            'moment' => preview_moment($db, $bid),
        ];
    }
    $badges = bubble_badges_empty();
    if ($selected && $selected['status'] === 'active') {
        $badges = bubble_badges($db, $uid, (int) $selected['id']);
    } else {
        $badges['bubbles'] = pending_bubble_invites($db, $uid);
    }
    json_ok([
        'user' => user_public($user),
        'bubbles' => $bubbles,
        'bubble' => $selected ? bubble_public($db, $selected, $uid) : null,
        'preview' => $preview,
        'badges' => $badges,
        'serverNow' => microtime(true),
    ]);
}

function handle_notes_seen(): void
{
    bubble_seen_response('notes');
}

function handle_chat_seen(): void
{
    bubble_seen_response('chat');
}

function handle_moments_seen(): void
{
    bubble_seen_response('moments');
}

function handle_watch_seen(): void
{
    bubble_seen_response('watch');
}

function bubble_seen_response(string $section): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $db = db();
    $bid = (int) $bubble['id'];
    $uid = (int) $user['id'];
    match ($section) {
        'notes' => bubble_note_mark_read($db, $uid, $bid),
        'chat' => bubble_chat_mark_read($db, $uid, $bid),
        'moments' => bubble_moment_mark_read($db, $uid, $bid),
        'watch' => bubble_watch_mark_read($db, $uid, $bid),
        default => throw new UserError('Unknown section.'),
    };
    json_ok(['badges' => bubble_badges($db, $uid, $bid)]);
}

function bubble_badges_empty(): array
{
    return [
        'bubbles' => 0, 'chat' => 0, 'notes' => 0, 'moments' => 0, 'watch' => 0, 'games' => 0,
        'daily' => 0, 'mood' => 0, 'playlist' => 0, 'draw' => 0,
        'hubWatch' => 0, 'hubChat' => 0, 'hubPlay' => 0, 'hubShare' => 0, 'hubPlan' => 0, 'hubCreate' => 0,
    ];
}

function pending_bubble_invites(PDO $db, int $uid): int
{
    $stmt = $db->prepare("SELECT COUNT(*) AS n FROM bubbles WHERE user_b_id = ? AND status = 'pending'");
    $stmt->execute([$uid]);
    return (int) $stmt->fetch()['n'];
}

function bubble_activity_badges(PDO $db, int $uid, int $bubbleId): array
{
    $read = bubble_read_row($db, $uid, $bubbleId);

    $stmt = $db->prepare('SELECT COUNT(*) AS n FROM messages WHERE bubble_id = ? AND id > ? AND sender_id != ?');
    $stmt->execute([$bubbleId, (int) ($read['last_message_id'] ?? 0), $uid]);
    $chat = (int) $stmt->fetch()['n'];

    $stmt = $db->prepare('SELECT COUNT(*) AS n FROM notes WHERE bubble_id = ? AND id > ? AND author_id != ?');
    $stmt->execute([$bubbleId, (int) ($read['last_note_id'] ?? 0), $uid]);
    $notes = (int) $stmt->fetch()['n'];

    $stmt = $db->prepare('SELECT COUNT(*) AS n FROM moments WHERE bubble_id = ? AND id > ? AND author_id != ?');
    $stmt->execute([$bubbleId, (int) ($read['last_moment_id'] ?? 0), $uid]);
    $moments = (int) $stmt->fetch()['n'];

    $stmt = $db->prepare('SELECT COUNT(*) AS n FROM watch_comments WHERE bubble_id = ? AND id > ? AND sender_id != ?');
    $stmt->execute([$bubbleId, (int) ($read['last_watch_comment_id'] ?? 0), $uid]);
    $watchComments = (int) $stmt->fetch()['n'];

    $watch = watch_row($db, $bubbleId);
    $watchNew = 0;
    if (!empty($watch['video_id']) && (int) ($watch['updated_by'] ?? 0) !== $uid) {
        $key = (string) $watch['video_id'] . ':' . (string) $watch['updated_at'];
        if ($key !== (string) ($read['last_watch_key'] ?? '')) {
            $watchNew = 1;
        }
    }

    $games = 0;
    foreach (['tictactoe', 'checkers', 'kahoot', 'connect4', 'memory', 'hangman'] as $type) {
        $row = find_game($db, $bubbleId, $type);
        if (!$row) {
            continue;
        }
        $state = json_decode((string) $row['state_json'], true);
        if (!is_array($state)) {
            continue;
        }
        $view = present_game($type, $state, (int) $row['version'], $uid);
        if (!empty($view['yourTurn'])) {
            $games++;
        }
    }

    $hub = activity_hub_badges($db, $uid, $bubbleId);
    return [
        'chat' => $chat,
        'notes' => $notes,
        'moments' => $moments,
        'watch' => $watchComments + $watchNew,
        'games' => $games,
        'daily' => $hub['daily'] ?? 0,
        'mood' => $hub['mood'] ?? 0,
        'playlist' => $hub['playlist'] ?? 0,
        'draw' => $hub['draw'] ?? 0,
        'hubWatch' => $watchComments + $watchNew,
        'hubChat' => $chat,
        'hubPlay' => $games + ($hub['daily'] ?? 0) + ($hub['mood'] ?? 0),
        'hubShare' => $moments + $notes + ($hub['playlist'] ?? 0),
        'hubPlan' => $hub['plan'] ?? 0,
        'hubCreate' => ($hub['draw'] ?? 0) + ($hub['create'] ?? 0),
    ];
}

function bubbles_nav_badge(PDO $db, int $uid, int $currentBubbleId): int
{
    $invites = pending_bubble_invites($db, $uid);
    $other = 0;
    foreach (links_for($db, $uid) as $link) {
        if ($link['status'] !== 'active') {
            continue;
        }
        $bid = (int) $link['id'];
        if ($bid === $currentBubbleId) {
            continue;
        }
        $activity = bubble_activity_badges($db, $uid, $bid);
        $other += $activity['chat'] + $activity['notes'] + $activity['moments'] + $activity['watch'] + $activity['games'];
    }
    return $invites + $other;
}

function bubble_badges(PDO $db, int $uid, int $bubbleId): array
{
    $activity = bubble_activity_badges($db, $uid, $bubbleId);
    $activity['bubbles'] = bubbles_nav_badge($db, $uid, $bubbleId);
    return $activity;
}

function handle_register(): void
{
    require_mutation();
    $data = read_json();
    $name = clean_name((string) ($data['displayName'] ?? ''));
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new UserError('Enter a valid email.');
    }
    if (strlen($password) < 6) {
        throw new UserError('Use at least 6 characters for the password.');
    }
    if (strlen($password) > 200) {
        throw new UserError('That password is too long.');
    }
    $db = db();
    $exists = $db->prepare('SELECT 1 FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        throw new UserError('That email is already registered. Try signing in.');
    }
    $username = make_username($db);
    $now = gmdate('c');
    $db->prepare('INSERT INTO users (email, password_hash, display_name, username, created_at) VALUES (?,?,?,?,?)')
        ->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name, $username, $now]);
    $id = (int) $db->lastInsertId();
    set_uid($id);
    $user = user_by_id($db, $id);
    json_ok(['user' => user_public($user)]);
}

function handle_login(): void
{
    require_mutation();
    $data = read_json();
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');
    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        throw new UserError('Email or password does not match.');
    }
    set_uid((int) $user['id']);
    json_ok(['user' => user_public($user)]);
}

function handle_logout(): void
{
    require_mutation();
    clear_uid();
    json_ok();
}

function handle_profile(): void
{
    require_mutation();
    $user = require_user();
    $data = read_json();
    $db = db();
    $name = array_key_exists('displayName', $data) ? clean_name((string) $data['displayName']) : $user['display_name'];
    $username = $user['username'];
    if (array_key_exists('username', $data)) {
        $username = clean_username((string) $data['username']);
        if ($username !== $user['username']) {
            $taken = $db->prepare('SELECT 1 FROM users WHERE username = ? AND id != ?');
            $taken->execute([$username, (int) $user['id']]);
            if ($taken->fetch()) {
                throw new UserError('That username is taken. Try another.');
            }
        }
    }
    $appearance = $user['appearance'] ?? null;
    if (array_key_exists('appearance', $data)) {
        if (!is_array($data['appearance'])) {
            throw new UserError('That look could not be saved.');
        }
        $appearance = json_encode(appearance_normalize($data['appearance']));
    }
    $db->prepare('UPDATE users SET display_name = ?, username = ?, appearance = ? WHERE id = ?')
        ->execute([$name, $username, $appearance, (int) $user['id']]);
    json_ok(['user' => user_public(user_by_id($db, (int) $user['id']))]);
}

function handle_invite(): void
{
    require_mutation();
    $user = require_user();
    $data = read_json();
    $username = clean_username((string) ($data['username'] ?? ''));
    $db = db();
    $uid = (int) $user['id'];
    if ($username === $user['username']) {
        throw new UserError('That username is yours. Ask your partner for theirs.');
    }
    $stmt = $db->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $partner = $stmt->fetch();
    if (!$partner) {
        throw new UserError('No one has that username yet.');
    }
    $pid = (int) $partner['id'];
    $existing = pair_link($db, $uid, $pid);
    if ($existing) {
        if ($existing['status'] === 'active') {
            throw new UserError('You already have a bubble with them. Open it from your list.');
        }
        if ((int) $existing['user_b_id'] === $uid) {
            throw new UserError('They already invited you. Accept it in your bubble list.');
        }
        throw new UserError('You already invited them. Waiting for a yes.');
    }
    $now = gmdate('c');
    $db->prepare('INSERT INTO bubbles (user_a_id, user_b_id, status, created_at, updated_at) VALUES (?,?,?,?,?)')
        ->execute([$uid, $pid, 'pending', $now, $now]);
    $bubble = bubble_for_member($db, $uid, (int) $db->lastInsertId());
    json_ok(['bubble' => bubble_public($db, $bubble, $uid)]);
}

function handle_respond(): void
{
    require_mutation();
    $user = require_user();
    $data = read_json();
    $accept = (bool) ($data['accept'] ?? false);
    $db = db();
    $uid = (int) $user['id'];
    $bubble = bubble_for_member($db, $uid, (int) ($data['id'] ?? 0));
    if (!$bubble || $bubble['status'] !== 'pending' || (int) $bubble['user_b_id'] !== $uid) {
        throw new UserError('There is no invite waiting for you.');
    }
    $status = $accept ? 'active' : 'declined';
    $db->prepare('UPDATE bubbles SET status = ?, updated_at = ? WHERE id = ?')
        ->execute([$status, gmdate('c'), (int) $bubble['id']]);
    $fresh = $accept ? bubble_for_member($db, $uid, (int) $bubble['id']) : null;
    json_ok(['bubble' => $fresh ? bubble_public($db, $fresh, $uid) : null]);
}

function handle_cancel(): void
{
    require_mutation();
    $user = require_user();
    $data = read_json();
    $db = db();
    $uid = (int) $user['id'];
    $bubble = bubble_for_member($db, $uid, (int) ($data['id'] ?? 0));
    if (!$bubble || $bubble['status'] !== 'pending' || (int) $bubble['user_a_id'] !== $uid) {
        throw new UserError('There is no invite to cancel.');
    }
    $db->prepare("UPDATE bubbles SET status = 'cancelled', updated_at = ? WHERE id = ?")
        ->execute([gmdate('c'), (int) $bubble['id']]);
    json_ok(['bubble' => null]);
}

function handle_leave(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    db()->prepare("UPDATE bubbles SET status = 'ended', updated_at = ? WHERE id = ?")
        ->execute([gmdate('c'), (int) $bubble['id']]);
    json_ok(['bubble' => null]);
}

function handle_messages(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $since = (int) ($_GET['since'] ?? 0);
    $db = db();
    if ($since > 0) {
        $stmt = $db->prepare('SELECT * FROM messages WHERE bubble_id = ? AND id > ? ORDER BY id ASC LIMIT 100');
        $stmt->execute([(int) $bubble['id'], $since]);
        $rows = $stmt->fetchAll();
    } else {
        $stmt = $db->prepare('SELECT * FROM (SELECT * FROM messages WHERE bubble_id = ? ORDER BY id DESC LIMIT 80) ORDER BY id ASC');
        $stmt->execute([(int) $bubble['id']]);
        $rows = $stmt->fetchAll();
    }
    json_ok(['messages' => array_map('message_public', $rows)]);
}

function handle_message(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $body = clean_block((string) ($data['body'] ?? ''), 1000, 'Write a message first.');
    $now = gmdate('c');
    $db = db();
    $db->prepare('INSERT INTO messages (bubble_id, sender_id, body, created_at) VALUES (?,?,?,?)')
        ->execute([(int) $bubble['id'], (int) $user['id'], $body, $now]);
    $db->prepare('UPDATE bubbles SET updated_at = ? WHERE id = ?')->execute([$now, (int) $bubble['id']]);
    $id = (int) $db->lastInsertId();
    json_ok(['message' => [
        'id' => $id,
        'senderId' => (int) $user['id'],
        'body' => $body,
        'createdAt' => $now,
    ]]);
}

function handle_notes(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $stmt = db()->prepare('SELECT * FROM notes WHERE bubble_id = ? ORDER BY id DESC LIMIT 60');
    $stmt->execute([(int) $bubble['id']]);
    json_ok(['notes' => array_map('note_public', $stmt->fetchAll())]);
}

function handle_note(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $content = clean_block((string) ($data['content'] ?? ''), 500, 'Write a note first.');
    $color = (string) ($data['color'] ?? 'blush');
    if (!in_array($color, note_colors(), true)) {
        $color = 'blush';
    }
    $now = gmdate('c');
    db()->prepare('INSERT INTO notes (bubble_id, author_id, content, color, created_at) VALUES (?,?,?,?,?)')
        ->execute([(int) $bubble['id'], (int) $user['id'], $content, $color, $now]);
    json_ok(['note' => [
        'id' => (int) db()->lastInsertId(),
        'authorId' => (int) $user['id'],
        'content' => $content,
        'color' => $color,
        'createdAt' => $now,
    ]]);
}

function handle_delete_note(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $id = (int) (read_json()['id'] ?? 0);
    $stmt = db()->prepare('DELETE FROM notes WHERE id = ? AND bubble_id = ? AND author_id = ?');
    $stmt->execute([$id, (int) $bubble['id'], (int) $user['id']]);
    if ($stmt->rowCount() !== 1) {
        throw new UserError('You can only remove notes you wrote.');
    }
    json_ok();
}

function handle_moments(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $bid = (int) $bubble['id'];
    $uid = (int) $user['id'];
    $stmt = db()->prepare('SELECT id, bubble_id, author_id, caption, created_at FROM moments WHERE bubble_id = ? ORDER BY id DESC LIMIT 60');
    $stmt->execute([$bid]);
    $rows = $stmt->fetchAll();
    $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
    $social = moment_social_bundle(db(), $ids, $uid);
    $moments = [];
    foreach ($rows as $row) {
        $moments[] = moment_public($row, $social[(int) $row['id']] ?? null);
    }
    json_ok(['moments' => $moments]);
}

function handle_moment(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $caption = trim((string) ($_POST['caption'] ?? ''));
    $caption = str_replace("\r\n", "\n", $caption);
    if (mb_strlen($caption) > 300) {
        throw new UserError('Keep the caption under 300 characters.');
    }
    if (!isset($_FILES['photo']) || !is_uploaded_file($_FILES['photo']['tmp_name'] ?? '')) {
        throw new UserError('Choose a photo to share.');
    }
    if ((int) $_FILES['photo']['size'] > 5 * 1024 * 1024) {
        throw new UserError('Choose a photo under 5 MB.');
    }
    $filename = bin2hex(random_bytes(16)) . '.jpg';
    $dest = storage_dir() . '/moments/' . $filename;
    save_upload_image($_FILES['photo']['tmp_name'], $dest);
    $now = gmdate('c');
    db()->prepare('INSERT INTO moments (bubble_id, author_id, caption, filename, created_at) VALUES (?,?,?,?,?)')
        ->execute([(int) $bubble['id'], (int) $user['id'], $caption, $filename, $now]);
    $mid = (int) db()->lastInsertId();
    $row = ['id' => $mid, 'author_id' => (int) $user['id'], 'caption' => $caption, 'created_at' => $now];
    json_ok(['moment' => moment_public($row, ['reactionCounts' => [], 'myReaction' => null, 'commentCount' => 0])]);
}

function handle_delete_moment(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $id = (int) (read_json()['id'] ?? 0);
    $stmt = db()->prepare('SELECT * FROM moments WHERE id = ? AND bubble_id = ?');
    $stmt->execute([$id, (int) $bubble['id']]);
    $row = $stmt->fetch();
    if (!$row || (int) $row['author_id'] !== (int) $user['id']) {
        throw new UserError('You can only remove moments you shared.');
    }
    $path = storage_dir() . '/moments/' . basename((string) $row['filename']);
    if (is_file($path)) {
        unlink($path);
    }
    $db = db();
    $db->prepare('DELETE FROM moment_comments WHERE moment_id = ?')->execute([$id]);
    $db->prepare('DELETE FROM moment_reactions WHERE moment_id = ?')->execute([$id]);
    $db->prepare('DELETE FROM moments WHERE id = ?')->execute([$id]);
    json_ok();
}

function moment_reaction_emojis(): array
{
    return ['❤️', '😍', '🔥', '😂', '👏', '🥰', '✨', '😮'];
}

function moment_normalize_emoji(string $emoji): string
{
    $emoji = trim($emoji);
    if (!in_array($emoji, moment_reaction_emojis(), true)) {
        throw new UserError('Pick one of the reactions shown.');
    }
    return $emoji;
}

function moment_belongs(PDO $db, int $momentId, int $bubbleId): array
{
    $stmt = $db->prepare('SELECT * FROM moments WHERE id = ? AND bubble_id = ?');
    $stmt->execute([$momentId, $bubbleId]);
    $row = $stmt->fetch();
    if (!$row) {
        throw new UserError('That moment is not here anymore.');
    }
    return $row;
}

function moment_social_bundle(PDO $db, array $momentIds, int $uid): array
{
    $momentIds = array_values(array_filter(array_map('intval', $momentIds)));
    if ($momentIds === []) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($momentIds), '?'));
    $out = [];
    foreach ($momentIds as $id) {
        $out[$id] = ['reactionCounts' => [], 'myReaction' => null, 'commentCount' => 0];
    }

    $stmt = $db->prepare("SELECT moment_id, emoji, COUNT(*) AS n FROM moment_reactions WHERE moment_id IN ($placeholders) GROUP BY moment_id, emoji");
    $stmt->execute($momentIds);
    foreach ($stmt->fetchAll() as $row) {
        $mid = (int) $row['moment_id'];
        $out[$mid]['reactionCounts'][$row['emoji']] = (int) $row['n'];
    }

    $stmt = $db->prepare("SELECT moment_id, emoji FROM moment_reactions WHERE moment_id IN ($placeholders) AND user_id = ?");
    $stmt->execute([...$momentIds, $uid]);
    foreach ($stmt->fetchAll() as $row) {
        $out[(int) $row['moment_id']]['myReaction'] = $row['emoji'];
    }

    $stmt = $db->prepare("SELECT moment_id, COUNT(*) AS n FROM moment_comments WHERE moment_id IN ($placeholders) GROUP BY moment_id");
    $stmt->execute($momentIds);
    foreach ($stmt->fetchAll() as $row) {
        $out[(int) $row['moment_id']]['commentCount'] = (int) $row['n'];
    }

    return $out;
}

function handle_moment_comments(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $momentId = (int) ($_GET['moment'] ?? 0);
    if ($momentId <= 0) {
        throw new UserError('Choose a moment first.');
    }
    moment_belongs(db(), $momentId, (int) $bubble['id']);
    $since = (int) ($_GET['since'] ?? 0);
    $db = db();
    if ($since > 0) {
        $stmt = $db->prepare('SELECT * FROM moment_comments WHERE moment_id = ? AND id > ? ORDER BY id ASC LIMIT 100');
        $stmt->execute([$momentId, $since]);
        $rows = $stmt->fetchAll();
    } else {
        $stmt = $db->prepare('SELECT * FROM (SELECT * FROM moment_comments WHERE moment_id = ? ORDER BY id DESC LIMIT 80) ORDER BY id ASC');
        $stmt->execute([$momentId]);
        $rows = $stmt->fetchAll();
    }
    json_ok(['comments' => array_map('moment_comment_public', $rows)]);
}

function handle_moment_comment(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $momentId = (int) ($data['momentId'] ?? 0);
    moment_belongs(db(), $momentId, (int) $bubble['id']);
    $body = clean_block((string) ($data['body'] ?? ''), 280, 'Write a comment first.');
    $now = gmdate('c');
    $db = db();
    $db->prepare('INSERT INTO moment_comments (moment_id, bubble_id, sender_id, body, created_at) VALUES (?,?,?,?,?)')
        ->execute([$momentId, (int) $bubble['id'], (int) $user['id'], $body, $now]);
    $id = (int) $db->lastInsertId();
    json_ok(['comment' => moment_comment_public([
        'id' => $id,
        'moment_id' => $momentId,
        'bubble_id' => (int) $bubble['id'],
        'sender_id' => (int) $user['id'],
        'body' => $body,
        'created_at' => $now,
    ])]);
}

function handle_moment_react(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $momentId = (int) ($data['momentId'] ?? 0);
    moment_belongs(db(), $momentId, (int) $bubble['id']);
    $uid = (int) $user['id'];
    $emoji = trim((string) ($data['emoji'] ?? ''));
    $db = db();
    if ($emoji === '') {
        $db->prepare('DELETE FROM moment_reactions WHERE moment_id = ? AND user_id = ?')->execute([$momentId, $uid]);
    } else {
        $emoji = moment_normalize_emoji($emoji);
        $now = gmdate('c');
        $db->prepare('INSERT INTO moment_reactions (moment_id, user_id, emoji, created_at) VALUES (?,?,?,?)
            ON CONFLICT(moment_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at')
            ->execute([$momentId, $uid, $emoji, $now]);
    }
    $social = moment_social_bundle($db, [$momentId], $uid)[$momentId] ?? ['reactionCounts' => [], 'myReaction' => null, 'commentCount' => 0];
    json_ok(['momentId' => $momentId, ...$social]);
}

function moment_comment_public(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'momentId' => (int) $row['moment_id'],
        'senderId' => (int) $row['sender_id'],
        'body' => $row['body'],
        'createdAt' => $row['created_at'],
    ];
}

function handle_moment_image(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $id = (int) ($_GET['id'] ?? 0);
    $stmt = db()->prepare('SELECT * FROM moments WHERE id = ? AND bubble_id = ?');
    $stmt->execute([$id, (int) $bubble['id']]);
    $row = $stmt->fetch();
    if (!$row) {
        json_out(['ok' => false, 'error' => 'That photo is gone.'], 404);
    }
    $base = realpath(storage_dir() . '/moments');
    $path = realpath($base . DIRECTORY_SEPARATOR . basename((string) $row['filename']));
    $baseNorm = strtolower(str_replace('\\', '/', (string) $base));
    $pathNorm = strtolower(str_replace('\\', '/', (string) $path));
    if (!$path || !str_starts_with($pathNorm, $baseNorm) || !is_file($path)) {
        json_out(['ok' => false, 'error' => 'That photo is gone.'], 404);
    }
    header('Content-Type: image/jpeg');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=86400');
    header('Content-Length: ' . (string) filesize($path));
    readfile($path);
    exit;
}

function handle_game(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $type = game_type((string) ($_GET['type'] ?? ''));
    [$state, $version] = load_game(db(), $bubble, $type);
    json_ok(['game' => present_game($type, $state, $version, (int) $user['id'])]);
}

function handle_games_list(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $uid = (int) $user['id'];
    $db = db();
    $rows = [];
    foreach (game_types_all() as $type) {
        $row = find_game($db, (int) $bubble['id'], $type);
        if (!$row) {
            continue;
        }
        $state = json_decode((string) $row['state_json'], true);
        if (!is_array($state)) {
            continue;
        }
        $version = (int) $row['version'];
        $view = present_game($type, $state, $version, $uid);
        $inProgress = game_in_progress($type, $state);
        $status = '';
        if (!empty($view['winner'])) {
            $status = 'Finished';
        } elseif ($inProgress) {
            $status = !empty($view['yourTurn']) ? 'Your turn' : 'In progress';
        }
        $rows[] = [
            'type' => $type,
            'inProgress' => $inProgress,
            'yourTurn' => !empty($view['yourTurn']),
            'status' => $status,
            'version' => $version,
        ];
    }
    json_ok(['games' => $rows]);
}

function handle_game_move(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $type = game_type((string) ($data['type'] ?? ''));
    $db = db();
    $db->exec('BEGIN IMMEDIATE');
    $open = true;
    try {
        [$state, $version, $id] = load_game($db, $bubble, $type);
        if ((int) ($data['version'] ?? -1) !== $version) {
            throw new UserError('Your partner just moved. Have another look.');
        }
        if (($data['action'] ?? '') === 'resign') {
            $state = game_resign($type, $state, (int) $user['id']);
        } elseif ($type === 'tictactoe') {
            $state = ttt_apply($state, (int) $user['id'], (int) ($data['index'] ?? -1));
        } elseif ($type === 'checkers') {
            $from = $data['from'] ?? null;
            $to = $data['to'] ?? null;
            if (!is_array($from) || !is_array($to) || count($from) < 2 || count($to) < 2) {
                throw new UserError('That move is not allowed.');
            }
            $state = checkers_apply($state, (int) $user['id'], (int) $from[0], (int) $from[1], (int) $to[0], (int) $to[1]);
        } elseif ($type === 'solitaire') {
            $state = sol_apply($state, (int) $user['id'], $data);
        } elseif ($type === 'kahoot') {
            $state = kahoot_apply($state, (int) $user['id'], $data);
        } elseif ($type === 'connect4') {
            $state = c4_apply($state, (int) $user['id'], (int) ($data['col'] ?? -1));
        } elseif ($type === 'memory') {
            $state = memory_apply($state, (int) $user['id'], (int) ($data['index'] ?? -1));
        } elseif ($type === 'hangman') {
            $state = hangman_apply($state, (int) $user['id'], $data);
        } else {
            throw new UserError('Unknown game.');
        }
        $stmt = $db->prepare('UPDATE games SET state_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?');
        $stmt->execute([
            json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            gmdate('c'),
            $id,
            $version,
        ]);
        if ($stmt->rowCount() !== 1) {
            throw new UserError('Your partner just moved. Have another look.');
        }
        $db->exec('COMMIT');
        $open = false;
        $version++;
    } catch (Throwable $e) {
        if ($open) {
            try {
                $db->exec('ROLLBACK');
            } catch (Throwable) {
            }
        }
        throw $e;
    }
    json_ok(['game' => present_game($type, $state, $version, (int) $user['id'])]);
}

function handle_game_reset(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $type = game_type((string) (read_json()['type'] ?? ''));
    $db = db();
    $db->exec('BEGIN IMMEDIATE');
    $open = true;
    try {
        [$state, $version, $id] = load_game($db, $bubble, $type);
        $state = game_fresh_state($type, $state, $bubble);
        $stmt = $db->prepare('UPDATE games SET state_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?');
        $stmt->execute([
            json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            gmdate('c'),
            $id,
            $version,
        ]);
        if ($stmt->rowCount() !== 1) {
            throw new UserError('The board changed. Try reset again.');
        }
        $db->exec('COMMIT');
        $open = false;
        $version++;
    } catch (Throwable $e) {
        if ($open) {
            try {
                $db->exec('ROLLBACK');
            } catch (Throwable) {
            }
        }
        throw $e;
    }
    json_ok(['game' => present_game($type, $state, $version, (int) $user['id'])]);
}

function handle_watch_comments(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $videoId = trim((string) ($_GET['video'] ?? ''));
    if ($videoId === '' || !preg_match('/^[A-Za-z0-9_-]{11}$/', $videoId)) {
        throw new UserError('Choose a video first.');
    }
    $since = (int) ($_GET['since'] ?? 0);
    $db = db();
    $bid = (int) $bubble['id'];
    if ($since > 0) {
        $stmt = $db->prepare('SELECT * FROM watch_comments WHERE bubble_id = ? AND video_id = ? AND id > ? ORDER BY id ASC LIMIT 100');
        $stmt->execute([$bid, $videoId, $since]);
        $rows = $stmt->fetchAll();
    } else {
        $stmt = $db->prepare('SELECT * FROM (SELECT * FROM watch_comments WHERE bubble_id = ? AND video_id = ? ORDER BY id DESC LIMIT 80) ORDER BY id ASC');
        $stmt->execute([$bid, $videoId]);
        $rows = $stmt->fetchAll();
    }
    json_ok(['comments' => array_map('watch_comment_public', $rows)]);
}

function handle_watch_comment(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $videoId = trim((string) ($data['videoId'] ?? ''));
    if ($videoId === '' || !preg_match('/^[A-Za-z0-9_-]{11}$/', $videoId)) {
        throw new UserError('Choose a video first.');
    }
    $body = clean_block((string) ($data['body'] ?? ''), 280, 'Write a comment first.');
    $now = gmdate('c');
    $db = db();
    $db->prepare('INSERT INTO watch_comments (bubble_id, video_id, sender_id, body, created_at) VALUES (?,?,?,?,?)')
        ->execute([(int) $bubble['id'], $videoId, (int) $user['id'], $body, $now]);
    $id = (int) $db->lastInsertId();
    json_ok(['comment' => watch_comment_public([
        'id' => $id,
        'bubble_id' => (int) $bubble['id'],
        'video_id' => $videoId,
        'sender_id' => (int) $user['id'],
        'body' => $body,
        'created_at' => $now,
    ])]);
}

function watch_comment_public(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'videoId' => (string) $row['video_id'],
        'senderId' => (int) $row['sender_id'],
        'body' => $row['body'],
        'createdAt' => $row['created_at'],
    ];
}

function handle_game_comments(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $type = game_type((string) ($_GET['type'] ?? ''));
    $since = (int) ($_GET['since'] ?? 0);
    $db = db();
    $bid = (int) $bubble['id'];
    if ($since > 0) {
        $stmt = $db->prepare('SELECT * FROM game_comments WHERE bubble_id = ? AND game_type = ? AND id > ? ORDER BY id ASC LIMIT 100');
        $stmt->execute([$bid, $type, $since]);
        $rows = $stmt->fetchAll();
    } else {
        $stmt = $db->prepare('SELECT * FROM (SELECT * FROM game_comments WHERE bubble_id = ? AND game_type = ? ORDER BY id DESC LIMIT 80) ORDER BY id ASC');
        $stmt->execute([$bid, $type]);
        $rows = $stmt->fetchAll();
    }
    json_ok(['comments' => array_map('game_comment_public', $rows)]);
}

function handle_game_comment(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $type = game_type((string) ($data['gameType'] ?? ''));
    $body = clean_block((string) ($data['body'] ?? ''), 280, 'Write a message first.');
    $now = gmdate('c');
    $db = db();
    $db->prepare('INSERT INTO game_comments (bubble_id, game_type, sender_id, body, created_at) VALUES (?,?,?,?,?)')
        ->execute([(int) $bubble['id'], $type, (int) $user['id'], $body, $now]);
    $id = (int) $db->lastInsertId();
    json_ok(['comment' => game_comment_public([
        'id' => $id,
        'bubble_id' => (int) $bubble['id'],
        'game_type' => $type,
        'sender_id' => (int) $user['id'],
        'body' => $body,
        'created_at' => $now,
    ])]);
}

function game_comment_public(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'gameType' => (string) $row['game_type'],
        'senderId' => (int) $row['sender_id'],
        'body' => $row['body'],
        'createdAt' => $row['created_at'],
    ];
}

function handle_watch(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $db = db();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        require_mutation();
        $data = read_json();
        $videoId = trim((string) ($data['videoId'] ?? ''));
        if ($videoId !== '' && !preg_match('/^[A-Za-z0-9_-]{11}$/', $videoId)) {
            throw new UserError('That does not look like a YouTube link.');
        }
        $position = (float) ($data['position'] ?? 0);
        if ($position < 0 || $position > 60 * 60 * 24) {
            $position = 0;
        }
        $playing = !empty($data['playing']) ? 1 : 0;
        if ($videoId === '') {
            $playing = 0;
            $position = 0;
        }
        $now = sprintf('%.6F', microtime(true));
        $db->prepare('INSERT INTO watch_state (bubble_id, video_id, position, playing, updated_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(bubble_id) DO UPDATE SET video_id = excluded.video_id, position = excluded.position, playing = excluded.playing, updated_by = excluded.updated_by, updated_at = excluded.updated_at')
            ->execute([(int) $bubble['id'], $videoId !== '' ? $videoId : null, $position, $playing, (int) $user['id'], $now]);
    }
    json_ok([
        'watch' => watch_public(watch_row($db, (int) $bubble['id'])),
        'serverNow' => microtime(true),
    ]);
}

function handle_activity(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $key = activity_key((string) ($_GET['key'] ?? ''));
    [$state, $version] = activity_load(db(), $bubble, $key, (int) $user['id']);
    json_ok(['activity' => present_activity($key, $state, $version, (int) $user['id'], $bubble)]);
}

function handle_activity_action(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $key = activity_key((string) ($data['key'] ?? ''));
    $db = db();
    $db->exec('BEGIN IMMEDIATE');
    $open = true;
    try {
        $row = activity_row($db, (int) $bubble['id'], $key);
        if (!$row) {
            activity_load($db, $bubble, $key, (int) $user['id']);
            $row = activity_row($db, (int) $bubble['id'], $key);
        }
        $state = json_decode((string) $row['state_json'], true);
        if (!is_array($state)) {
            $state = activity_fresh_state($key, $bubble, (int) $user['id']);
        }
        $state = activity_roll_day($key, $state, $bubble);
        $version = (int) $row['version'];
        if ((int) ($data['version'] ?? -1) !== $version) {
            throw new UserError('Your partner just updated this. Refresh and try again.');
        }
        $state = activity_apply($key, $state, (int) $user['id'], $bubble, $data);
        $version = activity_save($db, (int) $row['id'], $state, $version);
        $db->exec('COMMIT');
        $open = false;
    } catch (Throwable $e) {
        if ($open) {
            try {
                $db->exec('ROLLBACK');
            } catch (Throwable) {
            }
        }
        throw $e;
    }
    json_ok(['activity' => present_activity($key, $state, $version, (int) $user['id'], $bubble)]);
}

function handle_activity_comments(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $key = activity_key((string) ($_GET['key'] ?? ''));
    $db = db();
    $bid = (int) $bubble['id'];
    $since = (int) ($_GET['since'] ?? 0);
    if ($since > 0) {
        $stmt = $db->prepare('SELECT * FROM activity_comments WHERE bubble_id = ? AND activity_key = ? AND id > ? ORDER BY id ASC LIMIT 100');
        $stmt->execute([$bid, $key, $since]);
    } else {
        $stmt = $db->prepare('SELECT * FROM (SELECT * FROM activity_comments WHERE bubble_id = ? AND activity_key = ? ORDER BY id DESC LIMIT 80) ORDER BY id ASC');
        $stmt->execute([$bid, $key]);
    }
    $rows = $stmt->fetchAll();
    json_ok(['comments' => array_map('activity_comment_public', $rows)]);
}

function activity_comment_public(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'senderId' => (int) $row['sender_id'],
        'body' => $row['body'],
        'createdAt' => $row['created_at'],
    ];
}

function handle_activity_comment(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $key = activity_key((string) ($data['key'] ?? ''));
    $body = clean_block((string) ($data['body'] ?? ''), 500, 'Say something first.');
    $db = db();
    $now = gmdate('c');
    $db->prepare('INSERT INTO activity_comments (bubble_id, activity_key, sender_id, body, created_at) VALUES (?,?,?,?,?)')
        ->execute([(int) $bubble['id'], $key, (int) $user['id'], $body, $now]);
    json_ok(['comment' => activity_comment_public([
        'id' => (int) $db->lastInsertId(),
        'sender_id' => (int) $user['id'],
        'body' => $body,
        'created_at' => $now,
    ])]);
}

function handle_activity_seen(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $data = read_json();
    $key = activity_key((string) ($data['key'] ?? ''));
    $db = db();
    $bid = (int) $bubble['id'];
    $uid = (int) $user['id'];
    $row = activity_row($db, $bid, $key);
    $version = $row ? (int) $row['version'] : 0;
    activity_mark_read($db, $uid, $bid, $key, $version);
    activity_comment_mark_read($db, $uid, $bid, $key);
    json_ok(['badges' => bubble_badges($db, $uid, $bid)]);
}

function handle_search(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $db = db();
    $bid = (int) $bubble['id'];
    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q === '' || mb_strlen($q) < 2) {
        json_ok(['results' => []]);
    }
    $q = preg_replace('/[%_]/', '', $q);
    $like = '%' . $q . '%';
    $results = [];
    $stmt = $db->prepare('SELECT id, body FROM messages WHERE bubble_id = ? AND body LIKE ? ORDER BY id DESC LIMIT 15');
    $stmt->execute([$bid, $like]);
    foreach ($stmt->fetchAll() as $row) {
        $results[] = ['type' => 'chat', 'id' => (int) $row['id'], 'label' => mb_substr((string) $row['body'], 0, 80), 'route' => 'chat'];
    }
    $stmt = $db->prepare('SELECT id, content FROM notes WHERE bubble_id = ? AND content LIKE ? ORDER BY id DESC LIMIT 10');
    $stmt->execute([$bid, $like]);
    foreach ($stmt->fetchAll() as $row) {
        $results[] = ['type' => 'note', 'id' => (int) $row['id'], 'label' => mb_substr((string) $row['content'], 0, 80), 'route' => 'notes'];
    }
    $stmt = $db->prepare('SELECT id, caption FROM moments WHERE bubble_id = ? AND caption LIKE ? ORDER BY id DESC LIMIT 10');
    $stmt->execute([$bid, $like]);
    foreach ($stmt->fetchAll() as $row) {
        $results[] = ['type' => 'moment', 'id' => (int) $row['id'], 'label' => mb_substr((string) $row['caption'], 0, 80) ?: 'Photo', 'route' => 'moments'];
    }
    json_ok(['results' => $results]);
}

function handle_jar_voice(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $file = $_FILES['audio'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new UserError('Choose a short voice note to upload.');
    }
    if (($file['size'] ?? 0) > 2_000_000) {
        throw new UserError('Keep voice notes under 2 MB.');
    }
    $type = (string) ($file['type'] ?? '');
    $allowed = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/webm'];
    if (!in_array($type, $allowed, true)) {
        throw new UserError('Use a common audio format (webm, ogg, mp3).');
    }
    $dir = storage_dir() . '/jar/' . (int) $bubble['id'];
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new UserError('Could not save that note.');
    }
    $name = 'v' . (int) $user['id'] . '_' . bin2hex(random_bytes(6)) . '.webm';
    $dest = $dir . '/' . $name;
    if (!move_uploaded_file((string) $file['tmp_name'], $dest)) {
        throw new UserError('Could not save that note.');
    }
    json_ok(['voiceFile' => $name]);
}

function handle_jar_audio(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $name = (string) ($_GET['file'] ?? '');
    $path = jar_voice_path((int) $bubble['id'], $name);
    if (!$path) {
        throw new UserError('That voice note is not here.', 404);
    }
    header('Content-Type: audio/webm');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=3600');
    header('Content-Length: ' . (string) filesize($path));
    readfile($path);
    exit;
}

function jar_voice_path(int $bubbleId, string $name): ?string
{
    if (!preg_match('/^v\d+_[a-f0-9]+\.webm$/', $name)) {
        return null;
    }
    $path = storage_dir() . '/jar/' . $bubbleId . '/' . $name;
    return is_file($path) ? $path : null;
}

function handle_timeline_feed(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $db = db();
    $bid = (int) $bubble['id'];
    [$state] = activity_load($db, $bubble, 'timeline', (int) $user['id']);
    $items = [];
    foreach ($state['milestones'] ?? [] as $m) {
        $items[] = [
            'kind' => 'milestone',
            'date' => $m['date'],
            'title' => $m['title'],
            'id' => 'm-' . $m['date'] . '-' . md5((string) $m['title']),
        ];
    }
    $stmt = $db->prepare('SELECT * FROM moments WHERE bubble_id = ? ORDER BY created_at DESC LIMIT 40');
    $stmt->execute([$bid]);
    foreach ($stmt->fetchAll() as $row) {
        $items[] = [
            'kind' => 'moment',
            'date' => substr((string) $row['created_at'], 0, 10),
            'title' => $row['caption'] !== '' ? $row['caption'] : 'A shared moment',
            'id' => (int) $row['id'],
            'authorId' => (int) $row['author_id'],
        ];
    }
    $stmt = $db->prepare('SELECT * FROM notes WHERE bubble_id = ? ORDER BY created_at DESC LIMIT 20');
    $stmt->execute([$bid]);
    foreach ($stmt->fetchAll() as $row) {
        $items[] = [
            'kind' => 'note',
            'date' => substr((string) $row['created_at'], 0, 10),
            'title' => mb_substr((string) $row['content'], 0, 80),
            'id' => (int) $row['id'],
        ];
    }
    usort($items, static fn ($a, $b) => strcmp($b['date'], $a['date']));
    $today = gmdate('m-d');
    $onThisDay = array_values(array_filter($items, static fn ($it) => substr($it['date'], 5) === $today));
    json_ok(['items' => $items, 'onThisDay' => $onThisDay, 'milestones' => $state['milestones'] ?? []]);
}

function handle_presence(): void
{
    $user = require_user();
    $bubble = require_active_bubble($user);
    $db = db();
    $bid = (int) $bubble['id'];
    $uid = (int) $user['id'];
    $partnerId = (int) $bubble['user_a_id'] === $uid ? (int) $bubble['user_b_id'] : (int) $bubble['user_a_id'];
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        require_mutation();
        $data = read_json();
        $typingUntil = null;
        if (!empty($data['typing'])) {
            $typingUntil = microtime(true) + 5.0;
        }
        presence_touch($db, $bid, $uid, $typingUntil);
        json_ok();
    }
    presence_touch($db, $bid, $uid);
    $partner = presence_partner($db, $bid, $partnerId);
    json_ok([
        'partnerOnline' => $partner['online'],
        'partnerTyping' => $partner['typing'],
        'serverNow' => microtime(true),
    ]);
}

function handle_bubble_meta(): void
{
    require_mutation();
    $user = require_user();
    $bubble = require_active_bubble($user);
    $db = db();
    $data = read_json();
    $next = isset($data['nextVisitAt']) ? trim((string) $data['nextVisitAt']) : null;
    if ($next === '' || $next === null) {
        $db->prepare('UPDATE bubbles SET next_visit_at = NULL, updated_at = ? WHERE id = ?')
            ->execute([gmdate('c'), (int) $bubble['id']]);
        json_ok(['bubble' => bubble_public($db, bubble_for_member($db, (int) $user['id'], (int) $bubble['id']), (int) $user['id'])]);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $next)) {
        throw new UserError('Use a date like 2026-12-25.');
    }
    $db->prepare('UPDATE bubbles SET next_visit_at = ?, updated_at = ? WHERE id = ?')
        ->execute([$next, gmdate('c'), (int) $bubble['id']]);
    $fresh = bubble_for_member($db, (int) $user['id'], (int) $bubble['id']);
    json_ok(['bubble' => bubble_public($db, $fresh, (int) $user['id'])]);
}

function handle_signal(): void
{
    $user = require_user();
    $db = db();
    $uid = (int) $user['id'];
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        require_mutation();
        $bubble = require_active_bubble($user);
        $bid = (int) $bubble['id'];
        $data = read_json();
        $kind = (string) ($data['kind'] ?? '');
        if (!in_array($kind, ['offer', 'answer', 'ice', 'hangup', 'pulse'], true)) {
            throw new UserError('Unknown signal.');
        }
        if ($kind === 'pulse') {
            $db->prepare('INSERT INTO signals (bubble_id, from_user_id, kind, payload, created_at) VALUES (?,?,?,?,?)')
                ->execute([$bid, $uid, 'pulse', '{}', gmdate('c')]);
            json_ok(['id' => (int) $db->lastInsertId()]);
        }
        $payload = $data['payload'] ?? [];
        if (!is_array($payload)) {
            throw new UserError('Bad call data.');
        }
        $raw = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($raw) > 100000) {
            throw new UserError('That call data is too large.');
        }
        $db->prepare('INSERT INTO signals (bubble_id, from_user_id, kind, payload, created_at) VALUES (?,?,?,?,?)')
            ->execute([$bid, $uid, $kind, $raw, gmdate('c')]);
        $newId = (int) $db->lastInsertId();
        $db->prepare('DELETE FROM signals WHERE bubble_id = ? AND id < ?')->execute([$bid, max(0, $newId - 300)]);
        json_ok(['id' => $newId]);
    }
    $maxStmt = $db->prepare('SELECT COALESCE(MAX(s.id), 0) AS max_id FROM signals s JOIN bubbles b ON b.id = s.bubble_id WHERE b.status = \'active\' AND (b.user_a_id = ? OR b.user_b_id = ?)');
    $maxStmt->execute([$uid, $uid]);
    $latest = (int) $maxStmt->fetch()['max_id'];
    if (isset($_GET['baseline'])) {
        json_ok(['signals' => [], 'latest' => $latest]);
    }
    $since = (int) ($_GET['since'] ?? 0);
    $stmt = $db->prepare('SELECT s.* FROM signals s JOIN bubbles b ON b.id = s.bubble_id WHERE s.id > ? AND s.from_user_id != ? AND b.status = \'active\' AND (b.user_a_id = ? OR b.user_b_id = ?) ORDER BY s.id ASC LIMIT 50');
    $stmt->execute([$since, $uid, $uid, $uid]);
    $signals = [];
    foreach ($stmt->fetchAll() as $row) {
        $signals[] = [
            'id' => (int) $row['id'],
            'bubbleId' => (int) $row['bubble_id'],
            'from' => (int) $row['from_user_id'],
            'kind' => $row['kind'],
            'payload' => json_decode((string) $row['payload'], true) ?: [],
        ];
    }
    json_ok(['signals' => $signals, 'latest' => $latest]);
}

function game_type(string $type): string
{
    $allowed = ['tictactoe', 'checkers', 'solitaire', 'kahoot', 'connect4', 'memory', 'hangman'];
    if (!in_array($type, $allowed, true)) {
        throw new UserError('Pick a game from the list.');
    }
    return $type;
}

function game_fresh_state(string $type, array $state, array $bubble): array
{
    $a = (int) $bubble['user_a_id'];
    $b = (int) $bubble['user_b_id'];
    return match ($type) {
        'tictactoe' => ttt_new((int) $state['xUser'], (int) $state['oUser']),
        'checkers' => checkers_new((int) $state['redUser'], (int) $state['blackUser']),
        'solitaire' => solitaire_new($a, $b),
        'kahoot' => kahoot_new($a, $b),
        'connect4' => c4_new($a, $b),
        'memory' => memory_new($a, $b),
        'hangman' => hangman_new((int) ($state['setter'] ?? $a), (int) ($state['guesser'] ?? $b)),
        default => throw new UserError('Unknown game.'),
    };
}

function find_game(PDO $db, int $bubbleId, string $type): ?array
{
    $stmt = $db->prepare('SELECT * FROM games WHERE bubble_id = ? AND type = ?');
    $stmt->execute([$bubbleId, $type]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function load_game(PDO $db, array $bubble, string $type): array
{
    $bubbleId = (int) $bubble['id'];
    $row = find_game($db, $bubbleId, $type);
    if (!$row) {
        $state = match ($type) {
            'tictactoe' => ttt_new((int) $bubble['user_a_id'], (int) $bubble['user_b_id']),
            'checkers' => checkers_new((int) $bubble['user_a_id'], (int) $bubble['user_b_id']),
            'solitaire' => solitaire_new((int) $bubble['user_a_id'], (int) $bubble['user_b_id']),
            'kahoot' => kahoot_new((int) $bubble['user_a_id'], (int) $bubble['user_b_id']),
            'connect4' => c4_new((int) $bubble['user_a_id'], (int) $bubble['user_b_id']),
            'memory' => memory_new((int) $bubble['user_a_id'], (int) $bubble['user_b_id']),
            'hangman' => hangman_new((int) $bubble['user_a_id'], (int) $bubble['user_b_id']),
            default => throw new UserError('Unknown game.'),
        };
        try {
            $db->prepare('INSERT INTO games (bubble_id, type, state_json, version, updated_at) VALUES (?,?,?,?,?)')
                ->execute([$bubbleId, $type, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 1, gmdate('c')]);
        } catch (PDOException) {
        }
        $row = find_game($db, $bubbleId, $type);
    }
    if (!$row) {
        throw new RuntimeException('Game missing');
    }
    return [json_decode((string) $row['state_json'], true), (int) $row['version'], (int) $row['id']];
}

function present_game(string $type, array $state, int $version, int $uid): array
{
    if ($type === 'solitaire') {
        $player = sol_player($state, $uid);
        return [
            'type' => 'solitaire',
            'version' => $version,
            'you' => sol_present_player($player),
            'partner' => sol_partner_summary($state, $uid),
        ];
    }
    if ($type === 'kahoot') {
        return array_merge(kahoot_present($state, $uid), ['version' => $version]);
    }
    if ($type === 'connect4') {
        $you = ((int) $state['redUser'] === $uid) ? 'red' : 'black';
        $yourTurn = empty($state['winner']) && $state['turn'] === $you;
        return [
            'type' => 'connect4',
            'board' => $state['board'],
            'turn' => $state['turn'],
            'youAre' => $you,
            'yourTurn' => $yourTurn,
            'winner' => $state['winner'],
            'lastCol' => $state['lastCol'],
            'version' => $version,
        ];
    }
    if ($type === 'memory') {
        $yourTurn = empty($state['winner']) && (int) $state['turn'] === $uid;
        return [
            'type' => 'memory',
            'cards' => $state['cards'],
            'flipped' => $state['flipped'],
            'yourTurn' => $yourTurn,
            'winner' => $state['winner'],
            'scores' => $state['scores'],
            'version' => $version,
        ];
    }
    if ($type === 'hangman') {
        $youAre = (int) $state['setter'] === $uid ? 'setter' : 'guesser';
        return [
            'type' => 'hangman',
            'phase' => $state['phase'],
            'mask' => $state['mask'],
            'guessed' => $state['guessed'],
            'wrong' => (int) $state['wrong'],
            'winner' => $state['winner'],
            'youAre' => $youAre,
            'yourTurn' => ($state['phase'] === 'word' && $youAre === 'setter') || ($state['phase'] === 'guess' && $youAre === 'guesser' && empty($state['winner'])),
            'word' => !empty($state['winner']) ? $state['word'] : '',
            'version' => $version,
        ];
    }
    if ($type === 'tictactoe') {
        $you = ((int) $state['xUser'] === $uid) ? 'X' : 'O';
        $yourTurn = empty($state['winner']) && $state['turn'] === $you;
        return [
            'type' => 'tictactoe',
            'board' => array_values($state['board']),
            'turn' => $state['turn'],
            'youAre' => $you,
            'yourTurn' => $yourTurn,
            'winner' => $state['winner'],
            'legal' => $yourTurn ? ttt_legal($state) : [],
            'version' => $version,
            'lastMove' => $state['lastMove'],
        ];
    }
    $you = ((int) $state['redUser'] === $uid) ? 'red' : 'black';
    $yourTurn = empty($state['winner']) && $state['turn'] === $you;
    return [
        'type' => 'checkers',
        'board' => $state['board'],
        'turn' => $state['turn'],
        'youAre' => $you,
        'yourTurn' => $yourTurn,
        'winner' => $state['winner'],
        'mustFrom' => $state['mustFrom'],
        'legal' => $yourTurn ? checkers_legal($state) : [],
        'version' => $version,
        'lastMove' => $state['lastMove'],
    ];
}

function watch_row(PDO $db, int $bubbleId): array
{
    $stmt = $db->prepare('SELECT * FROM watch_state WHERE bubble_id = ?');
    $stmt->execute([$bubbleId]);
    $row = $stmt->fetch();
    if ($row) {
        return $row;
    }
    $db->prepare('INSERT INTO watch_state (bubble_id, video_id, position, playing, updated_by, updated_at) VALUES (?, NULL, 0, 0, NULL, ?)')
        ->execute([$bubbleId, sprintf('%.6F', microtime(true))]);
    $stmt->execute([$bubbleId]);
    return $stmt->fetch();
}

function watch_public(array $row): array
{
    return [
        'videoId' => $row['video_id'] ?: null,
        'position' => (float) $row['position'],
        'playing' => (bool) $row['playing'],
        'updatedBy' => $row['updated_by'] !== null ? (int) $row['updated_by'] : null,
        'updatedAt' => is_numeric($row['updated_at']) ? (float) $row['updated_at'] : (float) strtotime((string) $row['updated_at']),
    ];
}

function message_public(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'senderId' => (int) $row['sender_id'],
        'body' => $row['body'],
        'createdAt' => $row['created_at'],
    ];
}

function note_public(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'authorId' => (int) $row['author_id'],
        'content' => $row['content'],
        'color' => $row['color'],
        'createdAt' => $row['created_at'],
    ];
}

function moment_public(array $row, ?array $social = null): array
{
    $social ??= ['reactionCounts' => [], 'myReaction' => null, 'commentCount' => 0];
    return [
        'id' => (int) $row['id'],
        'authorId' => (int) $row['author_id'],
        'caption' => $row['caption'],
        'createdAt' => $row['created_at'],
        'reactionCounts' => $social['reactionCounts'] ?? [],
        'myReaction' => $social['myReaction'] ?? null,
        'commentCount' => (int) ($social['commentCount'] ?? 0),
    ];
}

function preview_message(PDO $db, int $bubbleId): ?array
{
    $stmt = $db->prepare('SELECT * FROM messages WHERE bubble_id = ? ORDER BY id DESC LIMIT 1');
    $stmt->execute([$bubbleId]);
    $row = $stmt->fetch();
    return $row ? message_public($row) : null;
}

function preview_note(PDO $db, int $bubbleId): ?array
{
    $stmt = $db->prepare('SELECT * FROM notes WHERE bubble_id = ? ORDER BY id DESC LIMIT 1');
    $stmt->execute([$bubbleId]);
    $row = $stmt->fetch();
    return $row ? note_public($row) : null;
}

function preview_moment(PDO $db, int $bubbleId): ?array
{
    $stmt = $db->prepare('SELECT id, author_id, caption, created_at FROM moments WHERE bubble_id = ? ORDER BY id DESC LIMIT 1');
    $stmt->execute([$bubbleId]);
    $row = $stmt->fetch();
    return $row ? moment_public($row) : null;
}

function save_upload_image(string $tmp, string $dest): void
{
    $info = @getimagesize($tmp);
    if (!$info) {
        throw new UserError('That file is not a photo.');
    }
    if (($info[0] * $info[1]) > 24000000) {
        throw new UserError('That photo is too large to process.');
    }
    $type = (int) $info[2];
    $src = match ($type) {
        IMAGETYPE_JPEG => imagecreatefromjpeg($tmp),
        IMAGETYPE_PNG => imagecreatefrompng($tmp),
        IMAGETYPE_GIF => imagecreatefromgif($tmp),
        IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? imagecreatefromwebp($tmp) : false,
        default => false,
    };
    if (!$src) {
        throw new UserError('Use a JPG, PNG, GIF, or WebP photo.');
    }
    $src = orient_image($src, $tmp, $type);
    $w = imagesx($src);
    $h = imagesy($src);
    $scale = min(1, 1600 / max($w, $h));
    $nw = max(1, (int) round($w * $scale));
    $nh = max(1, (int) round($h * $scale));
    $dst = imagecreatetruecolor($nw, $nh);
    $paper = imagecolorallocate($dst, 255, 250, 246);
    imagefilledrectangle($dst, 0, 0, $nw, $nh, $paper);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    if (!imagejpeg($dst, $dest, 86)) {
        imagedestroy($src);
        imagedestroy($dst);
        throw new UserError('Could not save that photo.');
    }
    imagedestroy($src);
    imagedestroy($dst);
}

function orient_image($img, string $tmp, int $type)
{
    if ($type !== IMAGETYPE_JPEG || !function_exists('exif_read_data')) {
        return $img;
    }
    $exif = @exif_read_data($tmp);
    $angle = match ((int) ($exif['Orientation'] ?? 1)) {
        3 => 180,
        6 => -90,
        8 => 90,
        default => 0,
    };
    if ($angle === 0) {
        return $img;
    }
    $rotated = imagerotate($img, $angle, 0);
    if ($rotated) {
        imagedestroy($img);
        return $rotated;
    }
    return $img;
}
