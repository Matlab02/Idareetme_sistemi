<?php
declare(strict_types=1);

/**
 * AzPlom ERP Mail Center
 *
 * The mailbox password is encrypted at rest in a file outside public_html.
 * Messages, links and attachment metadata are held in dedicated tables rather
 * than the shared ERP state blob.
 */

header('Cache-Control: no-store, private');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/protect.php';

$conn->set_charset('utf8mb4');

const MAIL_MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAIL_MAX_ATTACHMENTS = 10;

function mailJson(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function mailFail(string $message, int $status = 400): never
{
    mailJson(['ok' => false, 'error' => $message], $status);
}

function mailHome(): string
{
    // /home/<cpanel-user>/public_html/api -> /home/<cpanel-user>
    return dirname(__DIR__, 2);
}

function mailLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}

function mailSlice(string $value, int $start, int $length): string
{
    return function_exists('mb_substr') ? mb_substr($value, $start, $length) : substr($value, $start, $length);
}

function mailLower(string $value): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($value) : strtolower($value);
}

function mailConfigPath(): string
{
    return mailHome() . '/.erp-mail-config.json';
}

function mailKeyPath(): string
{
    return mailHome() . '/.erp-mail-key';
}

function mailStoragePath(): string
{
    return mailHome() . '/erp-mail-storage';
}

function mailEnsureDir(string $path): void
{
    if (is_dir($path)) {
        return;
    }
    if (!@mkdir($path, 0700, true) && !is_dir($path)) {
        throw new RuntimeException('Mail storage could not be created.');
    }
    @chmod($path, 0700);
}

function mailEncryptionKey(): string
{
    $path = mailKeyPath();
    if (is_file($path)) {
        $stored = trim((string) @file_get_contents($path));
        $key = base64_decode($stored, true);
        if (is_string($key) && strlen($key) === 32) {
            return $key;
        }
    }

    $key = random_bytes(32);
    if (@file_put_contents($path, base64_encode($key), LOCK_EX) === false) {
        throw new RuntimeException('Mail encryption key could not be stored.');
    }
    @chmod($path, 0600);
    return $key;
}

function mailEncryptSecret(string $value): string
{
    if (!function_exists('openssl_encrypt')) {
        throw new RuntimeException('OpenSSL is required for secure mail settings.');
    }
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($value, 'aes-256-gcm', mailEncryptionKey(), OPENSSL_RAW_DATA, $iv, $tag);
    if (!is_string($cipher) || strlen($tag) !== 16) {
        throw new RuntimeException('Mail settings could not be encrypted.');
    }
    return base64_encode($iv . $tag . $cipher);
}

function mailDecryptSecret(string $value): string
{
    if (!function_exists('openssl_decrypt')) {
        return '';
    }
    $raw = base64_decode($value, true);
    if (!is_string($raw) || strlen($raw) < 29) {
        return '';
    }
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', mailEncryptionKey(), OPENSSL_RAW_DATA, $iv, $tag);
    return is_string($plain) ? $plain : '';
}

function mailLoadConfig(): array
{
    $path = mailConfigPath();
    if (!is_file($path)) {
        return [];
    }

    $decoded = json_decode((string) @file_get_contents($path), true);
    if (!is_array($decoded)) {
        return [];
    }

    foreach (['imap', 'smtp'] as $transport) {
        if (isset($decoded[$transport]['password'])) {
            $decoded[$transport]['password'] = mailDecryptSecret((string) $decoded[$transport]['password']);
        }
    }
    return $decoded;
}

function mailConfigPublic(array $config): array
{
    if ($config === []) {
        return [
            'configured' => false,
            'email' => 'info@azplom.com',
            'displayName' => 'AzPlom',
        ];
    }

    return [
        'configured' => !empty($config['imap']['host']) && !empty($config['smtp']['host'])
            && !empty($config['imap']['password']) && !empty($config['smtp']['password']),
        'email' => (string) ($config['email'] ?? 'info@azplom.com'),
        'displayName' => (string) ($config['displayName'] ?? 'AzPlom'),
        'imap' => [
            'host' => (string) ($config['imap']['host'] ?? ''),
            'port' => (int) ($config['imap']['port'] ?? 0),
            'encryption' => (string) ($config['imap']['encryption'] ?? 'ssl'),
            'username' => (string) ($config['imap']['username'] ?? ''),
            'passwordSaved' => !empty($config['imap']['password']),
        ],
        'smtp' => [
            'host' => (string) ($config['smtp']['host'] ?? ''),
            'port' => (int) ($config['smtp']['port'] ?? 0),
            'encryption' => (string) ($config['smtp']['encryption'] ?? 'ssl'),
            'username' => (string) ($config['smtp']['username'] ?? ''),
            'passwordSaved' => !empty($config['smtp']['password']),
        ],
        'updatedAt' => (string) ($config['updatedAt'] ?? ''),
    ];
}

function mailSafeHost(mixed $value): string
{
    $host = strtolower(trim((string) $value));
    if (!preg_match('/^[a-z0-9.-]{1,253}$/', $host) || str_contains($host, '..')) {
        throw new InvalidArgumentException('Server adı düzgün deyil.');
    }
    return $host;
}

function mailSafePort(mixed $value): int
{
    $port = (int) $value;
    if ($port < 1 || $port > 65535) {
        throw new InvalidArgumentException('Port düzgün deyil.');
    }
    return $port;
}

function mailSafeEncryption(mixed $value): string
{
    $value = strtolower(trim((string) $value));
    if (!in_array($value, ['ssl', 'tls', 'none'], true)) {
        throw new InvalidArgumentException('Şifrələmə növü düzgün deyil.');
    }
    return $value;
}

function mailSafeEmail(mixed $value, string $label = 'E-poçt'): string
{
    $email = strtolower(trim((string) $value));
    if (str_contains($email, "\r") || str_contains($email, "\n") || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException($label . ' düzgün deyil.');
    }
    return $email;
}

function mailSaveConfig(array $input, array $current): array
{
    $email = mailSafeEmail($input['email'] ?? ($current['email'] ?? ''), 'Poçt ünvanı');
    $displayName = trim((string) ($input['displayName'] ?? ($current['displayName'] ?? 'AzPlom')));
    if ($displayName === '' || str_contains($displayName, "\r") || str_contains($displayName, "\n") || mailLength($displayName) > 120) {
        throw new InvalidArgumentException('Göndərən adı düzgün deyil.');
    }

    $result = [
        'version' => 1,
        'email' => $email,
        'displayName' => $displayName,
        'updatedAt' => gmdate('c'),
        'imap' => [],
        'smtp' => [],
    ];

    foreach (['imap', 'smtp'] as $transport) {
        $incoming = is_array($input[$transport] ?? null) ? $input[$transport] : [];
        $existing = is_array($current[$transport] ?? null) ? $current[$transport] : [];
        $password = (string) ($incoming['password'] ?? '');
        if ($password === '') {
            $password = (string) ($existing['password'] ?? '');
        }
        if ($password === '' || strlen($password) > 1024) {
            throw new InvalidArgumentException(strtoupper($transport) . ' parolu daxil edilməlidir.');
        }

        $result[$transport] = [
            'host' => mailSafeHost($incoming['host'] ?? ($existing['host'] ?? '')),
            'port' => mailSafePort($incoming['port'] ?? ($existing['port'] ?? 0)),
            'encryption' => mailSafeEncryption($incoming['encryption'] ?? ($existing['encryption'] ?? 'ssl')),
            'username' => mailSafeEmail($incoming['username'] ?? ($existing['username'] ?? $email), strtoupper($transport) . ' istifadəçi adı'),
            'password' => mailEncryptSecret($password),
        ];
    }

    $json = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || @file_put_contents(mailConfigPath(), $json, LOCK_EX) === false) {
        throw new RuntimeException('Mail parametrləri yadda saxlanmadı.');
    }
    @chmod(mailConfigPath(), 0600);

    return mailLoadConfig();
}

