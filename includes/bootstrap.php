<?php
declare(strict_types=1);

class UserError extends RuntimeException
{
    public function __construct(string $message, public int $status = 400)
    {
        parent::__construct($message);
    }
}

ini_set('display_errors', '0');

set_exception_handler(static function (Throwable $e): void {
    if ($e instanceof UserError) {
        json_out(['ok' => false, 'error' => $e->getMessage()], $e->status);
    }
    $dir = dirname(__DIR__) . '/storage';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    @file_put_contents(
        $dir . '/error.log',
        gmdate('c') . ' ' . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n\n",
        FILE_APPEND
    );
    json_out(['ok' => false, 'error' => 'Something went wrong on our side.'], 500);
});

function json_out(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_ok(array $data = []): never
{
    json_out(['ok' => true] + $data);
}

function app_web_base(): string
{
    $dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    if ($dir === '/' || $dir === '.' || $dir === '') {
        return '/';
    }
    return rtrim($dir, '/') . '/';
}

function start_session(): void
{
    session_name('BUZZBUDS');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => app_web_base(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    $GLOBALS['BUZZ_UID'] = isset($_SESSION['uid']) ? (int) $_SESSION['uid'] : 0;
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        session_write_close();
    }
}

function enforce_session_epoch(): void
{
    $uid = session_uid();
    if ($uid <= 0) {
        return;
    }
    $reopen = session_status() !== PHP_SESSION_ACTIVE;
    if ($reopen) {
        session_start();
    }
    $epoch = (int) ($_SESSION['session_epoch'] ?? 0);
    $stmt = db()->prepare('SELECT session_epoch FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    $current = $row ? (int) ($row['session_epoch'] ?? 1) : 0;
    if ($epoch > 0 && $current > 0 && $epoch !== $current) {
        $GLOBALS['BUZZ_UID'] = 0;
        $_SESSION = [];
        session_write_close();
        return;
    }
    if ($reopen) {
        session_write_close();
    }
}

function session_uid(): int
{
    return (int) ($GLOBALS['BUZZ_UID'] ?? 0);
}

function set_uid(int $id): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
    $epoch = 1;
    try {
        $stmt = db()->prepare('SELECT session_epoch FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        $epoch = $row ? (int) ($row['session_epoch'] ?? 1) : 1;
    } catch (Throwable) {
        $epoch = 1;
    }
    $_SESSION['session_epoch'] = $epoch;
    $GLOBALS['BUZZ_UID'] = $id;
    session_write_close();
}

function clear_uid(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $_SESSION = [];
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
    session_destroy();
    $GLOBALS['BUZZ_UID'] = 0;
}

function storage_dir(): string
{
    $dir = dirname(__DIR__) . '/storage';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Storage is not writable.');
    }
    $moments = $dir . '/moments';
    if (!is_dir($moments)) {
        mkdir($moments, 0775, true);
    }
    return $dir;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . storage_dir() . '/buzzbuds.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 3000');
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bubbles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a_id INTEGER NOT NULL,
  user_b_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS moments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  caption TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS moment_reactions (
  moment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (moment_id, user_id)
);
CREATE TABLE IF NOT EXISTS moment_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  moment_id INTEGER NOT NULL,
  bubble_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moment_comments ON moment_comments(moment_id, id);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(bubble_id, type)
);
CREATE TABLE IF NOT EXISTS watch_state (
  bubble_id INTEGER PRIMARY KEY,
  video_id TEXT,
  position REAL NOT NULL DEFAULT 0,
  playing INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS watch_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  video_id TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watch_comments ON watch_comments(bubble_id, video_id, id);
CREATE TABLE IF NOT EXISTS game_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  game_type TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_game_comments ON game_comments(bubble_id, game_type, id);
CREATE TABLE IF NOT EXISTS bubble_reads (
  user_id INTEGER NOT NULL,
  bubble_id INTEGER NOT NULL,
  last_note_id INTEGER NOT NULL DEFAULT 0,
  last_message_id INTEGER NOT NULL DEFAULT 0,
  last_moment_id INTEGER NOT NULL DEFAULT 0,
  last_watch_comment_id INTEGER NOT NULL DEFAULT 0,
  last_watch_key TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, bubble_id)
);
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg ON messages(bubble_id, id);
CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(bubble_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_notes ON notes(bubble_id, id);
CREATE INDEX IF NOT EXISTS idx_moments ON moments(bubble_id, id);
CREATE INDEX IF NOT EXISTS idx_sig ON signals(bubble_id, id);
CREATE INDEX IF NOT EXISTS idx_bubble_a ON bubbles(user_a_id, status);
CREATE INDEX IF NOT EXISTS idx_bubble_b ON bubbles(user_b_id, status);
SQL);
    $names = [];
    foreach ($pdo->query('PRAGMA table_info(users)')->fetchAll() as $col) {
        $names[] = $col['name'];
    }
    if (!in_array('appearance', $names, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN appearance TEXT');
    }
    $readCols = [];
    foreach ($pdo->query('PRAGMA table_info(bubble_reads)')->fetchAll() as $col) {
        $readCols[] = $col['name'];
    }
    if ($readCols !== []) {
        if (!in_array('last_message_id', $readCols, true)) {
            $pdo->exec('ALTER TABLE bubble_reads ADD COLUMN last_message_id INTEGER NOT NULL DEFAULT 0');
        }
        if (!in_array('last_moment_id', $readCols, true)) {
            $pdo->exec('ALTER TABLE bubble_reads ADD COLUMN last_moment_id INTEGER NOT NULL DEFAULT 0');
        }
        if (!in_array('last_watch_comment_id', $readCols, true)) {
            $pdo->exec('ALTER TABLE bubble_reads ADD COLUMN last_watch_comment_id INTEGER NOT NULL DEFAULT 0');
        }
        if (!in_array('last_watch_key', $readCols, true)) {
            $pdo->exec("ALTER TABLE bubble_reads ADD COLUMN last_watch_key TEXT NOT NULL DEFAULT ''");
        }
    }
    $bubbleCols = [];
    foreach ($pdo->query('PRAGMA table_info(bubbles)')->fetchAll() as $col) {
        $bubbleCols[] = $col['name'];
    }
    if ($bubbleCols !== [] && !in_array('next_visit_at', $bubbleCols, true)) {
        $pdo->exec('ALTER TABLE bubbles ADD COLUMN next_visit_at TEXT');
    }
    $userCols = [];
    foreach ($pdo->query('PRAGMA table_info(users)')->fetchAll() as $col) {
        $userCols[] = $col['name'];
    }
    if ($userCols !== [] && !in_array('session_epoch', $userCols, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 1');
    }
    $msgCols = [];
    foreach ($pdo->query('PRAGMA table_info(messages)')->fetchAll() as $col) {
        $msgCols[] = $col['name'];
    }
    if ($msgCols !== [] && !in_array('client_id', $msgCols, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN client_id TEXT');
    }
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code_hash TEXT NOT NULL,
  token_hash TEXT,
  expires_at INTEGER NOT NULL,
  token_expires_at INTEGER,
  used INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, used, expires_at);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
SQL);
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS live_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_live_events ON live_events(bubble_id, id);
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  bubble_id INTEGER NOT NULL,
  p256dh TEXT,
  auth TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bubble_presence (
  bubble_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_seen REAL NOT NULL,
  typing_until REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (bubble_id, user_id)
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  activity_key TEXT NOT NULL,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(bubble_id, activity_key)
);
CREATE TABLE IF NOT EXISTS activity_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bubble_id INTEGER NOT NULL,
  activity_key TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_comments ON activity_comments(bubble_id, activity_key, id);
CREATE TABLE IF NOT EXISTS activity_reads (
  user_id INTEGER NOT NULL,
  bubble_id INTEGER NOT NULL,
  activity_key TEXT NOT NULL,
  last_version INTEGER NOT NULL DEFAULT 0,
  last_comment_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bubble_id, activity_key)
);
SQL);
}

