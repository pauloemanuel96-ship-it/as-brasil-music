<?php
/* Funções comuns da API da AS Brasil Music */
declare(strict_types=1);

define('ROOT_DIR', dirname(__DIR__));
define('DATA_DIR', ROOT_DIR . '/data');
define('CATALOG_FILE', DATA_DIR . '/catalog.json');
define('AUDIO_EXTS', ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'webm']);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function json_out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function json_error(int $code, string $erro, string $mensagem, array $extra = []): void {
    json_out(['erro' => $erro, 'mensagem' => $mensagem] + $extra, $code);
}

$cfg = __DIR__ . '/config.php';
if (!is_file($cfg)) {
    json_error(500, 'config_ausente', 'Crie o arquivo api/config.php a partir do api/config.example.php.');
}
require $cfg;
if (!defined('ADMIN_SENHA') || ADMIN_SENHA === '' || ADMIN_SENHA === 'troque-por-uma-senha-forte') {
    json_error(500, 'senha_padrao', 'Defina uma senha própria em api/config.php.');
}
if (!defined('MAX_AUDIO_MB')) define('MAX_AUDIO_MB', 100);

if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0755, true);

function is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

session_name('asbm');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

function require_method(string $m): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $m) json_error(405, 'metodo', 'Método não permitido.');
}
function is_admin(): bool {
    return !empty($_SESSION['adm']) && !empty($_SESSION['csrf']);
}
function require_admin(): void {
    if (!is_admin()) json_error(401, 'sessao', 'Entre na área do artista para continuar.');
    $sent = $_SERVER['HTTP_X_CSRF'] ?? '';
    if (!is_string($sent) || !hash_equals($_SESSION['csrf'], $sent)) json_error(401, 'csrf', 'Sessão inválida. Entre de novo.');
}
function default_catalog(): array {
    return [
        'v' => 1,
        'site' => ['name' => 'AS Brasil Music', 'tagline' => 'Dê o play e continue ouvindo enquanto usa outros apps.', 'artist' => 'AS Brasil Music'],
        'tracks' => [],
    ];
}
function read_catalog(): array {
    if (!is_file(CATALOG_FILE)) return default_catalog();
    $data = json_decode((string)file_get_contents(CATALOG_FILE), true);
    return is_array($data) && isset($data['tracks']) ? $data : default_catalog();
}
function write_catalog(array $cat): void {
    $tmp = CATALOG_FILE . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $json = json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false || !rename($tmp, CATALOG_FILE)) {
        @unlink($tmp);
        json_error(500, 'gravacao', 'Não foi possível salvar. Verifique a permissão de escrita da pasta data.');
    }
}
function read_json_body(int $max = 2097152): array {
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) json_error(413, 'grande', 'Conteúdo grande demais.');
    $data = json_decode($raw, true);
    if (!is_array($data)) json_error(400, 'json', 'Conteúdo inválido.');
    return $data;
}
function client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '0';
}
