/** Accepted MIME types for file attachments */
export const ALLOWED_FILE_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/x-yaml",
  "text/yaml",
] as const;

/** Maximum attached-file size in bytes (5 MB) */
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