function require_mutation(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        throw new UserError('That action needs a form submit.');
    }
    if (($_SERVER['HTTP_X_BUZZBUDS'] ?? '') !== '1') {
        throw new UserError('Blocked request.', 403);
    }
}

function read_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new UserError('Could not read that request.');
    }
    return $data;
}

function clean_name(string $name): string
{
    $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');
    if ($name === '' || mb_strlen($name) > 40) {
        throw new UserError('Use a name up to 40 characters.');
    }
    if (preg_match('/[<>]/', $name)) {
        throw new UserError('Please leave brackets out of your name.');
    }
    return $name;
}

function clean_username(string $username): string
{
    $username = strtolower(trim($username));
    $username = ltrim($username, '@');
    if (!preg_match('/^[a-z][a-z0-9_]{2,19}$/', $username)) {
        throw new UserError('Usernames are 3–20 characters, start with a letter, and use only letters, numbers, and underscores.');
    }
    return $username;
}

function clean_block(string $text, int $max, string $emptyMessage): string
{
    $text = str_replace("\r\n", "\n", trim($text));
    if ($text === '') {
        throw new UserError($emptyMessage);
    }
    if (mb_strlen($text) > $max) {
        throw new UserError('That is a little too long.');
    }
    return $text;
}

function make_username(PDO $db): string
{
    $a = ['honey', 'luna', 'maple', 'cocoa', 'amber', 'willow', 'pearl', 'clover', 'river', 'ember', 'daisy', 'cedar', 'velvet', 'sunny', 'misty', 'piper', 'marigold', 'hazel'];
    $b = ['bud', 'bloom', 'bee', 'glow', 'nest', 'spark', 'heart', 'wing', 'petal', 'dawn', 'song', 'flame', 'moss', 'cloud'];
    $check = $db->prepare('SELECT 1 FROM users WHERE username = ?');
    for ($i = 0; $i < 40; $i++) {
        $name = $a[random_int(0, count($a) - 1)] . $b[random_int(0, count($b) - 1)] . random_int(10, 99);
        $check->execute([$name]);
        if (!$check->fetch()) {
            return $name;
        }
    }
    return 'buzz' . bin2hex(random_bytes(3));
}

