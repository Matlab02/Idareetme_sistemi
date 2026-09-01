<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Metod dəstəklənmir.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/protect.php';
require_once __DIR__ . '/erp-users-schema.php';

if (!ensureErpUserProfiles($conn)) {
    http_response_code(500);
    echo json_encode(['error' => 'İstifadəçi siyahısı hazırlana bilmədi.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$result = $conn->query('SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS display_name
    FROM users u
    INNER JOIN erp_user_profiles p ON p.user_id = u.id AND p.is_erp_user = 1
    ORDER BY display_name, u.username');
$users = [];
while ($row = $result->fetch_assoc()) {
    $users[] = [
        'id' => (string) $row['id'],
        'username' => (string) $row['username'],
        'name' => (string) $row['display_name']
    ];
}
echo json_encode(['users' => $users], JSON_UNESCAPED_UNICODE);
