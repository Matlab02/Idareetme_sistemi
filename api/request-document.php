<?php
declare(strict_types=1);

header('Cache-Control: no-store, private');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/protect.php';

const REQUEST_DOCUMENT_MAX_BYTES = 12 * 1024 * 1024;
const REQUEST_DOCUMENT_TYPES = ['DELIVERY_HANDOVER', 'PRICE_AGREEMENT', 'INVOICE'];
const REQUEST_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'];

function requestDocumentJson(array $payload, int $status = 200): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function requestDocumentSafeName(string $name): string { $name = basename(str_replace('\\', '/', $name)); $name = preg_replace('/[\r\n"\\\\]/', '', $name) ?? 'sənəd'; return trim($name) !== '' ? trim($name) : 'sənəd'; }

$create = "CREATE TABLE IF NOT EXISTS erp_request_documents (
    id CHAR(32) NOT NULL PRIMARY KEY,
    request_id VARCHAR(80) NOT NULL,
    document_type VARCHAR(32) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    size_bytes INT UNSIGNED NOT NULL,
    file_blob LONGBLOB NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request_document (request_id, document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
if (!$conn->query($create)) requestDocumentJson(['ok' => false, 'error' => 'Sənəd cədvəli hazırlana bilmədi.'], 500);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = (string) ($_GET['id'] ?? '');
    if (!preg_match('/^[a-f0-9]{32}$/', $id)) requestDocumentJson(['ok' => false, 'error' => 'Sənəd açarı düzgün deyil.'], 400);
    $statement = $conn->prepare('SELECT filename, mime_type, size_bytes, file_blob FROM erp_request_documents WHERE id = ? LIMIT 1');
    if (!$statement) requestDocumentJson(['ok' => false, 'error' => 'Sənəd sorğusu hazırlana bilmədi.'], 500);
    $statement->bind_param('s', $id); $statement->execute(); $result = $statement->get_result(); $document = $result ? $result->fetch_assoc() : null; $statement->close();
    if (!$document) requestDocumentJson(['ok' => false, 'error' => 'Sənəd tapılmadı.'], 404);
    $filename = requestDocumentSafeName((string) $document['filename']);
    header('Content-Type: ' . ((string) $document['mime_type'] ?: 'application/octet-stream'));
    header('Content-Length: ' . (string) $document['size_bytes']);
    header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($filename));
    echo $document['file_blob']; exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') requestDocumentJson(['ok' => false, 'error' => 'İcazə verilməyən əməliyyat.'], 405);
$requestId = (string) ($_POST['requestId'] ?? ''); $type = (string) ($_POST['type'] ?? ''); $file = $_FILES['file'] ?? null;
if (!preg_match('/^[A-Za-z0-9_-]{3,80}$/', $requestId) || !in_array($type, REQUEST_DOCUMENT_TYPES, true)) requestDocumentJson(['ok' => false, 'error' => 'Sorğu və ya sənəd növü düzgün deyil.'], 422);
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string) ($file['tmp_name'] ?? ''))) requestDocumentJson(['ok' => false, 'error' => 'Fayl yüklənmədi.'], 422);
if ((int) $file['size'] < 1 || (int) $file['size'] > REQUEST_DOCUMENT_MAX_BYTES) requestDocumentJson(['ok' => false, 'error' => 'Faylın həcmi 12 MB-dan çox ola bilməz.'], 422);

$filename = requestDocumentSafeName((string) $file['name']); $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
if (!in_array($extension, REQUEST_DOCUMENT_EXTENSIONS, true)) requestDocumentJson(['ok' => false, 'error' => 'Bu fayl formatı dəstəklənmir.'], 422);
$content = file_get_contents((string) $file['tmp_name']);
if ($content === false) requestDocumentJson(['ok' => false, 'error' => 'Fayl oxuna bilmədi.'], 500);
$mime = function_exists('finfo_open') ? ((new finfo(FILEINFO_MIME_TYPE))->file((string) $file['tmp_name']) ?: 'application/octet-stream') : ((string) $file['type'] ?: 'application/octet-stream');
$id = bin2hex(random_bytes(16)); $size = (int) $file['size'];
$statement = $conn->prepare('INSERT INTO erp_request_documents (id, request_id, document_type, filename, mime_type, size_bytes, file_blob) VALUES (?, ?, ?, ?, ?, ?, ?)');
if (!$statement) requestDocumentJson(['ok' => false, 'error' => 'Sənəd yazısı hazırlana bilmədi.'], 500);
$statement->bind_param('sssssis', $id, $requestId, $type, $filename, $mime, $size, $content);
if (!$statement->execute()) { $statement->close(); requestDocumentJson(['ok' => false, 'error' => 'Sənəd verilənlər bazasına yazılmadı.'], 500); }
$statement->close();

$replaceDocumentId = (string) ($_POST['replaceDocumentId'] ?? '');
if (preg_match('/^[a-f0-9]{32}$/', $replaceDocumentId)) { $remove = $conn->prepare('DELETE FROM erp_request_documents WHERE id = ?'); if ($remove) { $remove->bind_param('s', $replaceDocumentId); $remove->execute(); $remove->close(); } }
requestDocumentJson(['ok' => true, 'document' => ['documentId' => $id, 'filename' => $filename, 'mimeType' => $mime, 'size' => $size, 'uploadedAt' => date('c')]]);
