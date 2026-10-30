<?php
require __DIR__ . '/_bootstrap.php';
require_method('POST');

/* Proteção contra tentativas repetidas: 5 erros bloqueiam o IP por 15 minutos */
$file = DATA_DIR . '/tentativas.json';
$key = hash('sha256', client_ip());
$now = time();
$fp = fopen($file, 'c+');
flock($fp, LOCK_EX);
$all = json_decode(stream_get_contents($fp) ?: '{}', true) ?: [];
foreach ($all as $k => $v) if (($v['ate'] ?? 0) < $now && ($v['t'] ?? 0) < $now - 3600) unset($all[$k]);
$me = $all[$key] ?? ['n' => 0, 'ate' => 0, 't' => $now];

$save = function () use ($fp, &$all) {
    ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($all)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);
};

if ($me['ate'] > $now) { $save(); json_error(429, 'bloqueado', 'Muitas tentativas. Aguarde alguns minutos.'); }

$body = read_json_body(4096);
$senha = (string)($body['senha'] ?? '');
$ok = str_starts_with(ADMIN_SENHA, '$2y$') ? password_verify($senha, ADMIN_SENHA) : hash_equals(ADMIN_SENHA, $senha);

if (!$ok) {
    $me['n']++; $me['t'] = $now;
    if ($me['n'] >= 5) { $me['ate'] = $now + 900; $me['n'] = 0; }
    $all[$key] = $me; $save();
    sleep(1);
    json_error(401, 'senha', 'Senha incorreta.');
}
unset($all[$key]); $save();
session_regenerate_id(true);
$_SESSION['adm'] = true;
$_SESSION['csrf'] = bin2hex(random_bytes(24));
json_out(['ok' => true, 'csrf' => $_SESSION['csrf']]);
