import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { getDriveClientForTenant } from '@/lib/drive/client';

// POST /api/portal/instagram/publish
// Body: { fileId, caption, accountId }
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        if (!ctx.clientId) return apiError('Cliente não identificado', 400);

        const { fileId, caption, accountId } = await req.json();
        if (!fileId) return apiError('fileId obrigatório', 400);
        if (!accountId) return apiError('Selecione uma conta Instagram', 400);

        const igAccount = await (prisma as any).clientInstagram.findFirst({
            where: { id: accountId, clientId: ctx.clientId },
        });
        if (!igAccount) return apiError('Conta Instagram não encontrada. Conecte novamente.', 400);

        const file = await prisma.file.findFirst({
            where: { id: fileId, tenantId: ctx.tenantId },
        });
        if (!file) return apiError('Arquivo não encontrado', 404);
        if (!file.driveFileId) return apiError('Arquivo sem vínculo com Drive', 400);

        const isImage = file.mimeType?.startsWith('image/');
        const isVideo = file.mimeType?.startsWith('video/');
        if (!isImage && !isVideo) return apiError('Apenas imagens e vídeos podem ser postados', 400);

        try {
            const drive = await getDriveClientForTenant(ctx.tenantId);
            await drive.permissions.create({
                fileId: file.driveFileId,
                requestBody: { role: 'reader', type: 'anyone' },
            });

            const publicUrl = `https://drive.google.com/uc?export=download&id=${file.driveFileId}`;

            const mediaParams: Record<string, string> = {
                caption: caption || '',
                access_token: igAccount.accessToken,
            };

            if (isVideo) {
                mediaParams.media_type = 'REELS';
                mediaParams.video_url = publicUrl;
            } else {
                mediaParams.image_url = publicUrl;
            }

            const containerRes = await fetch(
                `https://graph.facebook.com/v21.0/${igAccount.igUserId}/media`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mediaParams) }
            );
            const containerData = await containerRes.json();

            if (!containerData.id) {
                console.error('[IG Publish] Container failed:', containerData);
                await drive.permissions.delete({ fileId: file.driveFileId, permissionId: 'anyoneWithLink' }).catch(() => { });
                return apiError(containerData?.error?.message || 'Erro ao preparar postagem', 500);
            }

            const containerId = containerData.id;

            if (isVideo) {
                let ready = false;
                for (let i = 0; i < 30; i++) {
                    await new Promise(r => setTimeout(r, 10000));
                    const statusRes = await fetch(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${igAccount.accessToken}`);
                    const statusData = await statusRes.json();
                    if (statusData.status_code === 'FINISHED') { ready = true; break; }
                    if (statusData.status_code === 'ERROR') {
                        await drive.permissions.delete({ fileId: file.driveFileId, permissionId: 'anyoneWithLink' }).catch(() => { });
                        return apiError('Erro ao processar vídeo no Instagram', 500);
                    }
                }
                if (!ready) {
                    await drive.permissions.delete({ fileId: file.driveFileId, permissionId: 'anyoneWithLink' }).catch(() => { });
                    return apiError('Tempo esgotado ao processar vídeo', 500);
                }
            }

            const publishRes = await fetch(
                `https://graph.facebook.com/v21.0/${igAccount.igUserId}/media_publish`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: containerId, access_token: igAccount.accessToken }) }
            );
            const publishData = await publishRes.json();

            await drive.permissions.delete({ fileId: file.driveFileId, permissionId: 'anyoneWithLink' }).catch(() => { });

            if (!publishData.id) {
                console.error('[IG Publish] Failed:', publishData);
                return apiError(publishData?.error?.message || 'Erro ao publicar', 500);
            }

            let permalink = '';
            try {
                const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${publishData.id}?fields=permalink&access_token=${igAccount.accessToken}`);
                const mediaData = await mediaRes.json();
                permalink = mediaData.permalink || '';
            } catch { /* ignore */ }

            console.log(`[IG Publish] Published ${publishData.id} for @${igAccount.username}`);
            return apiSuccess({ mediaId: publishData.id, permalink });
        } catch (error) {
            console.error('[IG Publish] Error:', error);
            return apiError('Erro ao publicar no Instagram', 500);
        }
    },
    { roles: ['CLIENT_USER'] }
);
