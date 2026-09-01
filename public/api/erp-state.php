<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../../api/db.php';
require_once __DIR__ . '/../../api/protect.php';

$create = "CREATE TABLE IF NOT EXISTS erp_state (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    state_json LONGTEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

if (!$conn->query($create)) {
    http_response_code(500);
    echo json_encode(['error' => 'ERP state table could not be initialized'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = $conn->query("SELECT state_json, updated_at FROM erp_state WHERE id = 1 LIMIT 1");
    $row = $result ? $result->fetch_assoc() : null;
    $state = $row ? json_decode($row['state_json'], true) : null;
    echo json_encode(['state' => $state, 'updatedAt' => $row['updated_at'] ?? null], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload) || !isset($payload['state']) || !is_array($payload['state'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid ERP state payload'], JSON_UNESCAPED_UNICODE);
    exit;
}

$stateJson = json_encode($payload['state'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($stateJson === false || strlen($stateJson) > 15 * 1024 * 1024) {
    http_response_code(413);
    echo json_encode(['error' => 'ERP state is too large'], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = $conn->prepare("INSERT INTO erp_state (id, state_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = CURRENT_TIMESTAMP");
$stmt->bind_param('s', $stateJson);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'ERP state could not be saved'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => true, 'updatedAt' => date('c')], JSON_UNESCAPED_UNICODE);
