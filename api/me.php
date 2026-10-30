<?php
require __DIR__ . '/_bootstrap.php';
require_method('GET');
json_out(is_admin() ? ['logado' => true, 'csrf' => $_SESSION['csrf']] : ['logado' => false]);
