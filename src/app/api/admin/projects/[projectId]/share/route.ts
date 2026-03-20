import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { randomBytes } from 'crypto';

// GET /api/admin/projects/[projectId]/share - List share links for project
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const projectId = req.nextUrl.pathname.split('/').at(-2)!;

        const project = await prisma.project.findFirst({
            where: { id: projectId, tenantId: ctx.tenantId },
        });
        if (!project) return apiError('Project not found', 404);

        const links = await prisma.shareLink.findMany({
            where: { projectId, tenantId: ctx.tenantId },
            orderBy: { createdAt: 'desc' },
        });

        return apiSuccess(links);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// POST /api/admin/projects/[projectId]/share - Create a new share link
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const projectId = req.nextUrl.pathname.split('/').at(-2)!;
        const body = await req.json();

        const project = await prisma.project.findFirst({
            where: { id: projectId, tenantId: ctx.tenantId },
            include: { client: { select: { name: true } } },
        });
        if (!project) return apiError('Project not found', 404);

        const token = randomBytes(24).toString('hex');
        const expiresInDays = body.expiresInDays || 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const link = await prisma.shareLink.create({
            data: {
                token,
                projectId,
                tenantId: ctx.tenantId,
                label: body.label || project.client?.name || project.name,
                expiresAt,
                createdById: ctx.session.userId,
            },
        });

        const baseUrl = process.env.BASE_URL || req.nextUrl.origin;
        const shareUrl = `${baseUrl}/share/${link.token}`;

        return apiSuccess({ ...link, shareUrl }, 201);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// DELETE /api/admin/projects/[projectId]/share - Deactivate a share link
export const DELETE = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const { searchParams } = req.nextUrl;
        const linkId = searchParams.get('id');
        if (!linkId) return apiError('Missing link id', 400);

        const link = await prisma.shareLink.findFirst({
            where: { id: linkId, tenantId: ctx.tenantId },
        });
        if (!link) return apiError('Link not found', 404);

        await prisma.shareLink.update({
            where: { id: linkId },
            data: { isActive: false },
        });

        return apiSuccess({ message: 'Link deactivated' });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