function mailPayload(): array
{
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_starts_with($contentType, 'application/json')) {
        $decoded = json_decode((string) file_get_contents('php://input'), true);
        return is_array($decoded) ? $decoded : [];
    }
    return is_array($_POST) ? $_POST : [];
}

function mailPrepared(mysqli $conn, string $sql, string $types = '', array $values = []): mysqli_stmt
{
    $statement = $conn->prepare($sql);
    if (!$statement) {
        throw new RuntimeException('Mail database query could not be prepared.');
    }
    if ($types !== '') {
        $params = [$types];
        foreach ($values as $key => $value) {
            $params[] =& $values[$key];
        }
        call_user_func_array([$statement, 'bind_param'], $params);
    }
    if (!$statement->execute()) {
        throw new RuntimeException('Mail database query could not be executed.');
    }
    return $statement;
}

function mailEnsureSchema(mysqli $conn): void
{
    $queries = [
        "CREATE TABLE IF NOT EXISTS erp_mail_threads (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            thread_key CHAR(64) NOT NULL,
            subject VARCHAR(998) NOT NULL DEFAULT '',
            latest_at DATETIME NULL,
            last_message_id BIGINT UNSIGNED NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY erp_mail_threads_key (thread_key),
            KEY erp_mail_threads_latest (latest_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS erp_mail_messages (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            source_key CHAR(64) NOT NULL,
            message_id VARCHAR(512) NULL,
            in_reply_to VARCHAR(512) NULL,
            thread_key CHAR(64) NOT NULL,
            mail_folder VARCHAR(24) NOT NULL DEFAULT 'INBOX',
            direction VARCHAR(16) NOT NULL DEFAULT 'INCOMING',
            sender_name VARCHAR(255) NOT NULL DEFAULT '',
            sender_email VARCHAR(320) NOT NULL DEFAULT '',
            recipient_data LONGTEXT NULL,
            cc_data LONGTEXT NULL,
            bcc_data LONGTEXT NULL,
            subject VARCHAR(998) NOT NULL DEFAULT '',
            snippet VARCHAR(500) NOT NULL DEFAULT '',
            body_text MEDIUMTEXT NULL,
            body_html MEDIUMTEXT NULL,
            received_at DATETIME NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            is_starred TINYINT(1) NOT NULL DEFAULT 0,
            is_archived TINYINT(1) NOT NULL DEFAULT 0,
            is_trashed TINYINT(1) NOT NULL DEFAULT 0,
            has_attachments TINYINT(1) NOT NULL DEFAULT 0,
            remote_uid BIGINT UNSIGNED NULL,
            remote_folder VARCHAR(255) NULL,
            delivery_status VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
            metadata LONGTEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY erp_mail_messages_source (source_key),
            KEY erp_mail_messages_folder (mail_folder, is_trashed, received_at),
            KEY erp_mail_messages_thread (thread_key, received_at),
            KEY erp_mail_messages_message_id (message_id(191)),
            KEY erp_mail_messages_sender (sender_email(191)),
            KEY erp_mail_messages_remote (remote_folder(191), remote_uid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS erp_mail_attachments (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            message_id BIGINT UNSIGNED NOT NULL,
            original_name VARCHAR(512) NOT NULL,
            storage_key VARCHAR(512) NOT NULL,
            mime_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
            size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY erp_mail_attachments_message (message_id),
            UNIQUE KEY erp_mail_attachments_storage (storage_key(191))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS erp_mail_links (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            message_id BIGINT UNSIGNED NOT NULL,
            entity_type VARCHAR(64) NOT NULL,
            entity_id VARCHAR(128) NOT NULL,
            label VARCHAR(255) NOT NULL DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY erp_mail_links_unique (message_id, entity_type, entity_id),
            KEY erp_mail_links_entity (entity_type, entity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS erp_mail_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_type VARCHAR(64) NOT NULL,
            message_id BIGINT UNSIGNED NULL,
            details LONGTEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY erp_mail_events_message (message_id),
            KEY erp_mail_events_type (event_type, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];

    foreach ($queries as $query) {
        if (!$conn->query($query)) {
            throw new RuntimeException('Mail database tables could not be initialized.');
        }
    }
}

function mailEvent(mysqli $conn, string $type, ?int $messageId = null, array $details = []): void
{
    $json = json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt = mailPrepared(
        $conn,
        'INSERT INTO erp_mail_events (event_type, message_id, details) VALUES (?, ?, ?)',
        'sis',
        [$type, $messageId, $json ?: '{}']
    );
    $stmt->close();
}

function mailFolder(string $folder): string
{
    $folder = strtoupper(trim($folder));
    $allowed = ['INBOX', 'SENT', 'DRAFTS', 'ARCHIVE', 'SPAM', 'TRASH', 'OUTBOX', 'STARRED', 'ALL'];
    return in_array($folder, $allowed, true) ? $folder : 'INBOX';
}

function mailDecodeHeader(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }
    if (function_exists('iconv_mime_decode')) {
        $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
        if (is_string($decoded)) {
            return trim($decoded);
        }
    }
    return trim($value);
}

function mailHeaders(string $headerBlock): array
{
    $lines = preg_split('/\r?\n/', $headerBlock) ?: [];
    $unfolded = [];
    foreach ($lines as $line) {
        if ($line !== '' && preg_match('/^[ \t]/', $line) && $unfolded !== []) {
            $unfolded[count($unfolded) - 1] .= ' ' . trim($line);
        } else {
            $unfolded[] = $line;
        }
    }

    $headers = [];
    foreach ($unfolded as $line) {
        $position = strpos($line, ':');
        if ($position === false) {
            continue;
        }
        $key = strtolower(trim(substr($line, 0, $position)));
        $value = trim(substr($line, $position + 1));
        $headers[$key] = isset($headers[$key]) ? $headers[$key] . ', ' . $value : $value;
    }
    return $headers;
}

function mailSplitHeaderBody(string $raw): array
{
    $parts = preg_split("/\r?\n\r?\n/", $raw, 2);
    return [(string) ($parts[0] ?? ''), (string) ($parts[1] ?? '')];
}

function mailHeaderParam(string $value, string $name): string
{
    if (preg_match('/(?:^|;)\s*' . preg_quote($name, '/') . '\*?\s*=\s*(?:"([^"]*)"|([^;\s]*))/i', $value, $match)) {
        $found = $match[1] !== '' ? $match[1] : ($match[2] ?? '');
        $found = preg_replace("/^[^']*'[^']*'/", '', $found) ?? $found;
        return rawurldecode(trim($found));
    }
    return '';
}

function mailDecodeTransfer(string $body, string $encoding): string
{
    $encoding = strtolower(trim($encoding));
    if ($encoding === 'base64') {
        $decoded = base64_decode(preg_replace('/\s+/', '', $body) ?? '', true);
        return is_string($decoded) ? $decoded : '';
    }
    if ($encoding === 'quoted-printable') {
        return quoted_printable_decode($body);
    }
    return $body;
}

function mailParseMime(array $headers, string $body, array &$plain, array &$html, array &$attachments): void
{
    $contentTypeHeader = (string) ($headers['content-type'] ?? 'text/plain');
    $contentType = strtolower(trim(explode(';', $contentTypeHeader, 2)[0]));
    $disposition = strtolower((string) ($headers['content-disposition'] ?? ''));
    $boundary = mailHeaderParam($contentTypeHeader, 'boundary');

    if (str_starts_with($contentType, 'multipart/') && $boundary !== '') {
        $segments = explode('--' . $boundary, $body);
        array_shift($segments);
        foreach ($segments as $segment) {
            if (str_starts_with($segment, '--')) {
                break;
            }
            $segment = ltrim($segment, "\r\n");
            [$childHead, $childBody] = mailSplitHeaderBody($segment);
            if ($childHead === '') {
                continue;
            }
            mailParseMime(mailHeaders($childHead), $childBody, $plain, $html, $attachments);
        }
        return;
    }

    $filename = mailHeaderParam($disposition, 'filename');
    if ($filename === '') {
        $filename = mailHeaderParam($contentTypeHeader, 'name');
    }
    $decoded = mailDecodeTransfer($body, (string) ($headers['content-transfer-encoding'] ?? ''));
    $isAttachment = $filename !== '' || str_contains($disposition, 'attachment');
    if ($isAttachment) {
        if ($decoded !== '') {
            $attachments[] = [
                'name' => mailDecodeHeader($filename !== '' ? $filename : 'attachment'),
                'mime' => $contentType !== '' ? $contentType : 'application/octet-stream',
                'data' => $decoded,
            ];
        }
        return;
    }

    if ($contentType === 'text/html') {
        $html[] = $decoded;
    } elseif ($contentType === 'text/plain' || str_starts_with($contentType, 'text/')) {
        $plain[] = $decoded;
    }
}

function mailParseAddresses(string $value): array
{
    $result = [];
    if ($value === '') {
        return $result;
    }

    preg_match_all('/(?:"?([^"<>,]+)"?\s*)?<\s*([^<>\s]+@[^<>\s]+)\s*>|([a-z0-9.!#$%&\'*+\/=?^_`{|}~-]+@[a-z0-9.-]+)/iu', $value, $matches, PREG_SET_ORDER);
    foreach ($matches as $match) {
        $bracketEmail = (string) ($match[2] ?? '');
        $email = strtolower(trim($bracketEmail !== '' ? $bracketEmail : (string) ($match[3] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        $name = mailDecodeHeader(trim((string) ($match[1] ?? '')));
        $result[$email] = ['name' => $name, 'email' => $email];
    }
    return array_values($result);
}

function mailFirstAddress(array $addresses): array
{
    return $addresses[0] ?? ['name' => '', 'email' => ''];
}

function mailCleanText(string $text, int $limit = 0): string
{
    $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/\s+/u', ' ', trim($text)) ?? trim($text);
    if ($limit > 0 && mailLength($text) > $limit) {
        return mailSlice($text, 0, $limit - 1) . '…';
    }
    return $text;
}

function mailNormalizeMessageId(string $value): string
{
    if (preg_match('/<[^>]+>/', $value, $match)) {
        return strtolower($match[0]);
    }
    return strtolower(trim($value));
}

function mailThreadKey(mysqli $conn, array $headers, string $subject, string $senderEmail): string
{
    $reply = mailNormalizeMessageId((string) ($headers['in-reply-to'] ?? ''));
    $references = (string) ($headers['references'] ?? '');
    if ($reply === '' && preg_match_all('/<[^>]+>/', $references, $matches) && $matches[0] !== []) {
        $reply = strtolower((string) end($matches[0]));
    }

    if ($reply !== '') {
        $stmt = mailPrepared($conn, 'SELECT thread_key FROM erp_mail_messages WHERE message_id = ? LIMIT 1', 's', [$reply]);
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (is_array($row) && !empty($row['thread_key'])) {
            return (string) $row['thread_key'];
        }
        return hash('sha256', 'reply:' . $reply);
    }

    $normalized = preg_replace('/^(?:(?:re|fw|fwd)\s*:\s*)+/iu', '', trim($subject)) ?? trim($subject);
    return hash('sha256', 'subject:' . mailLower($normalized) . '|from:' . strtolower($senderEmail));
}

function mailUpsertThread(mysqli $conn, string $threadKey, string $subject, string $date, int $messageId): void
{
    $stmt = mailPrepared(
        $conn,
        'INSERT INTO erp_mail_threads (thread_key, subject, latest_at, last_message_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE subject = VALUES(subject), latest_at = GREATEST(COALESCE(latest_at, VALUES(latest_at)), VALUES(latest_at)), last_message_id = VALUES(last_message_id)',
        'sssi',
        [$threadKey, mailSlice($subject, 0, 998), $date, $messageId]
    );
    $stmt->close();
}

function mailInsertMessage(mysqli $conn, array $record): int
{
    $fields = [
        'source_key', 'message_id', 'in_reply_to', 'thread_key', 'mail_folder', 'direction', 'sender_name', 'sender_email',
        'recipient_data', 'cc_data', 'bcc_data', 'subject', 'snippet', 'body_text', 'body_html', 'received_at', 'is_read',
        'is_starred', 'is_archived', 'is_trashed', 'has_attachments', 'remote_uid', 'remote_folder', 'delivery_status', 'metadata',
    ];
    $values = [];
    foreach ($fields as $field) {
        $values[] = $record[$field] ?? null;
    }
    $types = str_repeat('s', 16) . 'iiiii' . 'i' . 'sss';
    $placeholders = implode(',', array_fill(0, count($fields), '?'));
    $stmt = mailPrepared(
        $conn,
        'INSERT INTO erp_mail_messages (' . implode(',', $fields) . ') VALUES (' . $placeholders . ')',
        $types,
        $values
    );
    $id = (int) $stmt->insert_id;
    $stmt->close();
    return $id;
}

function mailSafeFilename(string $name): string
{
    $name = trim(str_replace(["\0", '/', '\\'], '', $name));
    $name = preg_replace('/[^\pL\pN.() _-]+/u', '-', $name) ?? 'attachment';
    $name = trim($name, '. ');
    return $name !== '' ? mailSlice($name, 0, 180) : 'attachment';
}

function mailAttachmentMime(string $bytes, string $fallback): string
{
    if (function_exists('finfo_open')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $type = $finfo->buffer($bytes);
        if (is_string($type) && $type !== '') {
            return $type;
        }
    }
    return $fallback !== '' ? $fallback : 'application/octet-stream';
}

function mailStoreAttachment(mysqli $conn, int $messageId, string $name, string $bytes, string $fallbackMime = ''): void
{
    if ($bytes === '' || strlen($bytes) > MAIL_MAX_ATTACHMENT_BYTES) {
        return;
    }
    $name = mailSafeFilename($name);
    $dir = mailStoragePath() . '/attachments/' . $messageId;
    mailEnsureDir($dir);
    $hash = hash('sha256', $bytes);
    $diskName = $hash . '-' . bin2hex(random_bytes(4)) . '-' . $name;
    $path = $dir . '/' . $diskName;
    if (!is_file($path) && @file_put_contents($path, $bytes, LOCK_EX) === false) {
        throw new RuntimeException('Mail attachment could not be stored.');
    }
    @chmod($path, 0600);
    $storageKey = 'attachments/' . $messageId . '/' . $diskName;
    $mime = mailAttachmentMime($bytes, $fallbackMime);
    $size = strlen($bytes);
    $stmt = mailPrepared(
        $conn,
        'INSERT INTO erp_mail_attachments (message_id, original_name, storage_key, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)',
        'isssi',
        [$messageId, $name, $storageKey, $mime, $size]
    );
    $stmt->close();
}

function mailStoreLinks(mysqli $conn, int $messageId, mixed $links): void
{
    if (is_string($links)) {
        $decoded = json_decode($links, true);
        $links = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($links)) {
        return;
    }
    $allowed = ['REQUEST', 'CUSTOMER', 'SUPPLIER', 'QUOTATION', 'PURCHASE_ORDER', 'SALES_ORDER', 'INVOICE', 'PAYMENT', 'DOCUMENT'];
    foreach (array_slice($links, 0, 10) as $link) {
        if (!is_array($link)) {
            continue;
        }
        $type = strtoupper(trim((string) ($link['entityType'] ?? '')));
        $entityId = trim((string) ($link['entityId'] ?? ''));
        $label = trim((string) ($link['label'] ?? ''));
        if (!in_array($type, $allowed, true) || $entityId === '' || mailLength($entityId) > 128) {
            continue;
        }
        $stmt = mailPrepared(
            $conn,
            'INSERT IGNORE INTO erp_mail_links (message_id, entity_type, entity_id, label) VALUES (?, ?, ?, ?)',
            'isss',
            [$messageId, $type, $entityId, mailSlice($label, 0, 255)]
        );
        $stmt->close();
    }
}

function mailParseRaw(mysqli $conn, string $raw): array
{
    [$head, $body] = mailSplitHeaderBody($raw);
    $headers = mailHeaders($head);
    $plain = [];
    $html = [];
    $attachments = [];
    mailParseMime($headers, $body, $plain, $html, $attachments);

    $from = mailFirstAddress(mailParseAddresses((string) ($headers['from'] ?? '')));
    $to = mailParseAddresses((string) ($headers['to'] ?? ''));
    $cc = mailParseAddresses((string) ($headers['cc'] ?? ''));
    $bodyText = trim(implode("\n\n", $plain));
    $bodyHtml = trim(implode("\n", $html));
    if ($bodyText === '' && $bodyHtml !== '') {
        $bodyText = mailCleanText($bodyHtml);
    }
    $subject = mailDecodeHeader((string) ($headers['subject'] ?? '(Mövzusuz)'));
    $receivedAt = strtotime((string) ($headers['date'] ?? ''));

    return [
        'headers' => $headers,
        'messageId' => mailNormalizeMessageId((string) ($headers['message-id'] ?? '')),
        'inReplyTo' => mailNormalizeMessageId((string) ($headers['in-reply-to'] ?? '')),
        'senderName' => (string) ($from['name'] ?? ''),
        'senderEmail' => (string) ($from['email'] ?? ''),
        'to' => $to,
        'cc' => $cc,
        'subject' => $subject,
        'bodyText' => $bodyText,
        'bodyHtml' => $bodyHtml,
        'snippet' => mailCleanText($bodyText, 500),
        'receivedAt' => date('Y-m-d H:i:s', $receivedAt !== false ? $receivedAt : time()),
        'attachments' => $attachments,
    ];
}

function mailRemoteFolder(string $remote): string
{
    $name = mailLower($remote);
    if ($remote === 'INBOX') {
        return 'INBOX';
    }
    if (preg_match('/sent|göndər|gonder/', $name)) {
        return 'SENT';
    }
    if (preg_match('/draft|qaralama/', $name)) {
        return 'DRAFTS';
    }
    if (preg_match('/trash|deleted|zibil/', $name)) {
        return 'TRASH';
    }
    if (preg_match('/spam|junk/', $name)) {
        return 'SPAM';
    }
    if (preg_match('/archive|arxiv/', $name)) {
        return 'ARCHIVE';
    }
    return 'INBOX';
}

function mailImapName(array $imap, string $folder): string
{
    $flags = '/imap';
    $encryption = (string) ($imap['encryption'] ?? 'ssl');
    if ($encryption === 'ssl') {
        $flags .= '/ssl';
    } elseif ($encryption === 'tls') {
        $flags .= '/tls';
    } else {
        $flags .= '/notls';
    }
    return '{' . $imap['host'] . ':' . (int) $imap['port'] . $flags . '}' . $folder;
}

function mailImapFolders(array $config): array
{
    $imap = $config['imap'];
    $stream = @imap_open(mailImapName($imap, 'INBOX'), (string) $imap['username'], (string) $imap['password'], OP_READONLY, 1);
    if ($stream === false) {
        throw new RuntimeException('IMAP bağlantısı alınmadı. Parametrləri cPanel Connect Devices bölməsindən yoxlayın.');
    }

    $root = mailImapName($imap, '');
    $mailboxes = @imap_list($stream, $root, '*') ?: [];
    $folders = ['INBOX'];
    foreach ($mailboxes as $mailbox) {
        $name = str_replace($root, '', (string) $mailbox);
        if ($name !== '' && !in_array($name, $folders, true)) {
            $folders[] = $name;
        }
    }
    imap_close($stream);
    return array_slice($folders, 0, 12);
}

function mailSync(mysqli $conn, array $config, string $scope = 'recent'): array
{
    if (!function_exists('imap_open')) {
        throw new RuntimeException('Bu hostinqdə PHP IMAP genişlənməsi aktiv deyil.');
    }
    if (empty($config['imap']['password'])) {
        throw new RuntimeException('IMAP parametrləri tamamlanmayıb.');
    }

    $folders = mailImapFolders($config);
    $folderPriority = ['INBOX' => 0, 'SENT' => 1, 'DRAFTS' => 2, 'ARCHIVE' => 3, 'SPAM' => 4, 'TRASH' => 5];
    usort($folders, static function (string $left, string $right) use ($folderPriority): int {
        $leftPriority = $folderPriority[mailRemoteFolder($left)] ?? 9;
        $rightPriority = $folderPriority[mailRemoteFolder($right)] ?? 9;
        return $leftPriority <=> $rightPriority;
    });
    $imported = 0;
    $updated = 0;
    $errors = [];
    $hasMore = false;
    // A per-folder batch keeps the first inbox from blocking Sent and other folders.
    $batchLimit = $scope === 'history' ? 120 : 80;

    foreach ($folders as $remoteFolder) {
        $stream = @imap_open(mailImapName($config['imap'], $remoteFolder), (string) $config['imap']['username'], (string) $config['imap']['password'], OP_READONLY, 1);
        if ($stream === false) {
            $errors[] = $remoteFolder;
            continue;
        }

        $status = @imap_status($stream, mailImapName($config['imap'], $remoteFolder), SA_UIDVALIDITY);
        $uidValidity = (string) ($status->uidvalidity ?? '0');
        $uids = @imap_search($stream, 'ALL', SE_UID);
        $uids = is_array($uids) ? $uids : [];
        rsort($uids, SORT_NUMERIC);

        $scanUids = $scope === 'history' ? $uids : array_slice($uids, 0, 300);
        $folderImported = 0;
        foreach ($scanUids as $uid) {
            $sourceKey = hash('sha256', $config['email'] . '|' . $remoteFolder . '|' . $uidValidity . '|' . $uid);
            $existing = mailPrepared($conn, 'SELECT id FROM erp_mail_messages WHERE source_key = ? LIMIT 1', 's', [$sourceKey]);
            $existingRow = $existing->get_result()->fetch_assoc();
            $existing->close();

            if (is_array($existingRow)) {
                if ($scope === 'history') {
                    continue;
                }
                $overviewList = @imap_fetch_overview($stream, (string) $uid, FT_UID);
                $overview = is_array($overviewList) ? ($overviewList[0] ?? null) : null;
                $isRead = !empty($overview->seen) ? 1 : 0;
                $stmt = mailPrepared(
                    $conn,
                    'UPDATE erp_mail_messages SET is_read = ?, remote_uid = ?, remote_folder = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    'iisi',
                    [$isRead, (int) $uid, $remoteFolder, (int) $existingRow['id']]
                );
                $stmt->close();
                $updated++;
                continue;
            }

            if ($folderImported >= $batchLimit) {
                $hasMore = true;
                break;
            }

            $overviewList = @imap_fetch_overview($stream, (string) $uid, FT_UID);
            $overview = is_array($overviewList) ? ($overviewList[0] ?? null) : null;
            $isRead = !empty($overview->seen) ? 1 : 0;

            $header = (string) @imap_fetchheader($stream, (int) $uid, FT_UID);
            $body = (string) @imap_body($stream, (int) $uid, FT_UID | FT_PEEK);
            if ($header === '') {
                continue;
            }
            $parsed = mailParseRaw($conn, $header . "\r\n" . $body);
            $threadKey = mailThreadKey($conn, $parsed['headers'], $parsed['subject'], $parsed['senderEmail']);
            $folder = mailRemoteFolder($remoteFolder);
            $record = [
                'source_key' => $sourceKey,
                'message_id' => $parsed['messageId'],
                'in_reply_to' => $parsed['inReplyTo'],
                'thread_key' => $threadKey,
                'mail_folder' => $folder,
                'direction' => $folder === 'SENT' ? 'OUTGOING' : 'INCOMING',
                'sender_name' => $parsed['senderName'],
                'sender_email' => $parsed['senderEmail'],
                'recipient_data' => json_encode($parsed['to'], JSON_UNESCAPED_UNICODE),
                'cc_data' => json_encode($parsed['cc'], JSON_UNESCAPED_UNICODE),
                'bcc_data' => '[]',
                'subject' => $parsed['subject'],
                'snippet' => $parsed['snippet'],
                'body_text' => $parsed['bodyText'],
                'body_html' => $parsed['bodyHtml'],
                'received_at' => $parsed['receivedAt'],
                'is_read' => $isRead,
                'is_starred' => 0,
                'is_archived' => $folder === 'ARCHIVE' ? 1 : 0,
                'is_trashed' => $folder === 'TRASH' ? 1 : 0,
                'has_attachments' => $parsed['attachments'] === [] ? 0 : 1,
                'remote_uid' => (int) $uid,
                'remote_folder' => $remoteFolder,
                'delivery_status' => $folder === 'SENT' ? 'SENT' : 'RECEIVED',
                'metadata' => json_encode(['uidValidity' => $uidValidity], JSON_UNESCAPED_UNICODE),
            ];

            $messageId = mailInsertMessage($conn, $record);
            foreach ($parsed['attachments'] as $attachment) {
                mailStoreAttachment($conn, $messageId, (string) $attachment['name'], (string) $attachment['data'], (string) $attachment['mime']);
            }
            mailUpsertThread($conn, $threadKey, $parsed['subject'], $parsed['receivedAt'], $messageId);
            mailEvent($conn, 'SYNC_IMPORT', $messageId, ['folder' => $remoteFolder]);
            $imported++;
            $folderImported++;
        }
        imap_close($stream);
    }

    return ['imported' => $imported, 'updated' => $updated, 'folders' => $folders, 'errors' => $errors, 'scope' => $scope, 'hasMore' => $hasMore, 'batchLimit' => $batchLimit];
}

function mailCounts(mysqli $conn): array
{
    $counts = [
        'INBOX' => ['total' => 0, 'unread' => 0],
        'STARRED' => ['total' => 0, 'unread' => 0],
        'SENT' => ['total' => 0, 'unread' => 0],
        'DRAFTS' => ['total' => 0, 'unread' => 0],
        'ARCHIVE' => ['total' => 0, 'unread' => 0],
        'SPAM' => ['total' => 0, 'unread' => 0],
        'TRASH' => ['total' => 0, 'unread' => 0],
    ];
    $result = $conn->query('SELECT mail_folder, COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread FROM erp_mail_messages WHERE is_trashed = 0 OR mail_folder = \'TRASH\' GROUP BY mail_folder');
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $folder = (string) $row['mail_folder'];
            if (isset($counts[$folder])) {
                $counts[$folder] = ['total' => (int) $row['total'], 'unread' => (int) $row['unread']];
            }
        }
    }
    $starred = $conn->query('SELECT COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread FROM erp_mail_messages WHERE is_starred = 1 AND is_trashed = 0');
    if ($starred && ($row = $starred->fetch_assoc())) {
        $counts['STARRED'] = ['total' => (int) $row['total'], 'unread' => (int) $row['unread']];
    }
    return $counts;
}

function mailMessageSummary(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'threadKey' => (string) $row['thread_key'],
        'folder' => (string) $row['mail_folder'],
        'direction' => (string) $row['direction'],
        'from' => ['name' => (string) $row['sender_name'], 'email' => (string) $row['sender_email']],
        'to' => json_decode((string) $row['recipient_data'], true) ?: [],
        'subject' => (string) $row['subject'],
        'snippet' => (string) $row['snippet'],
        'receivedAt' => (string) $row['received_at'],
        'isRead' => (bool) $row['is_read'],
        'isStarred' => (bool) $row['is_starred'],
        'hasAttachments' => (bool) $row['has_attachments'],
        'deliveryStatus' => (string) $row['delivery_status'],
    ];
}

function mailList(mysqli $conn, array $input): array
{
    $folder = mailFolder((string) ($input['folder'] ?? 'INBOX'));
    $query = trim((string) ($input['q'] ?? ''));
    $limit = max(1, min(100, (int) ($input['limit'] ?? 50)));
    $offset = max(0, (int) ($input['offset'] ?? 0));
    $where = [];
    $types = '';
    $values = [];

    if ($folder === 'STARRED') {
        $where[] = 'is_starred = 1 AND is_trashed = 0';
    } elseif ($folder === 'ALL') {
        $where[] = 'is_trashed = 0';
    } elseif ($folder === 'TRASH') {
        $where[] = "mail_folder = 'TRASH'";
    } else {
        $where[] = 'mail_folder = ? AND is_trashed = 0';
        $types .= 's';
        $values[] = $folder;
    }

    if ($query !== '') {
        $where[] = '(subject LIKE ? OR sender_name LIKE ? OR sender_email LIKE ? OR snippet LIKE ?)';
        $like = '%' . mailSlice($query, 0, 120) . '%';
        $types .= 'ssss';
        array_push($values, $like, $like, $like, $like);
    }

    $types .= 'ii';
    array_push($values, $limit, $offset);
    $statement = mailPrepared(
        $conn,
        'SELECT id, thread_key, mail_folder, direction, sender_name, sender_email, recipient_data, subject, snippet, received_at, is_read, is_starred, has_attachments, delivery_status FROM erp_mail_messages WHERE ' . implode(' AND ', $where) . ' ORDER BY received_at DESC, id DESC LIMIT ? OFFSET ?',
        $types,
        $values
    );
    $result = $statement->get_result();
    $messages = [];
    while ($row = $result->fetch_assoc()) {
        $messages[] = mailMessageSummary($row);
    }
    $statement->close();
    return ['messages' => $messages, 'counts' => mailCounts($conn), 'folder' => $folder];
}

function mailGetMessage(mysqli $conn, int $id): array
{
    $stmt = mailPrepared($conn, 'SELECT * FROM erp_mail_messages WHERE id = ? LIMIT 1', 'i', [$id]);
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Məktub tapılmadı.');
    }

    if ((string) $row['direction'] === 'INCOMING' && !(int) $row['is_read']) {
        $update = mailPrepared($conn, 'UPDATE erp_mail_messages SET is_read = 1 WHERE id = ?', 'i', [$id]);
        $update->close();
        $row['is_read'] = 1;
    }

    $attachments = [];
    $attachmentStmt = mailPrepared($conn, 'SELECT id, original_name, mime_type, size_bytes FROM erp_mail_attachments WHERE message_id = ? ORDER BY id', 'i', [$id]);
    $attachmentRows = $attachmentStmt->get_result();
    while ($attachment = $attachmentRows->fetch_assoc()) {
        $attachments[] = [
            'id' => (int) $attachment['id'],
            'name' => (string) $attachment['original_name'],
            'mimeType' => (string) $attachment['mime_type'],
            'size' => (int) $attachment['size_bytes'],
        ];
    }
    $attachmentStmt->close();

    $links = [];
    $linkStmt = mailPrepared($conn, 'SELECT entity_type, entity_id, label FROM erp_mail_links WHERE message_id = ? ORDER BY id', 'i', [$id]);
    $linkRows = $linkStmt->get_result();
    while ($link = $linkRows->fetch_assoc()) {
        $links[] = ['entityType' => $link['entity_type'], 'entityId' => $link['entity_id'], 'label' => $link['label']];
    }
    $linkStmt->close();

    $thread = [];
    $threadStmt = mailPrepared($conn, 'SELECT id, direction, sender_name, sender_email, subject, snippet, received_at, is_read, has_attachments, delivery_status FROM erp_mail_messages WHERE thread_key = ? AND is_trashed = 0 ORDER BY received_at ASC, id ASC', 's', [(string) $row['thread_key']]);
    $threadRows = $threadStmt->get_result();
    while ($message = $threadRows->fetch_assoc()) {
        $thread[] = [
            'id' => (int) $message['id'],
            'direction' => $message['direction'],
            'from' => ['name' => $message['sender_name'], 'email' => $message['sender_email']],
            'subject' => $message['subject'],
            'snippet' => $message['snippet'],
            'receivedAt' => $message['received_at'],
            'isRead' => (bool) $message['is_read'],
            'hasAttachments' => (bool) $message['has_attachments'],
            'deliveryStatus' => $message['delivery_status'],
        ];
    }
    $threadStmt->close();

    return [
        'message' => array_merge(mailMessageSummary($row), [
            'cc' => json_decode((string) $row['cc_data'], true) ?: [],
            'bcc' => json_decode((string) $row['bcc_data'], true) ?: [],
            'bodyText' => (string) $row['body_text'],
            'htmlAvailable' => (string) $row['body_html'] !== '',
            'attachments' => $attachments,
            'links' => $links,
            'inReplyTo' => (string) $row['in_reply_to'],
        ]),
        'thread' => $thread,
        'counts' => mailCounts($conn),
    ];
}

function mailApplyUpdate(mysqli $conn, array $input): array
{
    $ids = $input['ids'] ?? ($input['id'] ?? []);
    if (!is_array($ids)) {
        $ids = [$ids];
    }
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0)));
    if ($ids === []) {
        throw new InvalidArgumentException('Məktub seçilməyib.');
    }
    $mode = (string) ($input['mode'] ?? '');
    $allowed = ['read', 'unread', 'star', 'unstar', 'archive', 'trash', 'restore', 'spam', 'inbox'];
    if (!in_array($mode, $allowed, true)) {
        throw new InvalidArgumentException('Məktub əməliyyatı düzgün deyil.');
    }

    $updates = match ($mode) {
        'read' => 'is_read = 1',
        'unread' => 'is_read = 0',
        'star' => 'is_starred = 1',
        'unstar' => 'is_starred = 0',
        'archive' => "mail_folder = 'ARCHIVE', is_archived = 1, is_trashed = 0",
        'trash' => "mail_folder = 'TRASH', is_trashed = 1",
        'restore', 'inbox' => "mail_folder = 'INBOX', is_archived = 0, is_trashed = 0",
        'spam' => "mail_folder = 'SPAM', is_trashed = 0",
    };

    foreach ($ids as $id) {
        $stmt = mailPrepared($conn, 'UPDATE erp_mail_messages SET ' . $updates . ', updated_at = CURRENT_TIMESTAMP WHERE id = ?', 'i', [$id]);
        $stmt->close();
        mailEvent($conn, 'MESSAGE_' . strtoupper($mode), $id);
    }
    return ['updated' => count($ids), 'counts' => mailCounts($conn)];
}

function mailUploadItems(): array
{
    $files = $_FILES['attachments'] ?? null;
    if (!is_array($files) || !isset($files['name'])) {
        return [];
    }
    $items = [];
    $names = is_array($files['name']) ? $files['name'] : [$files['name']];
    $tmpNames = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
    $errors = is_array($files['error']) ? $files['error'] : [$files['error']];
    $types = is_array($files['type']) ? $files['type'] : [$files['type']];
    $sizes = is_array($files['size']) ? $files['size'] : [$files['size']];
    foreach ($names as $index => $name) {
        if (($errors[$index] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if (($errors[$index] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException('Qoşmanın yüklənməsi uğursuz oldu.');
        }
        $size = (int) ($sizes[$index] ?? 0);
        if ($size <= 0 || $size > MAIL_MAX_ATTACHMENT_BYTES) {
            throw new InvalidArgumentException('Hər qoşma maksimum 12 MB ola bilər.');
        }
        $content = @file_get_contents((string) ($tmpNames[$index] ?? ''));
        if (!is_string($content)) {
            throw new RuntimeException('Qoşma oxunmadı.');
        }
        $items[] = ['name' => (string) $name, 'mime' => (string) ($types[$index] ?? ''), 'data' => $content];
    }
    if (count($items) > MAIL_MAX_ATTACHMENTS) {
        throw new InvalidArgumentException('Bir məktuba ən çox 10 qoşma əlavə edilə bilər.');
    }
    return $items;
}

function mailRecipientInput(mixed $value): array
{
    if (is_array($value)) {
        $value = implode(',', array_map(static fn (mixed $item): string => is_string($item) ? $item : '', $value));
    }
    return mailParseAddresses((string) $value);
}

function mailHeaderAddress(array $address): string
{
    $email = mailSafeEmail($address['email'] ?? '');
    $name = trim((string) ($address['name'] ?? ''));
    return $name !== '' ? '"' . addcslashes($name, "\\\"") . '" <' . $email . '>' : $email;
}

function mailBuildOutgoing(array $config, array $record, array $attachments, ?array $reply): string
{
    $from = mailHeaderAddress(['name' => $config['displayName'], 'email' => $config['email']]);
    $to = implode(', ', array_map('mailHeaderAddress', $record['to']));
    $cc = implode(', ', array_map('mailHeaderAddress', $record['cc']));
    $messageId = (string) $record['message_id'];
    $headers = [
        'From: ' . $from,
        'Reply-To: ' . mailSafeEmail($config['email']),
        'To: ' . $to,
        'Subject: ' . mailDecodeHeader((string) $record['subject']),
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: ' . $messageId,
        'MIME-Version: 1.0',
        'X-Mailer: AzPlom ERP Mail Center',
    ];
    if ($cc !== '') {
        $headers[] = 'Cc: ' . $cc;
    }
    if ($reply !== null && !empty($reply['message_id'])) {
        $headers[] = 'In-Reply-To: ' . $reply['message_id'];
        $headers[] = 'References: ' . $reply['message_id'];
    }

    $body = (string) $record['body_text'];
    if ($attachments === []) {
        $headers[] = 'Content-Type: text/plain; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: quoted-printable';
        return implode("\r\n", $headers) . "\r\n\r\n" . quoted_printable_encode($body);
    }

    $boundary = 'azplom-' . bin2hex(random_bytes(12));
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $parts = [
        '--' . $boundary,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        quoted_printable_encode($body),
    ];
    foreach ($attachments as $attachment) {
        $name = mailSafeFilename((string) $attachment['name']);
        $parts[] = '--' . $boundary;
        $parts[] = 'Content-Type: ' . mailAttachmentMime((string) $attachment['data'], (string) $attachment['mime']) . '; name="' . addcslashes($name, "\\\"") . '"';
        $parts[] = 'Content-Transfer-Encoding: base64';
        $parts[] = 'Content-Disposition: attachment; filename="' . addcslashes($name, "\\\"") . '"';
        $parts[] = '';
        $parts[] = chunk_split(base64_encode((string) $attachment['data']), 76, "\r\n");
    }
    $parts[] = '--' . $boundary . '--';
    return implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $parts);
}

function mailSmtpRead($socket, array $expected): void
{
    $line = '';
    do {
        $chunk = fgets($socket, 1024);
        if ($chunk === false) {
            throw new RuntimeException('SMTP serverdən cavab alınmadı.');
        }
        $line = trim($chunk);
    } while (preg_match('/^\d{3}-/', $line));

    $code = (int) substr($line, 0, 3);
    if (!in_array($code, $expected, true)) {
        throw new RuntimeException('SMTP server məktubu qəbul etmədi.');
    }
}

function mailSmtpCommand($socket, string $command, array $expected): void
{
    if (fwrite($socket, $command . "\r\n") === false) {
        throw new RuntimeException('SMTP serverə yazmaq mümkün olmadı.');
    }
    mailSmtpRead($socket, $expected);
}

function mailSmtpConnect(array $config): mixed
{
    $smtp = $config['smtp'];
    $encryption = (string) $smtp['encryption'];
    $prefix = $encryption === 'ssl' ? 'ssl://' : 'tcp://';
    $context = stream_context_create(['ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
        'allow_self_signed' => false,
        'peer_name' => $smtp['host'],
    ]]);
    $socket = @stream_socket_client($prefix . $smtp['host'] . ':' . (int) $smtp['port'], $errno, $error, 15, STREAM_CLIENT_CONNECT, $context);
    if ($socket === false) {
        throw new RuntimeException('SMTP serverə qoşulmaq mümkün olmadı.');
    }
    stream_set_timeout($socket, 20);
    mailSmtpRead($socket, [220]);
    mailSmtpCommand($socket, 'EHLO azplom.com', [250]);
    if ($encryption === 'tls') {
        mailSmtpCommand($socket, 'STARTTLS', [220]);
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('SMTP TLS qorunması başladılmadı.');
        }
        mailSmtpCommand($socket, 'EHLO azplom.com', [250]);
    }
    if (!empty($smtp['username'])) {
        mailSmtpCommand($socket, 'AUTH LOGIN', [334]);
        mailSmtpCommand($socket, base64_encode((string) $smtp['username']), [334]);
        mailSmtpCommand($socket, base64_encode((string) $smtp['password']), [235]);
    }
    return $socket;
}

function mailSendSmtp(array $config, string $fromEmail, array $recipients, string $raw): void
{
    $socket = mailSmtpConnect($config);
    try {
        mailSmtpCommand($socket, 'MAIL FROM:<' . mailSafeEmail($fromEmail) . '>', [250]);
        $unique = [];
        foreach ($recipients as $recipient) {
            $email = mailSafeEmail($recipient['email'] ?? '', 'Alıcı e-poçtu');
            $unique[$email] = true;
        }
        foreach (array_keys($unique) as $email) {
            mailSmtpCommand($socket, 'RCPT TO:<' . $email . '>', [250, 251]);
        }
        mailSmtpCommand($socket, 'DATA', [354]);
        $raw = preg_replace("/(?<!\r)\n/", "\r\n", $raw) ?? $raw;
        $raw = preg_replace('/(^|\r\n)\./', '$1..', $raw) ?? $raw;
        if (fwrite($socket, $raw . "\r\n.\r\n") === false) {
            throw new RuntimeException('SMTP məlumatı göndərilmədi.');
        }
        mailSmtpRead($socket, [250]);
        mailSmtpCommand($socket, 'QUIT', [221]);
    } finally {
        if (is_resource($socket)) {
            fclose($socket);
        }
    }
}

function mailOutgoing(mysqli $conn, array $config, array $input, bool $send): array
{
    $to = mailRecipientInput($input['to'] ?? '');
    $cc = mailRecipientInput($input['cc'] ?? '');
    $bcc = mailRecipientInput($input['bcc'] ?? '');
    if ($send && $to === []) {
        throw new InvalidArgumentException('Ən azı bir alıcı daxil edilməlidir.');
    }
    $subject = trim((string) ($input['subject'] ?? ''));
    $body = trim((string) ($input['body'] ?? ''));
    if (str_contains($subject, "\r") || str_contains($subject, "\n")) {
        throw new InvalidArgumentException('Mövzuda yeni sətir istifadə edilə bilməz.');
    }
    if ($subject === '' && $body === '') {
        throw new InvalidArgumentException('Mövzu və ya mətn daxil edilməlidir.');
    }
    $subject = mailSlice($subject !== '' ? $subject : '(Mövzusuz)', 0, 998);
    $body = mailSlice($body, 0, 2 * 1024 * 1024);
    $attachments = mailUploadItems();
    $replyId = (int) ($input['replyToId'] ?? 0);
    $reply = null;
    $threadKey = '';
    if ($replyId > 0) {
        $replyStmt = mailPrepared($conn, 'SELECT message_id, thread_key FROM erp_mail_messages WHERE id = ? LIMIT 1', 'i', [$replyId]);
        $reply = $replyStmt->get_result()->fetch_assoc() ?: null;
        $replyStmt->close();
        if (is_array($reply)) {
            $threadKey = (string) $reply['thread_key'];
        }
    }
    if ($threadKey === '') {
        $threadKey = hash('sha256', 'outbound:' . mailLower(preg_replace('/^(?:(?:re|fw|fwd)\s*:\s*)+/iu', '', $subject) ?? $subject) . '|to:' . (($to[0]['email'] ?? '')));
    }
    $domain = substr(strrchr((string) $config['email'], '@') ?: '@azplom.com', 1);
    $messageIdentifier = '<erp-' . bin2hex(random_bytes(12)) . '@' . $domain . '>';
    $record = [
        'source_key' => hash('sha256', 'outgoing|' . $messageIdentifier),
        'message_id' => $messageIdentifier,
        'in_reply_to' => is_array($reply) ? (string) ($reply['message_id'] ?? '') : '',
        'thread_key' => $threadKey,
        'mail_folder' => $send ? 'OUTBOX' : 'DRAFTS',
        'direction' => 'OUTGOING',
        'sender_name' => (string) $config['displayName'],
        'sender_email' => (string) $config['email'],
        'recipient_data' => json_encode($to, JSON_UNESCAPED_UNICODE),
        'cc_data' => json_encode($cc, JSON_UNESCAPED_UNICODE),
        'bcc_data' => json_encode($bcc, JSON_UNESCAPED_UNICODE),
        'subject' => $subject,
        'snippet' => mailCleanText($body, 500),
        'body_text' => $body,
        'body_html' => '',
        'received_at' => date('Y-m-d H:i:s'),
        'is_read' => 1,
        'is_starred' => 0,
        'is_archived' => 0,
        'is_trashed' => 0,
        'has_attachments' => $attachments === [] ? 0 : 1,
        'remote_uid' => 0,
        'remote_folder' => '',
        'delivery_status' => $send ? 'QUEUED' : 'DRAFT',
        'metadata' => '{}',
    ];

    $conn->begin_transaction();
    try {
        $messageId = mailInsertMessage($conn, $record);
        foreach ($attachments as $attachment) {
            mailStoreAttachment($conn, $messageId, (string) $attachment['name'], (string) $attachment['data'], (string) $attachment['mime']);
        }
        mailStoreLinks($conn, $messageId, $input['links'] ?? []);
        mailUpsertThread($conn, $threadKey, $subject, $record['received_at'], $messageId);
        mailEvent($conn, $send ? 'OUTBOX_QUEUED' : 'DRAFT_SAVED', $messageId);
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }

    if (!$send) {
        return ['id' => $messageId, 'status' => 'DRAFT'];
    }

    try {
        $raw = mailBuildOutgoing($config, $record, $attachments, $reply);
        mailSendSmtp($config, (string) $config['email'], array_merge($to, $cc, $bcc), $raw);
        $stmt = mailPrepared($conn, "UPDATE erp_mail_messages SET mail_folder = 'SENT', delivery_status = 'SENT', updated_at = CURRENT_TIMESTAMP WHERE id = ?", 'i', [$messageId]);
        $stmt->close();
        mailEvent($conn, 'MESSAGE_SENT', $messageId);
        return ['id' => $messageId, 'status' => 'SENT'];
    } catch (Throwable $error) {
        $stmt = mailPrepared($conn, "UPDATE erp_mail_messages SET mail_folder = 'DRAFTS', delivery_status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", 'i', [$messageId]);
        $stmt->close();
        mailEvent($conn, 'MESSAGE_FAILED', $messageId);
        throw new RuntimeException('Məktub göndərilmədi. Parametrləri yoxlayın və yenidən cəhd edin.');
    }
}

function mailDownload(mysqli $conn, int $attachmentId): never
{
    $stmt = mailPrepared($conn, 'SELECT original_name, storage_key, mime_type FROM erp_mail_attachments WHERE id = ? LIMIT 1', 'i', [$attachmentId]);
    $attachment = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!is_array($attachment)) {
        mailFail('Qoşma tapılmadı.', 404);
    }

    $root = realpath(mailStoragePath());
    $path = realpath(mailStoragePath() . '/' . $attachment['storage_key']);
    if ($root === false || $path === false || !str_starts_with($path, $root . DIRECTORY_SEPARATOR) || !is_file($path)) {
        mailFail('Qoşma artıq əlçatan deyil.', 404);
    }
    $name = mailSafeFilename((string) $attachment['original_name']);
    header('Content-Type: ' . (string) $attachment['mime_type']);
    header('Content-Length: ' . (string) filesize($path));
    header('Content-Disposition: attachment; filename*=UTF-8\'\'' . rawurlencode($name));
    readfile($path);
    exit;
}

function mailProbe(array $config): array
{
    $result = ['imap' => false, 'smtp' => false];
    if (function_exists('imap_open') && !empty($config['imap']['password'])) {
        $stream = @imap_open(mailImapName($config['imap'], 'INBOX'), (string) $config['imap']['username'], (string) $config['imap']['password'], OP_READONLY, 1);
        if ($stream !== false) {
            $result['imap'] = true;
            imap_close($stream);
        }
    }
    if (!empty($config['smtp']['password'])) {
        try {
            $socket = mailSmtpConnect($config);
            mailSmtpCommand($socket, 'QUIT', [221]);
            fclose($socket);
            $result['smtp'] = true;
        } catch (Throwable) {
            $result['smtp'] = false;
        }
    }
    return $result;
}

try {
    mailEnsureSchema($conn);
    $input = mailPayload();
    $action = strtolower((string) ($_GET['action'] ?? $input['action'] ?? 'list'));
    $config = mailLoadConfig();

    if ($action === 'download') {
        mailDownload($conn, (int) ($_GET['id'] ?? 0));
    }

    if ($action === 'status') {
        mailJson([
            'ok' => true,
            'config' => mailConfigPublic($config),
            'capabilities' => [
                'imap' => function_exists('imap_open'),
                'openssl' => function_exists('openssl_encrypt'),
                'uploadMax' => (string) ini_get('upload_max_filesize'),
            ],
            'counts' => mailCounts($conn),
        ]);
    }

    if ($action === 'settings') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            mailJson(['ok' => true, 'config' => mailConfigPublic($config)]);
        }
        $saved = mailSaveConfig($input, $config);
        mailEvent($conn, 'SETTINGS_UPDATED');
        mailJson(['ok' => true, 'config' => mailConfigPublic($saved)]);
    }

    if ($action === 'probe') {
        if ($config === []) {
            mailFail('Əvvəlcə mail parametrlərini saxlayın.', 422);
        }
        mailJson(['ok' => true, 'probe' => mailProbe($config)]);
    }

    if ($action === 'sync') {
        if (!mailConfigPublic($config)['configured']) {
            mailFail('Mail hesabı hələ qoşulmayıb.', 422);
        }
        $scope = strtolower((string) ($input['scope'] ?? $_GET['scope'] ?? 'recent'));
        $sync = mailSync($conn, $config, $scope === 'history' ? 'history' : 'recent');
        mailJson(['ok' => true, 'sync' => $sync, 'counts' => mailCounts($conn)]);
    }

    if ($action === 'list') {
        mailJson(['ok' => true] + mailList($conn, $input + $_GET));
    }

    if ($action === 'message') {
        mailJson(['ok' => true] + mailGetMessage($conn, (int) ($input['id'] ?? $_GET['id'] ?? 0)));
    }

    if ($action === 'update') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            mailFail('Method not allowed', 405);
        }
        mailJson(['ok' => true] + mailApplyUpdate($conn, $input));
    }

    if ($action === 'link') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            mailFail('Method not allowed', 405);
        }
        $messageId = (int) ($input['id'] ?? 0);
        if ($messageId < 1) {
            mailFail('Məktub seçilməyib.');
        }
        mailStoreLinks($conn, $messageId, [[
            'entityType' => $input['entityType'] ?? '',
            'entityId' => $input['entityId'] ?? '',
            'label' => $input['label'] ?? '',
        ]]);
        mailEvent($conn, 'ENTITY_LINKED', $messageId);
        mailJson(['ok' => true]);
    }

    if ($action === 'send' || $action === 'draft') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            mailFail('Method not allowed', 405);
        }
        if (!mailConfigPublic($config)['configured']) {
            mailFail('Göndəriş üçün SMTP və IMAP parametrlərini əvvəlcə qoşun.', 422);
        }
        $outgoing = mailOutgoing($conn, $config, $input, $action === 'send');
        mailJson(['ok' => true, 'message' => $outgoing, 'counts' => mailCounts($conn)]);
    }

    mailFail('Naməlum mail əməliyyatı.', 404);
} catch (InvalidArgumentException $error) {
    mailFail($error->getMessage(), 422);
} catch (Throwable $error) {
    error_log('AzPlom Mail Center: ' . $error->getMessage());
    mailFail('Mail əməliyyatı hazırda tamamlanmadı.', 500);
}
