import { getDriveClientForTenant, isDriveConfiguredForTenant } from './client';

interface FolderResult {
    folderId: string;
    folderName: string;
}

/**
 * Create a folder in Google Drive for a specific tenant.
 */
export async function createDriveFolder(
    tenantId: string,
    name: string,
    parentFolderId: string
): Promise<FolderResult> {
    const configured = await isDriveConfiguredForTenant(tenantId);
    if (!configured) {
        const mockId = `mock_folder_${Date.now()}`;
        console.log(`[DEV] Mock Drive folder created: ${name} → ${mockId}`);
        return { folderId: mockId, folderName: name };
    }

    const drive = await getDriveClientForTenant(tenantId);

    const response = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        },
        fields: 'id, name',
    });

    if (!response.data.id) {
        throw new Error(`Failed to create folder: ${name}`);
    }

    // Set "Anyone with the link can view" permission
    try {
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                type: 'anyone',
                role: 'reader',
            },
        });
    } catch (e) {
        console.error(`Failed to set public permission on folder ${name}:`, e);
    }

    return {
        folderId: response.data.id,
        folderName: response.data.name || name,
    };
}

/**
 * Create the full folder hierarchy for a client.
 */
export async function createClientFolders(
    tenantId: string,
    rootFolderId: string,
    clientName: string
): Promise<FolderResult> {
    return createDriveFolder(tenantId, clientName, rootFolderId);
}

/**
 * Create folder hierarchy for a company.
 */
export async function createCompanyFolders(
    tenantId: string,
    clientFolderId: string,
    companyName: string
): Promise<FolderResult> {
    return createDriveFolder(tenantId, companyName, clientFolderId);
}

/**
 * Create folder hierarchy for a project.
 * Client Folder / Project Name / PREVIEW/ FINAL/ BRUTO/ OUTROS/
 */
export async function createProjectFolders(
    tenantId: string,
    companyFolderId: string,
    projectName: string
): Promise<{
    projectFolder: FolderResult;
    previewFolder: FolderResult;
    finalFolder: FolderResult;
    rawFolder: FolderResult;
    otherFolder: FolderResult;
}> {
    const projectFolder = await createDriveFolder(tenantId, projectName, companyFolderId);
    const previewFolder = await createDriveFolder(tenantId, 'PREVIEW', projectFolder.folderId);
    const finalFolder = await createDriveFolder(tenantId, 'FINAL', projectFolder.folderId);
    const rawFolder = await createDriveFolder(tenantId, 'BRUTO', projectFolder.folderId);
    const otherFolder = await createDriveFolder(tenantId, 'OUTROS', projectFolder.folderId);

    return { projectFolder, previewFolder, finalFolder, rawFolder, otherFolder };
}

/**
 * List files in a Drive folder.
 */
export async function listDriveFolder(tenantId: string, folderId: string) {
    const configured = await isDriveConfiguredForTenant(tenantId);
    if (!configured) {
        return [];
    }

    const drive = await getDriveClientForTenant(tenantId);

    const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size, md5Checksum, createdTime, modifiedTime)',
        orderBy: 'name',
    });

    return response.data.files || [];
}
