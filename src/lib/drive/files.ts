import { getDriveClientForTenant, isDriveConfiguredForTenant } from './client';
import { Readable } from 'stream';

interface FileMetadata {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    md5Checksum?: string;
}

/**
 * Upload a file to Google Drive for a specific tenant.
 * Accepts Buffer or Node Readable stream — for large files, pass a stream
 * so the entire file is never loaded into memory at once.
 */
export async function uploadFileToDrive(
    tenantId: string,
    fileName: string,
    folderId: string,
    fileData: Buffer | Readable,
    mimeType: string,
    knownSize?: number,
): Promise<FileMetadata> {
    const configured = await isDriveConfiguredForTenant(tenantId);
    const dataSize = Buffer.isBuffer(fileData) ? fileData.length : (knownSize ?? 0);

    if (!configured) {
        const mockId = `mock_file_${Date.now()}`;
        console.log(`[DEV] Mock file uploaded: ${fileName} → ${mockId}`);
        return { id: mockId, name: fileName, mimeType, size: dataSize };
    }

    const drive = await getDriveClientForTenant(tenantId);

    // Convert Buffer to Readable if needed
    let bodyStream: Readable;
    if (Buffer.isBuffer(fileData)) {
        bodyStream = new Readable();
        bodyStream.push(fileData);
        bodyStream.push(null);
    } else {
        bodyStream = fileData;
    }

    const response = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [folderId],
        },
        media: {
            mimeType,
            body: bodyStream,
        },
        fields: 'id, name, mimeType, size, md5Checksum',
    });

    const fileId = response.data.id || '';

    // Make file viewable by anyone with the link
    if (fileId) {
        try {
            await drive.permissions.create({
                fileId,
                requestBody: { role: 'reader', type: 'anyone' },
            });
        } catch (e) {
            console.error('[Drive] Failed to set file permissions:', e);
        }
    }

    return {
        id: fileId,
        name: response.data.name || fileName,
        mimeType: response.data.mimeType || mimeType,
        size: parseInt(response.data.size || '0', 10) || dataSize,
        md5Checksum: response.data.md5Checksum || undefined,
    };
}


/**
 * Download a file from Google Drive as a stream.
 */
export async function downloadFileFromDrive(
    tenantId: string,
    fileId: string
): Promise<{
    stream: ReadableStream;
    metadata: { name: string; mimeType: string; size: number };
}> {
    const configured = await isDriveConfiguredForTenant(tenantId);
    if (!configured) {
        const mockData = Buffer.from('Mock file content for development');
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(mockData);
                controller.close();
            },
        });
        return {
            stream,
            metadata: { name: 'mock-file.txt', mimeType: 'text/plain', size: mockData.length },
        };
    }

    const drive = await getDriveClientForTenant(tenantId);

    const metaResponse = await drive.files.get({
        fileId,
        fields: 'name, mimeType, size',
    });

    const metadata = {
        name: metaResponse.data.name || 'unknown',
        mimeType: metaResponse.data.mimeType || 'application/octet-stream',
        size: parseInt(metaResponse.data.size || '0', 10),
    };

    const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );

    const nodeStream = response.data as unknown as NodeJS.ReadableStream;
    const stream = new ReadableStream({
        start(controller) {
            nodeStream.on('data', (chunk: Buffer) => {
                controller.enqueue(new Uint8Array(chunk));
            });
            nodeStream.on('end', () => {
                controller.close();
            });
            nodeStream.on('error', (err: Error) => {
                controller.error(err);
            });
        },
    });

    return { stream, metadata };
}

/**
 * Get file metadata from Google Drive.
 */
export async function getFileMetadata(tenantId: string, fileId: string): Promise<FileMetadata | null> {
    const configured = await isDriveConfiguredForTenant(tenantId);
    if (!configured) {
        return {
            id: fileId,
            name: 'mock-file.txt',
            mimeType: 'text/plain',
            size: 0,
        };
    }

    try {
        const drive = await getDriveClientForTenant(tenantId);
        const response = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, md5Checksum',
        });

        return {
            id: response.data.id || fileId,
            name: response.data.name || 'unknown',
            mimeType: response.data.mimeType || 'application/octet-stream',
            size: parseInt(response.data.size || '0', 10),
            md5Checksum: response.data.md5Checksum || undefined,
        };
    } catch {
        return null;
    }
}

/**
 * Delete a file from Google Drive.
 */
export async function deleteFileFromDrive(tenantId: string, fileId: string): Promise<void> {
    const configured = await isDriveConfiguredForTenant(tenantId);
    if (!configured) {
        console.log(`[DEV] Mock file deleted: ${fileId}`);
        return;
    }

    const drive = await getDriveClientForTenant(tenantId);
    await drive.files.delete({ fileId });
}

/**
 * Check if a file exists in Google Drive.
 */
export async function fileExistsOnDrive(tenantId: string, fileId: string): Promise<boolean> {
    const meta = await getFileMetadata(tenantId, fileId);
    return meta !== null;
}

/**
 * Create a folder in Google Drive for a tenant.
 */
export async function createDriveFolder(
    tenantId: string,
    folderName: string,
    parentFolderId: string
): Promise<string | null> {
    const configured = await isDriveConfiguredForTenant(tenantId);
    if (!configured) {
        const mockId = `mock_folder_${Date.now()}`;
        console.log(`[DEV] Mock folder created: ${folderName} → ${mockId}`);
        return mockId;
    }

    const drive = await getDriveClientForTenant(tenantId);
    const res = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        },
        fields: 'id',
    });

    return res.data.id || null;
}
