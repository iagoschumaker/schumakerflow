import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const ALLOWED_TYPES: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
};
const MAX_SIZE = 3 * 1024 * 1024;

const colorSchema = z.object({ primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/) });

// GET /api/admin/settings/branding
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { logoUrl: true, primaryColor: true },
        });
        return apiSuccess(tenant);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// POST /api/admin/settings/branding -- multipart upload of the logo image.
// Stored on local disk under public/uploads/branding and served directly by
// Next.js (must be reachable by the client filling a public briefing form,
// so it can't depend on a Drive connection or auth).
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const formData = await req.formData();
        const file = formData.get('logo') as globalThis.File | null;
        if (!file) return apiError('Nenhum arquivo enviado', 400);

        const ext = ALLOWED_TYPES[file.type];
        if (!ext) return apiError('Formato inválido. Use PNG, JPG, WEBP ou SVG.', 400);
        if (file.size > MAX_SIZE) return apiError('Arquivo muito grande (máximo 3MB).', 400);

        const dir = path.join(process.cwd(), 'public', 'uploads', 'branding');
        await mkdir(dir, { recursive: true });
        const fileName = `${ctx.tenantId}-${Date.now()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(dir, fileName), buffer);

        const logoUrl = `/uploads/branding/${fileName}`;
        await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { logoUrl } });

        return apiSuccess({ logoUrl });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// PUT /api/admin/settings/branding -- primary color only
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const parsed = colorSchema.safeParse(body);
        if (!parsed.success) return apiError('Cor inválida', 400);

        await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { primaryColor: parsed.data.primaryColor } });
        return apiSuccess({ primaryColor: parsed.data.primaryColor });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// DELETE /api/admin/settings/branding -- remove the logo
export const DELETE = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { logoUrl: null } });
        return apiSuccess({ ok: true });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
