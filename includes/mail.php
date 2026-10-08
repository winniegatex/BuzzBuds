<?php
declare(strict_types=1);

function env_value(string $key, string $default = ''): string
{
    static $file = null;
    $fromEnv = getenv($key);
    if (is_string($fromEnv) && $fromEnv !== '') {
        return $fromEnv;
    }
    if ($file === null) {
        $path = dirname(__DIR__) . '/.env';
        $file = [];
        if (is_file($path)) {
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }
                if (!str_contains($line, '=')) {
                    continue;
                }
                [$k, $v] = explode('=', $line, 2);
                $file[trim($k)] = trim($v, " \t\"'");
            }
        }
    }
    return (string) ($file[$key] ?? $default);
}

function mail_from_header(): string
{
    $email = env_value('MAIL_FROM', 'no-reply@solivancesystems.com');
    $name = env_value('MAIL_FROM_NAME', 'BuzzBuds');
    return sprintf('%s <%s>', $name, $email);
}

function send_mail(string $to, string $subject, string $html, string $text): bool
{
    $host = env_value('SMTP_HOST');
    $user = env_value('SMTP_USER');
    $pass = env_value('SMTP_PASS');
    $port = (int) env_value('SMTP_PORT', '587');
    $secure = strtolower(env_value('SMTP_SECURE', 'tls'));
    if ($host === '' || $user === '' || $pass === '') {
        @file_put_contents(
            storage_dir() . '/mail.log',
            gmdate('c') . " skipped (no SMTP) to=" . mask_email($to) . " subject={$subject}\n",
            FILE_APPEND
        );
        return false;
    }
    $from = env_value('MAIL_FROM', 'no-reply@solivancesystems.com');
    $fromName = env_value('MAIL_FROM_NAME', 'BuzzBuds');
    $errno = 0;
    $errstr = '';
    $remote = ($secure === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $fp = @stream_socket_client($remote, $errno, $errstr, 12, STREAM_CLIENT_CONNECT);
    if (!$fp) {
        @file_put_contents(storage_dir() . '/mail.log', gmdate('c') . " smtp connect fail {$errstr}\n", FILE_APPEND);
        return false;
    }
    stream_set_timeout($fp, 12);
    $read = static function () use ($fp): string {
        $out = '';
        while (!feof($fp)) {
            $line = fgets($fp, 2048);
            if ($line === false) {
                break;
            }
            $out .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $out;
    };
    $cmd = static function (string $line) use ($fp): void {
        fwrite($fp, $line . "\r\n");
    };
    $expect = static function (string $resp, string $ok) : void {
        if (!str_starts_with($resp, $ok)) {
            throw new RuntimeException('SMTP rejected: ' . trim($resp));
        }
    };
    try {
        $banner = $read();
        $expect($banner, '220');
        $cmd('EHLO buzzbuds');
        $ehlo = $read();
        $expect($ehlo, '250');
        if ($secure === 'tls') {
            $cmd('STARTTLS');
            $expect($read(), '220');
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('TLS failed');
            }
            $cmd('EHLO buzzbuds');
            $expect($read(), '250');
        }
        $cmd('AUTH LOGIN');
        $expect($read(), '334');
        $cmd(base64_encode($user));
        $expect($read(), '334');
        $cmd(base64_encode($pass));
        $expect($read(), '235');
        $cmd('MAIL FROM:<' . $from . '>');
        $expect($read(), '250');
        $cmd('RCPT TO:<' . $to . '>');
        $expect($read(), '250');
        $cmd('DATA');
        $expect($read(), '354');
        $boundary = 'buzz' . bin2hex(random_bytes(8));
        $headers = [
            'From: ' . sprintf('%s <%s>', $fromName, $from),
            'To: ' . $to,
            'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $body = implode("\r\n", $headers) . "\r\n\r\n";
        $body .= "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$text}\r\n";
        $body .= "--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n{$html}\r\n";
        $body .= "--{$boundary}--";
        $cmd(str_replace("\n.", "\n..", str_replace("\r\n", "\n", $body)) . "\r\n.");
        $expect($read(), '250');
        $cmd('QUIT');
        fclose($fp);
        return true;
    } catch (Throwable $e) {
        fclose($fp);
        @file_put_contents(storage_dir() . '/mail.log', gmdate('c') . ' smtp ' . $e->getMessage() . "\n", FILE_APPEND);
        return false;
    }
}

function branded_email(string $headline, string $bodyHtml, string $code = ''): array
{
    $codeBlock = $code !== ''
        ? '<p style="font-size:36px;letter-spacing:10px;font-weight:800;color:#9B0A6B;text-align:center;margin:24px 0">' . htmlspecialchars($code, ENT_QUOTES) . '</p>'
        : '';
    $html = '<!DOCTYPE html><html><body style="margin:0;background:#4A1038;padding:24px;font-family:Nunito,Segoe UI,sans-serif">'
        . '<div style="max-width:480px;margin:0 auto;background:#FFF4F5;border-radius:28px;padding:28px;color:#4A1038">'
        . '<p style="text-align:center;font-weight:800;font-size:22px;color:#9B0A6B;margin:0 0 8px">BuzzBuds</p>'
        . '<h1 style="font-size:22px;color:#9B0A6B;text-align:center">' . htmlspecialchars($headline, ENT_QUOTES) . '</h1>'
        . $codeBlock
        . '<div style="font-size:16px;line-height:1.5">' . $bodyHtml . '</div>'
        . '</div></body></html>';
    $text = $headline . "\n\n" . ($code !== '' ? "Your code: {$code}\n\n" : '') . trim(html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '</p>'], "\n", $bodyHtml))));
    return [$html, $text];
}

function send_reset_code_mail(string $to, string $code): bool
{
    [$html, $text] = branded_email(
        'Your BuzzBuds reset code',
        '<p>Use this code to reset your password. It expires in 10 minutes.</p><p>Didn\'t ask for this? You can safely ignore this email.</p>',
        $code
    );
    return send_mail($to, 'Your BuzzBuds reset code', $html, $text);
}

function send_password_changed_mail(string $to): bool
{
    [$html, $text] = branded_email(
        'Your password was changed',
        '<p>Your BuzzBuds password was changed. If this wasn\'t you, contact us.</p>'
    );
    return send_mail($to, 'Your BuzzBuds password was changed', $html, $text);
}
