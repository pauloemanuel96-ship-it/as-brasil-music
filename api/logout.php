<?php
require __DIR__ . '/_bootstrap.php';
require_method('POST');
require_admin();
$_SESSION = [];
session_destroy();
json_out(['ok' => true]);
