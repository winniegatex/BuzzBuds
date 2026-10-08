<?php
declare(strict_types=1);

class UserError extends RuntimeException
{
    public function __construct(string $message, public int $status = 400)
    {
        parent::__construct($message);
    }
}

require dirname(__DIR__) . '/includes/games.php';

function expect(bool $cond, string $label): void
{
    if (!$cond) {
        fwrite(STDERR, "FAIL: $label\n");
        exit(1);
    }
    fwrite(STDOUT, "ok: $label\n");
}

$state = solitaire_new(1, 2);
$p = sol_player($state, 1);
expect(count($p['tableau'][6]) === 7, 'solitaire deal pile 7');
$state = sol_apply($state, 1, ['action' => 'draw']);
$p = sol_player($state, 1);
expect($p['moves'] === 1, 'solitaire draw counts move');

$quiz = kahoot_new(1, 2);
$quiz = kahoot_apply($quiz, 1, [
    'action' => 'add_question',
    'prompt' => '2+2?',
    'choices' => ['3', '4', '5', '6'],
    'correct' => 1,
]);
$quiz = kahoot_apply($quiz, 1, ['action' => 'start']);
expect($quiz['phase'] === 'question', 'kahoot starts');
$quiz = kahoot_apply($quiz, 1, ['action' => 'answer', 'choice' => 1]);
expect($quiz['phase'] === 'question', 'kahoot waits for second answer');
$quiz = kahoot_apply($quiz, 2, ['action' => 'answer', 'choice' => 1]);
expect($quiz['phase'] === 'reveal', 'kahoot reveals when both answered');
expect((int) $quiz['scores']['1'] > 0, 'kahoot scores correct answer');

fwrite(STDOUT, "all passed\n");
