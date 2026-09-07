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

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/protect.php';
require_once __DIR__ . '/erp-users-schema.php';

function adminUsersResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireErpSuperadmin(mysqli $conn, int $userId): void {
    $statement = $conn->prepare('SELECT username FROM users WHERE id = ? LIMIT 1');
    $statement->bind_param('i', $userId);
    $statement->execute();
    $user = $statement->get_result()->fetch_assoc();
    $statement->close();

    if (!$user || strtolower((string) $user['username']) !== 'sami') {
        adminUsersResponse(['error' => 'Bu əməliyyat yalnız Superadmin üçündür.'], 403);
    }
}

function listErpUsers(mysqli $conn): array {
    $result = $conn->query('SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS display_name
        FROM users u
        INNER JOIN erp_user_profiles p ON p.user_id = u.id AND p.is_erp_user = 1
        ORDER BY CASE WHEN LOWER(u.username) = "sami" THEN 0 ELSE 1 END, display_name, u.username');
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => (string) $row['id'],
            'username' => (string) $row['username'],
            'name' => (string) $row['display_name'],
            'role' => strtolower((string) $row['username']) === 'sami' ? 'SUPERADMIN' : 'ADMIN'
        ];
    }
    return $users;
}

function listAvailableAccounts(mysqli $conn): array {
    $result = $conn->query('SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS display_name
        FROM users u
        LEFT JOIN erp_user_profiles p ON p.user_id = u.id
        WHERE p.user_id IS NULL OR p.is_erp_user = 0
        ORDER BY display_name, u.username');
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = ['id' => (string) $row['id'], 'username' => (string) $row['username'], 'name' => (string) $row['display_name']];
    }
    return $users;
}

requireErpSuperadmin($conn, $current_user_id);
if (!ensureErpUserProfiles($conn)) adminUsersResponse(['error' => 'İstifadəçi profilləri hazırlana bilmədi.'], 500);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (($_GET['scope'] ?? '') === 'available') adminUsersResponse(['users' => listAvailableAccounts($conn)]);
    adminUsersResponse(['users' => listErpUsers($conn)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    adminUsersResponse(['error' => 'Metod dəstəklənmir.'], 405);
}

$payload = json_decode(file_get_contents('php://input'), true);
$action = is_array($payload) ? (string) ($payload['action'] ?? '') : '';

if ($action === 'create') {
    $name = trim((string) ($payload['name'] ?? ''));
    $username = trim((string) ($payload['username'] ?? ''));
    $passwordValue = (string) ($payload['password'] ?? '');
    if ($name === '' || mb_strlen($name, 'UTF-8') > 160 || !preg_match('/^[A-Za-z0-9._-]{3,64}$/', $username) || strlen($passwordValue) < 6) {
        adminUsersResponse(['error' => 'Ad, istifadəçi adı və ən azı 6 simvollu şifrə düzgün yazılmalıdır.'], 422);
    }
    if (strtolower($username) === 'sami') {
        adminUsersResponse(['error' => 'Bu istifadəçi adı ayrılıb.'], 422);
    }

    $hash = password_hash($passwordValue, PASSWORD_DEFAULT);
    $statement = $conn->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    $statement->bind_param('ss', $username, $hash);
    if (!$statement->execute()) {
        $statement->close();
        adminUsersResponse(['error' => 'Bu istifadəçi adı artıq mövcuddur və ya hesab yaradıla bilmədi.'], 409);
    }
    $userId = (int) $conn->insert_id;
    $statement->close();

    $profile = $conn->prepare('INSERT INTO erp_user_profiles (user_id, display_name, is_erp_user) VALUES (?, ?, 1)');
    $profile->bind_param('is', $userId, $name);
    if (!$profile->execute()) {
        $profile->close();
        $cleanup = $conn->prepare('DELETE FROM users WHERE id = ?');
        $cleanup->bind_param('i', $userId);
        $cleanup->execute();
        $cleanup->close();
        adminUsersResponse(['error' => 'İstifadəçi profili yaradıla bilmədi.'], 500);
    }
    $profile->close();
    adminUsersResponse(['ok' => true, 'users' => listErpUsers($conn)]);
}

if ($action === 'activate-erp-user') {
    $userId = (int) ($payload['userId'] ?? 0);
    $name = trim((string) ($payload['name'] ?? ''));
    if ($userId <= 0) adminUsersResponse(['error' => 'İstifadəçi seçilməyib.'], 422);
    $account = $conn->prepare('SELECT username FROM users WHERE id = ? LIMIT 1');
    $account->bind_param('i', $userId); $account->execute();
    $row = $account->get_result()->fetch_assoc(); $account->close();
    if (!$row) adminUsersResponse(['error' => 'İstifadəçi tapılmadı.'], 404);
    if ($name === '') $name = (string) $row['username'];
    if (mb_strlen($name, 'UTF-8') > 160) adminUsersResponse(['error' => 'Ad çox uzundur.'], 422);
    $profile = $conn->prepare('INSERT INTO erp_user_profiles (user_id, display_name, is_erp_user) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_erp_user = 1');
    $profile->bind_param('is', $userId, $name);
    if (!$profile->execute()) { $profile->close(); adminUsersResponse(['error' => 'ERP To-do istifadəçisi aktivləşdirilə bilmədi.'], 500); }
    $profile->close();
    adminUsersResponse(['ok' => true, 'users' => listErpUsers($conn)]);
}

if ($action === 'reset-password') {
    $userId = (int) ($payload['userId'] ?? 0);
    $passwordValue = (string) ($payload['password'] ?? '');
    if ($userId <= 0 || strlen($passwordValue) < 6) {
        adminUsersResponse(['error' => 'Yeni şifrə ən azı 6 simvol olmalıdır.'], 422);
    }
    $hash = password_hash($passwordValue, PASSWORD_DEFAULT);
    $statement = $conn->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $statement->bind_param('si', $hash, $userId);
    $statement->execute();
    $updated = $statement->affected_rows;
    $statement->close();
    if ($updated < 1) {
        adminUsersResponse(['error' => 'İstifadəçi tapılmadı.'], 404);
    }
    adminUsersResponse(['ok' => true, 'users' => listErpUsers($conn)]);
}

adminUsersResponse(['error' => 'Naməlum əməliyyat.'], 400);
