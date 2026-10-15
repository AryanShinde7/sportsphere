import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Private storage directory outside public uploads
export const PRIVATE_UPLOADS_DIR = path.join(__dirname, '..', '..', 'private_uploads');
if (!fs.existsSync(PRIVATE_UPLOADS_DIR)) {
  fs.mkdirSync(PRIVATE_UPLOADS_DIR, { recursive: true });
}

export interface ValidationResult {
  isValid: boolean;
  mimeType?: string;
  extension?: string;
  error?: string;
}

/**
 * Validates file signature (magic bytes), MIME type, and contents.
 * Explicitly allowed formats for verification evidence: PDF, JPEG, PNG.
 * Do not trust extension or browser-supplied MIME type.
 */
export function validateEvidenceFileBuffer(buffer: Buffer): ValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'Empty file payload' };
  }

  // Max 10MB limit
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (buffer.length > MAX_FILE_SIZE) {
    return { isValid: false, error: 'File size exceeds maximum allowed limit of 10MB' };
  }

  // Check magic bytes
  // PDF: starts with %PDF- (0x25 0x50 0x44 0x46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { isValid: true, mimeType: 'application/pdf', extension: '.pdf' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { isValid: true, mimeType: 'image/png', extension: '.png' };
  }

  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return { isValid: true, mimeType: 'image/jpeg', extension: '.jpg' };
  }

  return {
    isValid: false,
    error: 'Invalid file signature. Only verified PDF, JPEG, and PNG documents are accepted.'
  };
}

/**
 * Computes SHA-256 hash of file buffer
 */
export function computeDocumentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Saves validated buffer to private storage directory
 * Returns { privateStorageKey, documentHash, filename, sizeBytes }
 */
export async function savePrivateEvidenceFile(buffer: Buffer, extension: string) {
  const documentHash = computeDocumentHash(buffer);
  const filename = `${uuidv4()}${extension}`;
  const filePath = path.join(PRIVATE_UPLOADS_DIR, filename);

  await fs.promises.writeFile(filePath, buffer);

  return {
    privateStorageKey: filename,
    documentHash,
    filename,
    sizeBytes: buffer.length,
    absolutePath: filePath
  };
}

/**
 * Resolves private file path and prevents directory traversal attacks
 */
export function getPrivateFilePath(storageKey: string): string | null {
  const safeFilename = path.basename(storageKey);
  const resolved = path.join(PRIVATE_UPLOADS_DIR, safeFilename);

  // Security check: ensure path stays within PRIVATE_UPLOADS_DIR
  if (!resolved.startsWith(PRIVATE_UPLOADS_DIR)) {
    return null;
  }

  if (!fs.existsSync(resolved)) {
    return null;
  }

  return resolved;
}
