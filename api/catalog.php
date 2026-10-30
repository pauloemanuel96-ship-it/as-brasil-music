<?php
require __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    json_out(read_catalog() + ['limiteMb' => MAX_AUDIO_MB]);
}
require_method('POST');
require_admin();

function str_field($v, int $max): string {
    $s = trim(preg_replace('/\s+/u', ' ', (string)$v) ?? '');
    return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}

$in = read_json_body();
$site = is_array($in['site'] ?? null) ? $in['site'] : [];
$def = default_catalog()['site'];
$out = [
    'v' => 1,
    'site' => [
        'name' => str_field($site['name'] ?? '', 40) ?: $def['name'],
        'tagline' => str_field($site['tagline'] ?? '', 120) ?: $def['tagline'],
        'artist' => str_field($site['artist'] ?? '', 80) ?: $def['artist'],
    ],
    'tracks' => [],
];

$audioRe = '#^musicas/[a-z0-9]{16}\.(' . implode('|', AUDIO_EXTS) . ')$#';
$seen = [];
foreach (($in['tracks'] ?? []) as $t) {
    if (!is_array($t) || count($out['tracks']) >= 2000) continue;
    $id = (string)($t['id'] ?? '');
    $file = (string)($t['file'] ?? '');
    $cover = $t['cover'] ?? null;
    if (!preg_match('/^t[a-z0-9]{6,40}$/', $id) || isset($seen[$id])) continue;
    if (!preg_match($audioRe, $file) || !is_file(ROOT_DIR . '/' . $file)) continue;
    if ($cover !== null && (!is_string($cover) || !preg_match('#^capas/[a-z0-9]{16}\.jpg$#', $cover) || !is_file(ROOT_DIR . '/' . $cover))) $cover = null;
    $seen[$id] = true;
    $out['tracks'][] = [
        'id' => $id,
        'title' => str_field($t['title'] ?? '', 120) ?: 'Sem título',
        'artist' => str_field($t['artist'] ?? '', 80),
        'album' => str_field($t['album'] ?? '', 80),
        'dur' => max(0, min(86400, (int)($t['dur'] ?? 0))),
        'file' => $file,
        'cover' => $cover,
        'hue' => max(0, min(360, (int)($t['hue'] ?? 272))),
        'added' => (int)($t['added'] ?? time()),
    ];
}

$old = read_catalog();
write_catalog($out);

/* Limpeza: apaga arquivos que saíram do catálogo e envios abandonados há mais de 2 dias */
$keep = [];
foreach ($out['tracks'] as $t) { $keep[$t['file']] = true; if ($t['cover']) $keep[$t['cover']] = true; }
foreach (($old['tracks'] ?? []) as $t) {
    foreach ([$t['file'] ?? null, $t['cover'] ?? null] as $p) {
        if (is_string($p) && !isset($keep[$p]) && preg_match('#^(musicas|capas)/[a-z0-9]{16}\.[a-z0-9]+$#', $p)) @unlink(ROOT_DIR . '/' . $p);
    }
}
foreach (['musicas', 'capas'] as $dir) {
    foreach (glob(ROOT_DIR . "/$dir/*.*") ?: [] as $f) {
        $rel = $dir . '/' . basename($f);
        if (!isset($keep[$rel]) && preg_match('#^[a-z0-9]{16}\.[a-z0-9]+$#', basename($f)) && filemtime($f) < time() - 172800) @unlink($f);
    }
}
json_out(['ok' => true, 'catalog' => $out]);
