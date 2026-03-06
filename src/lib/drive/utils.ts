/**
 * Extract a Google Drive file ID from a Drive URL.
 * Supports:
 * - https://drive.google.com/file/d/{id}/view
 * - https://drive.google.com/open?id={id}
 * - https://docs.google.com/document/d/{id}/edit
 * - Raw file ID string
 */
export function extractDriveFileId(input: string): string | null {
    if (!input) return null;

    // Already a plain ID (no slashes, no dots, 25+ chars)
    if (/^[a-zA-Z0-9_-]{25,}$/.test(input.trim())) {
        return input.trim();
    }

    // /file/d/{id}
    const fileMatch = input.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return fileMatch[1];

    // /document/d/{id} or /spreadsheets/d/{id} or /presentation/d/{id}
    const docMatch = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) return docMatch[1];

    // ?id={id}
    const queryMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (queryMatch) return queryMatch[1];

    return null;
}

/**
 * Build a Google Drive direct link (not public — just for reference).
 */
export function buildDriveLink(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`;
}
