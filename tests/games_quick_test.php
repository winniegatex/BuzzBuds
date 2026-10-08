<?php
require dirname(__DIR__) . '/includes/bootstrap.php';

function expect(bool $ok, string $label): void
{
    if (!$ok) {
        fwrite(STDERR, "fail: $label\n");
        exit(1);
    }
}

$state = c4_new(1, 2);
$state = c4_apply($state, 1, 3);
expect($state['turn'] === 'black', 'c4 alternates');
$state = memory_new(1, 2);
expect(count($state['cards']) === 16, 'memory deck');
$hang = hangman_new(1, 2);
$hang = hangman_apply($hang, 1, ['action' => 'word', 'word' => 'hello']);
expect($hang['phase'] === 'guess', 'hangman word set');
echo "ok\n";
