<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metod dəstəklənmir.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/protect.php';
require_once __DIR__ . '/erp-users-schema.php';

function migrationResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireMigrationSuperadmin(mysqli $conn, int $userId): void {
    $statement = $conn->prepare('SELECT username FROM users WHERE id = ? LIMIT 1');
    $statement->bind_param('i', $userId);
    $statement->execute();
    $row = $statement->get_result()->fetch_assoc();
    $statement->close();
    if (!$row || strtolower((string) $row['username']) !== 'sami') {
        migrationResponse(['error' => 'Bu köçürmə yalnız Superadmin tərəfindən edilə bilər.'], 403);
    }
}

function ensureLegacyPasswordColumn(mysqli $conn): bool {
    $column = $conn->query("SHOW COLUMNS FROM users LIKE 'legacy_sha256'");
    if ($column && $column->fetch_assoc()) return true;
    return (bool) $conn->query('ALTER TABLE users ADD COLUMN legacy_sha256 CHAR(64) NULL DEFAULT NULL AFTER password_hash');
}

requireMigrationSuperadmin($conn, $current_user_id);
if (!ensureErpUserProfiles($conn) || !ensureLegacyPasswordColumn($conn)) {
    migrationResponse(['error' => 'ERP istifadəçi köçürməsi hazırlana bilmədi.'], 500);
}

$payload = json_decode(file_get_contents('php://input'), true);
$incoming = is_array($payload) && is_array($payload['users'] ?? null) ? $payload['users'] : null;
if ($incoming === null || count($incoming) > 100) {
    migrationResponse(['error' => 'Köçürüləcək istifadəçi siyahısı düzgün deyil.'], 422);
}

$created = 0;
$existing = 0;
$skipped = 0;
$conn->begin_transaction();
try {
    foreach ($incoming as $item) {
        $name = trim((string) ($item['name'] ?? ''));
        $username = trim((string) ($item['username'] ?? ''));
        $legacyHash = strtolower(trim((string) ($item['passwordHash'] ?? '')));
        if ($name === '' || mb_strlen($name, 'UTF-8') > 160 || !preg_match('/^[A-Za-z0-9._-]{3,64}$/', $username) || !preg_match('/^[a-f0-9]{64}$/', $legacyHash)) {
            $skipped++;
            continue;
        }

        $lookup = $conn->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
        $lookup->bind_param('s', $username);
        $lookup->execute();
        $row = $lookup->get_result()->fetch_assoc();
        $lookup->close();

        if ($row) {
            $userId = (int) $row['id'];
            $existing++;
        } else {
            // Legacy hashes are used only once at first login, then auth.php upgrades them to bcrypt.
            $placeholderHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
            $insert = $conn->prepare('INSERT INTO users (username, password_hash, legacy_sha256) VALUES (?, ?, ?)');
            $insert->bind_param('sss', $username, $placeholderHash, $legacyHash);
            if (!$insert->execute()) {
                $insert->close();
                throw new RuntimeException('İstifadəçi hesablardan biri yaradıla bilmədi.');
            }
            $userId = (int) $conn->insert_id;
            $insert->close();
            $created++;
        }

        $profile = $conn->prepare('INSERT INTO erp_user_profiles (user_id, display_name, is_erp_user) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_erp_user = 1');
        $profile->bind_param('is', $userId, $name);
        if (!$profile->execute()) {
            $profile->close();
            throw new RuntimeException('ERP istifadəçi profili yaradıla bilmədi.');
        }
        $profile->close();
    }
    $conn->commit();
} catch (Throwable $error) {
    $conn->rollback();
    migrationResponse(['error' => 'Köçürmə tamamlanmadı. Heç bir hesab dəyişdirilmədi.'], 500);
}

migrationResponse(['ok' => true, 'created' => $created, 'existing' => $existing, 'skipped' => $skipped]);