function user_by_id(PDO $db, int $id): ?array
{
    $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function appearance_normalize($data): array
{
    if (!is_array($data)) {
        $data = [];
    }
    $pick = function (string $key, array $allowed, string $fallback) use ($data): string {
        $value = isset($data[$key]) ? (string) $data[$key] : $fallback;
        return in_array($value, $allowed, true) ? $value : $fallback;
    };
    $hex = function (string $key) use ($data): string {
        $value = isset($data[$key]) ? strtolower(trim((string) $data[$key])) : '';
        return preg_match('/^#[0-9a-f]{6}$/', $value) ? $value : '';
    };
    return [
        'preset' => $pick('preset', ['ember', 'harbor', 'moss', 'dusk', 'ink', 'custom'], 'ember'),
        'mode' => $pick('mode', ['light', 'dark'], 'light'),
        'accent' => $hex('accent'),
        'bg' => $hex('bg'),
        'density' => $pick('density', ['cozy', 'compact'], 'cozy'),
        'nav' => $pick('nav', ['side', 'top'], 'side'),
        'home' => $pick('home', ['grid', 'stack'], 'grid'),
        'corners' => $pick('corners', ['round', 'soft', 'sharp'], 'round'),
        'span' => $pick('span', ['focus', 'wide'], 'focus'),
        'notes' => $pick('notes', ['tilted', 'flat'], 'tilted'),
        'animations' => $pick('animations', ['on', 'off'], 'on'),
    ];
}

function appearance_public(?string $json): array
{
    $data = json_decode($json ?? '', true);
    return appearance_normalize(is_array($data) ? $data : []);
}

function bubble_read_row(PDO $db, int $uid, int $bubbleId): array
{
    $stmt = $db->prepare('SELECT * FROM bubble_reads WHERE user_id = ? AND bubble_id = ?');
    $stmt->execute([$uid, $bubbleId]);
    $row = $stmt->fetch();
    if ($row) {
        return $row;
    }
    $db->prepare('INSERT INTO bubble_reads (user_id, bubble_id, last_note_id, last_message_id, last_moment_id, last_watch_comment_id, last_watch_key) VALUES (?,?,0,0,0,0,\'\')')
        ->execute([$uid, $bubbleId]);
    $stmt->execute([$uid, $bubbleId]);
    $row = $stmt->fetch();
    return $row ?: [
        'user_id' => $uid,
        'bubble_id' => $bubbleId,
        'last_note_id' => 0,
        'last_message_id' => 0,
        'last_moment_id' => 0,
        'last_watch_comment_id' => 0,
        'last_watch_key' => '',
    ];
}

function bubble_mark_max_id(PDO $db, int $uid, int $bubbleId, string $table, string $column): void
{
    bubble_read_row($db, $uid, $bubbleId);
    $allowed = ['last_note_id' => 'notes', 'last_message_id' => 'messages', 'last_moment_id' => 'moments'];
    if (!isset($allowed[$column])) {
        return;
    }
    $tbl = $allowed[$column];
    $max = $db->prepare("SELECT COALESCE(MAX(id), 0) FROM {$tbl} WHERE bubble_id = ?");
    $max->execute([$bubbleId]);
    $last = (int) $max->fetchColumn();
    $db->prepare("UPDATE bubble_reads SET {$column} = ? WHERE user_id = ? AND bubble_id = ?")
        ->execute([$last, $uid, $bubbleId]);
}

function bubble_note_mark_read(PDO $db, int $uid, int $bubbleId): void
{
    bubble_mark_max_id($db, $uid, $bubbleId, 'notes', 'last_note_id');
}

function bubble_chat_mark_read(PDO $db, int $uid, int $bubbleId): void
{
    bubble_mark_max_id($db, $uid, $bubbleId, 'messages', 'last_message_id');
}

function bubble_moment_mark_read(PDO $db, int $uid, int $bubbleId): void
{
    bubble_mark_max_id($db, $uid, $bubbleId, 'moments', 'last_moment_id');
}

function bubble_watch_mark_read(PDO $db, int $uid, int $bubbleId): void
{
    bubble_read_row($db, $uid, $bubbleId);
    $max = $db->prepare('SELECT COALESCE(MAX(id), 0) FROM watch_comments WHERE bubble_id = ?');
    $max->execute([$bubbleId]);
    $last = (int) $max->fetchColumn();
    $watchStmt = $db->prepare('SELECT video_id, updated_at, updated_by FROM watch_state WHERE bubble_id = ?');
    $watchStmt->execute([$bubbleId]);
    $watch = $watchStmt->fetch() ?: [];
    $key = '';
    if (!empty($watch['video_id'])) {
        $key = (string) $watch['video_id'] . ':' . (string) $watch['updated_at'];
    }
    $db->prepare('UPDATE bubble_reads SET last_watch_comment_id = ?, last_watch_key = ? WHERE user_id = ? AND bubble_id = ?')
        ->execute([$last, $key, $uid, $bubbleId]);
}

function user_public(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'email' => $user['email'],
        'displayName' => $user['display_name'],
        'username' => $user['username'],
        'createdAt' => $user['created_at'],
        'appearance' => appearance_public($user['appearance'] ?? null),
    ];
}

