<?php
declare(strict_types=1);

function mask_email(string $email): string
{
    $email = strtolower(trim($email));
    $at = strpos($email, '@');
    if ($at === false) {
        return '***';
    }
    $local = substr($email, 0, $at);
    $domain = substr($email, $at);
    $keep = $local === '' ? '*' : substr($local, 0, 1);
    return $keep . '***' . $domain;
}

function client_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return preg_replace('/[^0-9a-fA-F:.]/', '', $ip) ?: '0.0.0.0';
}

function rate_limit_hit(PDO $db, string $bucket, int $limit, int $windowSeconds): bool
{
    $now = time();
    $window = intdiv($now, $windowSeconds) * $windowSeconds;
    $db->prepare('DELETE FROM auth_rate_limits WHERE window_start < ?')->execute([$now - $windowSeconds * 3]);
    $stmt = $db->prepare('SELECT count FROM auth_rate_limits WHERE bucket = ? AND window_start = ?');
    $stmt->execute([$bucket, $window]);
    $row = $stmt->fetch();
    $count = $row ? (int) $row['count'] : 0;
    if ($count >= $limit) {
        return true;
    }
    $db->prepare('INSERT INTO auth_rate_limits (bucket, window_start, count) VALUES (?,?,1)
        ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1')
        ->execute([$bucket, $window]);
    return false;
}

function password_ok_reset(string $password): void
{
    if (strlen($password) < 8) {
        throw new UserError('Use at least 8 characters for your password.');
    }
    if (strlen($password) > 200) {
        throw new UserError('That password is too long.');
    }
}

function handle_forgot_password(): void
{
    require_mutation();
    $email = strtolower(trim((string) (read_json()['email'] ?? '')));
    $generic = 'If that email is registered, a code is on its way.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_ok(['message' => $generic, 'cooldown' => 60]);
    }
    $db = db();
    $ip = client_ip();
    if (rate_limit_hit($db, 'fp:ip:' . $ip, 5, 3600) || rate_limit_hit($db, 'fp:em:' . $email, 5, 3600)) {
        json_ok(['message' => $generic, 'cooldown' => 60]);
    }
    $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user) {
        $uid = (int) $user['id'];
        $now = time();
        $db->prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0')->execute([$uid]);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $hash = password_hash($code, PASSWORD_DEFAULT);
        $db->prepare('INSERT INTO password_resets (user_id, code_hash, expires_at, used, attempts, created_at) VALUES (?,?,?,0,0,?)')
            ->execute([$uid, $hash, $now + 600, $now]);
        send_reset_code_mail($email, $code);
    }
    json_ok(['message' => $generic, 'masked' => mask_email($email), 'cooldown' => 60, 'expiresIn' => 600]);
}

function handle_verify_reset_code(): void
{
    require_mutation();
    $data = read_json();
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $code = preg_replace('/\D/', '', (string) ($data['code'] ?? '')) ?? '';
    $fail = 'That code isn\'t right or has expired.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($code) !== 6) {
        throw new UserError($fail);
    }
    $db = db();
    $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user) {
        usleep(120000);
        throw new UserError($fail);
    }
    $uid = (int) $user['id'];
    $now = time();
    $rowStmt = $db->prepare('SELECT * FROM password_resets WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1');
    $rowStmt->execute([$uid]);
    $row = $rowStmt->fetch();
    if (!$row) {
        throw new UserError($fail);
    }
    if ((int) $row['expires_at'] < $now) {
        throw new UserError('That code has expired. Send a new one.');
    }
    if ((int) $row['attempts'] >= 5) {
        $db->prepare('UPDATE password_resets SET used = 1 WHERE id = ?')->execute([(int) $row['id']]);
        throw new UserError('Too many tries. Send a new code.');
    }
    $ok = password_verify($code, (string) $row['code_hash']);
    if (!$ok) {
        $db->prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?')->execute([(int) $row['id']]);
        throw new UserError($fail);
    }
    $token = bin2hex(random_bytes(24));
    $tokenHash = hash('sha256', $token);
    $db->prepare('UPDATE password_resets SET token_hash = ?, token_expires_at = ?, attempts = 0 WHERE id = ?')
        ->execute([$tokenHash, $now + 900, (int) $row['id']]);
    json_ok(['resetToken' => $token, 'expiresIn' => 900]);
}

function handle_reset_password(): void
{
    require_mutation();
    $data = read_json();
    $token = (string) ($data['resetToken'] ?? '');
    $password = (string) ($data['password'] ?? '');
    $confirm = (string) ($data['passwordConfirm'] ?? $password);
    password_ok_reset($password);
    if (!hash_equals($password, $confirm)) {
        throw new UserError('Those passwords don’t match.');
    }
    if (strlen($token) < 20) {
        throw new UserError('That reset link isn’t valid anymore. Send a new code.');
    }
    $db = db();
    $hash = hash('sha256', $token);
    $stmt = $db->prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 ORDER BY id DESC LIMIT 1');
    $stmt->execute([$hash]);
    $row = $stmt->fetch();
    $now = time();
    if (!$row || (int) ($row['token_expires_at'] ?? 0) < $now) {
        throw new UserError('That reset link isn’t valid anymore. Send a new code.');
    }
    $uid = (int) $row['user_id'];
    $db->prepare('UPDATE password_resets SET used = 1 WHERE id = ?')->execute([(int) $row['id']]);
    $db->prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?')->execute([$uid]);
    $db->prepare('UPDATE users SET password_hash = ?, session_epoch = session_epoch + 1 WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_DEFAULT), $uid]);
    $user = user_by_id($db, $uid);
    if ($user) {
        send_password_changed_mail((string) $user['email']);
        set_uid($uid);
        json_ok(['user' => user_public($user), 'signedIn' => true]);
    }
    json_ok(['signedIn' => false]);
}
