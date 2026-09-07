<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/db.php';

function base64url_encode(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

$data = json_decode(file_get_contents('php://input'), true);
$username = trim((string) ($data['username'] ?? ''));
$loginPassword = (string) ($data['password'] ?? '');
if ($username === '' || $loginPassword === '') {
    http_response_code(400);
    echo json_encode(['error' => 'İstifadəçi adı və şifrə tələb olunur'], JSON_UNESCAPED_UNICODE);
    exit;
}

$legacyColumn = $conn->query("SHOW COLUMNS FROM users LIKE 'legacy_sha256'");
$hasLegacyColumn = $legacyColumn && $legacyColumn->fetch_assoc();
$sql = $hasLegacyColumn
    ? 'SELECT id, username, password_hash, legacy_sha256 FROM users WHERE username = ? LIMIT 1'
    : 'SELECT id, username, password_hash, NULL AS legacy_sha256 FROM users WHERE username = ? LIMIT 1';
$statement = $conn->prepare($sql);
$statement->bind_param('s', $username);
$statement->execute();
$row = $statement->get_result()->fetch_assoc();
$statement->close();

$valid = $row && password_verify($loginPassword, (string) $row['password_hash']);
$legacyMatch = false;
if (!$valid && $row && !empty($row['legacy_sha256'])) {
    $legacyMatch = hash_equals((string) $row['legacy_sha256'], hash('sha256', $loginPassword));
    $valid = $legacyMatch;
}

if (!$valid || !$row) {
    http_response_code(401);
    echo json_encode(['error' => 'İstifadəçi adı və ya şifrə düzgün deyil'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($legacyMatch) {
    $newHash = password_hash($loginPassword, PASSWORD_DEFAULT);
    $upgrade = $conn->prepare('UPDATE users SET password_hash = ?, legacy_sha256 = NULL WHERE id = ?');
    $userId = (int) $row['id'];
    $upgrade->bind_param('si', $newHash, $userId);
    $upgrade->execute();
    $upgrade->close();
}

$expiresIn = 43200;
$expiresAt = time() + $expiresIn;
$tokenPayload = base64url_encode(json_encode(['uid' => (int) $row['id'], 'iat' => time(), 'exp' => $expiresAt]));
// $password is the server-side secret from db.php; it is never sent to clients.
$signature = hash_hmac('sha256', $tokenPayload, $password);
$secureToken = $tokenPayload . '.' . $signature;

$update = $conn->prepare('UPDATE users SET last_login = NOW() WHERE id = ?');
$userId = (int) $row['id'];
$update->bind_param('i', $userId);
$update->execute();
$update->close();

echo json_encode(['token' => $secureToken, 'username' => $row['username'], 'expires' => $expiresAt * 1000, 'expires_in' => $expiresIn], JSON_UNESCAPED_UNICODE);

