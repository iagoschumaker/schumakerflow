import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests = 10, windowMs = 60_000): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (entry.count >= maxRequests) return false;
    entry.count++;
    return true;
}

// POST /api/portal/ai/caption
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return apiError('AI não configurada. Configure GEMINI_API_KEY no ambiente.', 503);
        }

        // Rate limit per tenant
        if (!checkRateLimit(`tenant:${ctx.tenantId}`)) {
            return apiError('Limite de requisições atingido. Aguarde um momento.', 429);
        }

        const body = await req.json();
        const { fileName, projectName, clientName, fileKind } = body;

        if (!fileName) {
            return apiError('fileName is required', 400);
        }

        const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(fileName);
        const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(fileName);
        const mediaType = isVideo ? 'vídeo' : isImage ? 'imagem' : 'conteúdo';

        const prompt = `Você é um social media manager especializado em criar legendas virais para Instagram.

Gere uma legenda criativa, envolvente e profissional para postar no Instagram.

Contexto:
- Tipo de mídia: ${mediaType}
- Nome do arquivo: ${fileName}
${projectName ? `- Projeto: ${projectName}` : ''}
${clientName ? `- Cliente: ${clientName}` : ''}
${fileKind ? `- Categoria: ${fileKind === 'FINAL' ? 'Versão Final' : fileKind === 'PREVIEW' ? 'Preview' : fileKind}` : ''}

Requisitos:
1. Escreva em português brasileiro
2. Tom profissional mas acessível
3. Inclua 3-5 hashtags relevantes no final
4. Use emojis de forma moderada (2-3 no máximo)
5. Mantenha entre 100-250 caracteres (sem contar hashtags)
6. Não mencione nomes de arquivos ou termos técnicos
7. Foque em engajamento e valor para o público

Responda APENAS com a legenda pronta para copiar. Sem explicações, sem título, sem aspas.`;

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const result = await model.generateContent(prompt);
            const response = result.response;
            const caption = response.text().trim();

            return apiSuccess({ caption });
        } catch (error: any) {
            console.error('[AI Caption] Error:', error?.message || error);
            return apiError('Erro ao gerar legenda. Tente novamente.', 500);
        }
    },
    { roles: ['CLIENT_USER', 'TENANT_ADMIN', 'SUPERADMIN'] }
);
