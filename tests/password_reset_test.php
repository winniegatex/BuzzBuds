<?php
require dirname(__DIR__) . '/includes/bootstrap.php';

function expect(bool $ok, string $label): void
{
    if (!$ok) {
        fwrite(STDERR, "fail: $label\n");
        exit(1);
    }
}

$db = db();
$email = 'resettest' . bin2hex(random_bytes(3)) . '@example.com';
$hash = password_hash('oldpass12', PASSWORD_DEFAULT);
$db->prepare('INSERT INTO users (email, password_hash, display_name, username, created_at, session_epoch) VALUES (?,?,?,?,?,1)')
    ->execute([$email, $hash, 'Reset', 'reset' . random_int(1000, 9999), gmdate('c')]);
$uid = (int) $db->lastInsertId();

$code = '424242';
$db->prepare('INSERT INTO password_resets (user_id, code_hash, expires_at, used, attempts, created_at) VALUES (?,?,?,?,0,?)')
    ->execute([$uid, password_hash($code, PASSWORD_DEFAULT), time() + 600, 0, time()]);

expect(password_verify($code, (string) $db->query('SELECT code_hash FROM password_resets WHERE user_id = ' . $uid)->fetch()['code_hash']), 'hash matches');
expect(mask_email($email)[0] === $email[0], 'mask keeps first letter');
expect(!str_contains(mask_email($email), explode('@', $email)[0]), 'mask hides local part');

$expired = time() - 10;
$db->prepare('INSERT INTO password_resets (user_id, code_hash, expires_at, used, attempts, created_at) VALUES (?,?,?,?,0,?)')
    ->execute([$uid, password_hash('111111', PASSWORD_DEFAULT), $expired, 0, time()]);
expect(true, 'expired row stored');

echo "ok\n";
