<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/protect.php';
require_once __DIR__ . '/erp-users-schema.php';

function todoResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function ensureTodoTables(mysqli $conn): bool {
    $todos = 'CREATE TABLE IF NOT EXISTS erp_todos (
        id VARCHAR(48) NOT NULL PRIMARY KEY,
        title VARCHAR(220) NOT NULL,
        request_id VARCHAR(80) NOT NULL DEFAULT "",
        recipients_json TEXT NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT "Normal",
        due_date DATE NULL,
        note TEXT NULL,
        status VARCHAR(24) NOT NULL DEFAULT "PENDING",
        creator_id BIGINT UNSIGNED NOT NULL,
        creator_username VARCHAR(100) NOT NULL,
        accepted_by VARCHAR(100) NULL,
        accepted_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        INDEX erp_todos_updated_idx (updated_at),
        INDEX erp_todos_creator_idx (creator_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $history = 'CREATE TABLE IF NOT EXISTS erp_todo_history (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        todo_id VARCHAR(48) NOT NULL,
        actor_id BIGINT UNSIGNED NOT NULL,
        actor_username VARCHAR(100) NOT NULL,
        action VARCHAR(40) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT "",
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX erp_todo_history_todo_idx (todo_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (!$conn->query($todos) || !$conn->query($history)) return false;
    $acceptedBy = $conn->query("SHOW COLUMNS FROM erp_todos LIKE 'accepted_by'");
    if (!$acceptedBy || !$acceptedBy->fetch_assoc()) {
        if (!$conn->query('ALTER TABLE erp_todos ADD COLUMN accepted_by VARCHAR(100) NULL AFTER creator_username')) return false;
    }
    $acceptedAt = $conn->query("SHOW COLUMNS FROM erp_todos LIKE 'accepted_at'");
    if (!$acceptedAt || !$acceptedAt->fetch_assoc()) {
        if (!$conn->query('ALTER TABLE erp_todos ADD COLUMN accepted_at DATETIME NULL AFTER accepted_by')) return false;
    }
    return true;
}

function addTodoHistory(mysqli $conn, string $todoId, array $actor, string $action, string $status): void {
    $statement = $conn->prepare('INSERT INTO erp_todo_history (todo_id, actor_id, actor_username, action, status) VALUES (?, ?, ?, ?, ?)');
    if (!$statement) return;
    $actorId = (int) $actor['id'];
    $username = (string) $actor['username'];
    $statement->bind_param('sisss', $todoId, $actorId, $username, $action, $status);
    $statement->execute();
    $statement->close();
}

function normalizeRecipients(mysqli $conn, $value): array {
    $recipients = is_array($value) ? $value : [];
    $recipients = array_values(array_unique(array_filter(array_map(static fn($item) => trim((string) $item), $recipients))));
    if (in_array('ALL', $recipients, true)) return ['ALL'];
    if (!$recipients || count($recipients) > 50) todoResponse(['error' => 'Ən azı bir ERP istifadəçisi seçin.'], 422);

    $accepted = [];
    foreach ($recipients as $username) {
        $statement = $conn->prepare('SELECT u.username FROM users u INNER JOIN erp_user_profiles p ON p.user_id = u.id AND p.is_erp_user = 1 WHERE LOWER(u.username) = LOWER(?) LIMIT 1');
        if (!$statement) continue;
        $statement->bind_param('s', $username);
        $statement->execute();
        $row = $statement->get_result()->fetch_assoc();
        $statement->close();
        if ($row) $accepted[] = (string) $row['username'];
    }
    if (count($accepted) !== count($recipients)) todoResponse(['error' => 'Seçilən alıcılardan biri ERP istifadəçisi deyil.'], 422);
    return $accepted;
}

function fetchVisibleTodos(mysqli $conn, array $actor): array {
    $result = $conn->query('SELECT id, title, request_id, recipients_json, priority, due_date, note, status, creator_id, creator_username, accepted_by, accepted_at, created_at, updated_at, completed_at FROM erp_todos ORDER BY updated_at DESC, created_at DESC');
    $todos = [];
    $actorId = (int) $actor['id'];
    $username = (string) $actor['username'];
    while ($row = $result->fetch_assoc()) {
        $recipients = json_decode((string) $row['recipients_json'], true);
        $recipients = is_array($recipients) ? $recipients : [];
        $visible = (int) $row['creator_id'] === $actorId || in_array('ALL', $recipients, true) || in_array($username, $recipients, true);
        if (!$visible) continue;
        $todos[] = [
            'id' => $row['id'], 'title' => $row['title'], 'requestId' => $row['request_id'], 'recipients' => $recipients,
            'priority' => $row['priority'], 'dueDate' => $row['due_date'] ?? '', 'note' => $row['note'] ?? '', 'status' => $row['status'],
            'createdBy' => $row['creator_username'], 'acceptedBy' => $row['accepted_by'] ?? '', 'acceptedAt' => $row['accepted_at'] ?? '', 'createdAt' => $row['created_at'], 'updatedAt' => $row['updated_at'], 'completedAt' => $row['completed_at'] ?? '',
            'isRecipient' => (in_array('ALL', $recipients, true) && (string) $row['creator_username'] !== $username) || in_array($username, $recipients, true),
            'isCreator' => (int) $row['creator_id'] === $actorId
        ];
    }
    return $todos;
}

if (!ensureErpUserProfiles($conn) || !ensureTodoTables($conn)) todoResponse(['error' => 'To-do bölməsi hazırlana bilmədi.'], 500);
$actor = erpProfile($conn, (int) $current_user_id);
if (!$actor) todoResponse(['error' => 'Bu hesab ERP istifadəçisi kimi aktiv deyil.'], 403);

if ($_SERVER['REQUEST_METHOD'] === 'GET') todoResponse(['todos' => fetchVisibleTodos($conn, $actor), 'viewer' => ['username' => $actor['username'], 'name' => $actor['display_name']]]);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') todoResponse(['error' => 'Metod dəstəklənmir.'], 405);

$payload = json_decode(file_get_contents('php://input'), true);
$action = is_array($payload) ? (string) ($payload['action'] ?? '') : '';

if ($action === 'create') {
    $title = trim((string) ($payload['title'] ?? ''));
    $requestId = trim((string) ($payload['requestId'] ?? ''));
    $priority = trim((string) ($payload['priority'] ?? 'Normal'));
    $note = trim((string) ($payload['note'] ?? ''));
    $dueDate = trim((string) ($payload['dueDate'] ?? ''));
    if ($title === '' || strlen($title) > 880 || strlen($note) > 12000) todoResponse(['error' => 'Tapşırığın adı düzgün yazılmalıdır.'], 422);
    if ($dueDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) todoResponse(['error' => 'Son tarix düzgün deyil.'], 422);
    if (!in_array($priority, ['Təcili', 'Yüksək', 'Normal', 'Aşağı'], true)) $priority = 'Normal';
    $recipients = normalizeRecipients($conn, $payload['recipients'] ?? []);
    $todoId = 'TODO-' . date('Ymd') . '-' . bin2hex(random_bytes(5));
    $recipientJson = json_encode($recipients, JSON_UNESCAPED_UNICODE);
    $creatorId = (int) $actor['id']; $creatorName = (string) $actor['username'];
    $statement = $conn->prepare('INSERT INTO erp_todos (id, title, request_id, recipients_json, priority, due_date, note, status, creator_id, creator_username) VALUES (?, ?, ?, ?, ?, NULLIF(?, ""), ?, "PENDING", ?, ?)');
    $statement->bind_param('sssssssis', $todoId, $title, $requestId, $recipientJson, $priority, $dueDate, $note, $creatorId, $creatorName);
    if (!$statement->execute()) { $statement->close(); todoResponse(['error' => 'Tapşırıq yaradıla bilmədi.'], 500); }
    $statement->close();
    addTodoHistory($conn, $todoId, $actor, 'CREATE', 'PENDING');
    todoResponse(['ok' => true, 'todos' => fetchVisibleTodos($conn, $actor)]);
}

$todoId = trim((string) ($payload['id'] ?? ''));
if ($todoId === '') todoResponse(['error' => 'Tapşırıq seçilməyib.'], 422);
$find = $conn->prepare('SELECT recipients_json, creator_id FROM erp_todos WHERE id = ? LIMIT 1');
$find->bind_param('s', $todoId); $find->execute(); $todo = $find->get_result()->fetch_assoc(); $find->close();
if (!$todo) todoResponse(['error' => 'Tapşırıq tapılmadı.'], 404);
$recipientList = json_decode((string) $todo['recipients_json'], true) ?: [];
$isCreator = (int) $todo['creator_id'] === (int) $actor['id'];
$isRecipient = (in_array('ALL', $recipientList, true) && (int) $todo['creator_id'] !== (int) $actor['id']) || in_array((string) $actor['username'], $recipientList, true);
if (!$isCreator && !$isRecipient) todoResponse(['error' => 'Bu tapşırığa girişiniz yoxdur.'], 403);

if ($action === 'status') {
    $status = (string) ($payload['status'] ?? '');
    if (!in_array($status, ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'], true)) todoResponse(['error' => 'Status düzgün deyil.'], 422);
    $completedAt = $status === 'COMPLETED' ? date('Y-m-d H:i:s') : null;
    $actorName = (string) $actor['username'];
    $statement = $conn->prepare('UPDATE erp_todos SET status = ?, completed_at = ?, accepted_by = CASE WHEN ? = "ACCEPTED" AND (accepted_by IS NULL OR accepted_by = "") THEN ? ELSE accepted_by END, accepted_at = CASE WHEN ? = "ACCEPTED" AND accepted_at IS NULL THEN NOW() ELSE accepted_at END WHERE id = ?');
    $statement->bind_param('ssssss', $status, $completedAt, $status, $actorName, $status, $todoId);
    $statement->execute(); $statement->close();
    addTodoHistory($conn, $todoId, $actor, 'STATUS', $status);
    todoResponse(['ok' => true, 'todos' => fetchVisibleTodos($conn, $actor)]);
}

if ($action === 'delete') {
    if (!$isCreator) todoResponse(['error' => 'Tapşırığı yalnız yaradan istifadəçi silə bilər.'], 403);
    $statement = $conn->prepare('DELETE FROM erp_todos WHERE id = ?');
    $statement->bind_param('s', $todoId); $statement->execute(); $statement->close();
    addTodoHistory($conn, $todoId, $actor, 'DELETE', '');
    todoResponse(['ok' => true, 'todos' => fetchVisibleTodos($conn, $actor)]);
}

todoResponse(['error' => 'Naməlum əməliyyat.'], 400);