function current_user(): ?array
{
    $id = session_uid();
    if ($id <= 0) {
        return null;
    }
    $user = user_by_id(db(), $id);
    if (!$user) {
        $GLOBALS['BUZZ_UID'] = 0;
        return null;
    }
    return $user;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        throw new UserError('Please sign in again.', 401);
    }
    return $user;
}

function links_for(PDO $db, int $uid): array
{
    $stmt = $db->prepare("SELECT * FROM bubbles WHERE status IN ('pending', 'active') AND (user_a_id = ? OR user_b_id = ?) ORDER BY updated_at DESC, id DESC");
    $stmt->execute([$uid, $uid]);
    return $stmt->fetchAll();
}

function pair_link(PDO $db, int $a, int $b): ?array
{
    $stmt = $db->prepare("SELECT * FROM bubbles WHERE status IN ('pending', 'active') AND ((user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?)) ORDER BY id DESC LIMIT 1");
    $stmt->execute([$a, $b, $b, $a]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function bubble_for_member(PDO $db, int $uid, int $id): ?array
{
    if ($id <= 0) {
        return null;
    }
    $stmt = $db->prepare('SELECT * FROM bubbles WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)');
    $stmt->execute([$id, $uid, $uid]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function requested_bubble_id(): int
{
    $header = (int) ($_SERVER['HTTP_X_BUBBLE_ID'] ?? 0);
    if ($header > 0) {
        return $header;
    }
    return (int) ($_GET['bubble'] ?? 0);
}

function bubble_days_together(array $bubble): int
{
    if (($bubble['status'] ?? '') !== 'active') {
        return 0;
    }
    $start = strtotime((string) ($bubble['created_at'] ?? ''));
    if ($start === false) {
        return 0;
    }
    return max(0, (int) floor((time() - $start) / 86400));
}

function bubble_public(PDO $db, array $bubble, int $uid): array
{
    $partnerId = (int) $bubble['user_a_id'] === $uid ? (int) $bubble['user_b_id'] : (int) $bubble['user_a_id'];
    $partner = user_by_id($db, $partnerId);
    $nextVisit = isset($bubble['next_visit_at']) && $bubble['next_visit_at'] !== null && $bubble['next_visit_at'] !== ''
        ? (string) $bubble['next_visit_at']
        : null;
    return [
        'id' => (int) $bubble['id'],
        'status' => $bubble['status'],
        'incoming' => $bubble['status'] === 'pending' && (int) $bubble['user_b_id'] === $uid,
        'createdAt' => $bubble['created_at'],
        'daysTogether' => bubble_days_together($bubble),
        'nextVisitAt' => $nextVisit,
        'ambienceHue' => ((int) $bubble['id'] * 47) % 360,
        'partner' => [
            'id' => (int) $partner['id'],
            'displayName' => $partner['display_name'],
            'username' => $partner['username'],
        ],
    ];
}

function presence_touch(PDO $db, int $bubbleId, int $uid, ?float $typingUntil = null): void
{
    $now = microtime(true);
    $stmt = $db->prepare('SELECT typing_until FROM bubble_presence WHERE bubble_id = ? AND user_id = ?');
    $stmt->execute([$bubbleId, $uid]);
    $row = $stmt->fetch();
    $typing = $typingUntil ?? ($row ? (float) $row['typing_until'] : 0.0);
    $db->prepare('INSERT INTO bubble_presence (bubble_id, user_id, last_seen, typing_until) VALUES (?,?,?,?)
        ON CONFLICT(bubble_id, user_id) DO UPDATE SET last_seen = excluded.last_seen, typing_until = excluded.typing_until')
        ->execute([$bubbleId, $uid, $now, $typing]);
}

function presence_partner(PDO $db, int $bubbleId, int $partnerId): array
{
    $stmt = $db->prepare('SELECT last_seen, typing_until FROM bubble_presence WHERE bubble_id = ? AND user_id = ?');
    $stmt->execute([$bubbleId, $partnerId]);
    $row = $stmt->fetch();
    $now = microtime(true);
    if (!$row) {
        return ['online' => false, 'typing' => false];
    }
    $last = (float) $row['last_seen'];
    $typing = (float) $row['typing_until'];
    return [
        'online' => ($now - $last) < 28.0,
        'typing' => $typing > $now,
    ];
}

function latency_log(string $line): void
{
    $dir = dirname(__DIR__) . '/storage';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    @file_put_contents($dir . '/latency.log', gmdate('c') . ' ' . $line . "\n", FILE_APPEND);
}

function live_push(PDO $db, int $bubbleId, string $kind, array $payload): int
{
    $ms = (int) round(microtime(true) * 1000);
    $db->prepare('INSERT INTO live_events (bubble_id, kind, payload, created_at, created_ms) VALUES (?,?,?,?,?)')
        ->execute([$bubbleId, $kind, json_encode($payload, JSON_UNESCAPED_UNICODE), gmdate('c'), $ms]);
    $id = (int) $db->lastInsertId();
    $db->prepare('DELETE FROM live_events WHERE bubble_id = ? AND id < ?')->execute([$bubbleId, max(0, $id - 500)]);
    $t0 = isset($payload['t0']) ? (int) $payload['t0'] : 0;
    if ($t0 > 0) {
        latency_log($kind . ' saved_broadcast_ms=' . max(0, $ms - $t0) . ' bubble=' . $bubbleId);
    }
    return $id;
}

function live_events_since(PDO $db, int $bubbleId, int $after, int $limit = 80): array
{
    $limit = max(1, min(100, $limit));
    $stmt = $db->prepare("SELECT * FROM live_events WHERE bubble_id = ? AND id > ? ORDER BY id ASC LIMIT {$limit}");
    $stmt->execute([$bubbleId, $after]);
    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $out[] = [
            'id' => (int) $row['id'],
            'kind' => $row['kind'],
            'payload' => json_decode((string) $row['payload'], true) ?: [],
            'createdMs' => (int) $row['created_ms'],
        ];
    }
    return $out;
}

function require_active_bubble(array $user): array
{
    $bubble = bubble_for_member(db(), (int) $user['id'], requested_bubble_id());
    if (!$bubble || $bubble['status'] !== 'active') {
        throw new UserError('Choose a bubble first.');
    }
    return $bubble;
}

function note_colors(): array
{
    return ['cream', 'blush', 'butter', 'mint', 'lilac', 'sky'];
}

start_session();
require_once __DIR__ . '/games.php';
require_once __DIR__ . '/activities.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/password_reset.php';
enforce_session_epoch();
