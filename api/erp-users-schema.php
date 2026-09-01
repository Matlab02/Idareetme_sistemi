<?php
declare(strict_types=1);

function ensureErpUserProfiles(mysqli $conn): bool {
    $create = 'CREATE TABLE IF NOT EXISTS erp_user_profiles (
        user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        display_name VARCHAR(160) NOT NULL,
        is_erp_user TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (!$conn->query($create)) return false;

    $column = $conn->query("SHOW COLUMNS FROM erp_user_profiles LIKE 'is_erp_user'");
    if (!$column || !$column->fetch_assoc()) {
        if (!$conn->query('ALTER TABLE erp_user_profiles ADD COLUMN is_erp_user TINYINT(1) NOT NULL DEFAULT 1 AFTER display_name')) return false;
    }

    $seed = $conn->prepare('INSERT INTO erp_user_profiles (user_id, display_name, is_erp_user)
        SELECT id, username, 1 FROM users WHERE LOWER(username) = "sami" LIMIT 1
        ON DUPLICATE KEY UPDATE is_erp_user = 1');
    if (!$seed) return false;
    $ok = $seed->execute();
    $seed->close();
    return $ok;
}

function erpProfile(mysqli $conn, int $userId): ?array {
    $statement = $conn->prepare('SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS display_name
        FROM users u
        INNER JOIN erp_user_profiles p ON p.user_id = u.id AND p.is_erp_user = 1
        WHERE u.id = ? LIMIT 1');
    if (!$statement) return null;
    $statement->bind_param('i', $userId);
    $statement->execute();
    $profile = $statement->get_result()->fetch_assoc() ?: null;
    $statement->close();
    return $profile;
}
