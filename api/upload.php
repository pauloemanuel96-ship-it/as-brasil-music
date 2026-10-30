<?php
/* Recebe arquivos em pedaços, para funcionar mesmo com limite de upload baixo no PHP */
require __DIR__ . '/_bootstrap.php';
require_method('POST');
require_admin();

$kind = $_GET['kind'] ?? '';
$uid = $_GET['uid'] ?? '';
$ext = strtolower((string)($_GET['ext'] ?? ''));
$offset = filter_var($_GET['offset'] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
$final = ($_GET['final'] ?? '0') === '1';

if (!is_string($uid) || !preg_match('/^[a-z0-9]{16}$/', $uid)) json_error(400, 'uid', 'Identificador inválido.');
if ($offset === false) json_error(400, 'offset', 'Posição inválida.');
if ($kind === 'audio') {
    if (!in_array($ext, AUDIO_EXTS, true)) json_error(415, 'formato', 'Formato de áudio não aceito.');
    $max = MAX_AUDIO_MB * 1048576; $dest = 'musicas';
} elseif ($kind === 'cover') {
    if ($ext !== 'jpg') json_error(415, 'formato', 'A capa precisa ser JPG.');
    $max = 5 * 1048576; $dest = 'capas';
} else json_error(400, 'tipo', 'Tipo de envio inválido.');

$tmpDir = DATA_DIR . '/tmp';
if (!is_dir($tmpDir)) @mkdir($tmpDir, 0755, true);
$part = "$tmpDir/$uid.part";

if ($offset === 0) {
    @unlink($part);
    foreach (glob("$tmpDir/*.part") ?: [] as $old) if (filemtime($old) < time() - 86400) @unlink($old);
}
clearstatcache();
$have = is_file($part) ? filesize($part) : 0;
if ($have !== $offset) json_error(409, 'offset', 'Pedaço fora de ordem.', ['recebido' => $have]);

$in = fopen('php://input', 'rb');
$out = fopen($part, 'ab');
if (!$in || !$out) json_error(500, 'gravacao', 'Não foi possível gravar. Verifique a permissão da pasta data.');
$n = stream_copy_to_stream($in, $out, $max - $have + 1);
fclose($in); fclose($out);
if ($have + $n > $max) { @unlink($part); json_error(413, 'grande', 'Arquivo maior que o limite permitido.'); }

if (!$final) json_out(['ok' => true, 'recebido' => $have + $n]);

/* Último pedaço: confere o tipo real do arquivo antes de publicar */
$size = filesize($part);
if ($size < 1024 && $kind === 'audio') { @unlink($part); json_error(400, 'vazio', 'Arquivo vazio ou corrompido.'); }

if ($kind === 'cover') {
    $info = @getimagesize($part);
    if (!$info || $info[2] !== IMAGETYPE_JPEG) { @unlink($part); json_error(415, 'formato', 'A capa não é um JPG válido.'); }
} else {
    $mime = function_exists('finfo_open') ? (finfo_file(finfo_open(FILEINFO_MIME_TYPE), $part) ?: '') : '';
    $ok = $mime === '' || str_starts_with($mime, 'audio/') || in_array($mime, ['video/mp4', 'video/webm', 'application/ogg', 'application/octet-stream', 'video/x-m4a'], true);
    if (!$ok) { @unlink($part); json_error(415, 'formato', 'O arquivo não parece ser de áudio.'); }
}

$dir = ROOT_DIR . '/' . $dest;
if (!is_dir($dir)) @mkdir($dir, 0755, true);
$target = "$dir/$uid.$ext";
if (!rename($part, $target)) { @unlink($part); json_error(500, 'gravacao', "Não foi possível mover o arquivo para a pasta $dest."); }
@chmod($target, 0644);
json_out(['ok' => true, 'path' => "$dest/$uid.$ext", 'tamanho' => $size]);
