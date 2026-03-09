import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests = 30, windowMs = 60_000): boolean {
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

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

// POST /api/portal/ai/chat
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return apiError('AI não configurada. Configure GEMINI_API_KEY no ambiente.', 503);
        }

        // Rate limit per tenant
        if (!checkRateLimit(`chat:${ctx.tenantId}`)) {
            return apiError('Limite de requisições atingido. Aguarde um momento.', 429);
        }

        const body = await req.json();
        const { message, history, context } = body as {
            message: string;
            history: ChatMessage[];
            context: {
                fileName: string;
                projectName: string;
                clientName: string;
                fileKind: string;
            };
        };

        if (!message?.trim()) {
            return apiError('Mensagem é obrigatória', 400);
        }

        const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(context?.fileName || '');
        const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(context?.fileName || '');
        const mediaType = isVideo ? 'vídeo' : isImage ? 'imagem' : 'conteúdo';

        const systemPrompt = `Você é a IA assistente de social media da Schumaker Flow, especializada em gerar legendas e copys profissionais para Instagram, TikTok e redes sociais.

Contexto do arquivo:
- Cliente: ${context?.clientName || 'Não informado'}
- Projeto: ${context?.projectName || 'Não informado'}
- Arquivo: ${context?.fileName || 'Não informado'}
- Tipo de mídia: ${mediaType}
- Categoria: ${context?.fileKind === 'FINAL' ? 'Versão Final' : context?.fileKind === 'PREVIEW' ? 'Preview' : context?.fileKind || 'Não informado'}

Você é uma assistente conversacional. O cliente vai te descrever o conteúdo do arquivo (vídeo, foto, etc.) e você deve gerar legendas criativas e profissionais.

Regras:
1. Sempre responda em português brasileiro
2. Seja simpática, profissional e criativa
3. Quando gerar uma legenda/copy, formate de forma clara e pronta para copiar
4. Inclua hashtags relevantes quando solicitado
5. Pergunte detalhes se precisar (ex: "Qual o tom desejado?", "É para stories ou feed?")
6. Use emojis de forma moderada
7. Se o cliente pedir ajustes, faça sem problemas
8. Seja concisa nas respostas conversacionais, mas completa nas copys`;

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            // Build the chat history
            const chatHistory = (history || []).map((msg: ChatMessage) => ({
                role: msg.role,
                parts: [{ text: msg.text }],
            }));

            const chat = model.startChat({
                history: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    { role: 'model', parts: [{ text: `Olá! 👋 Sou a IA da Schumaker Flow. Estou pronta para te ajudar a criar a copy perfeita para o seu ${mediaType}. Me conta sobre o conteúdo que vamos trabalhar!` }] },
                    ...chatHistory,
                ],
            });

            const result = await chat.sendMessage(message);
            const response = result.response.text().trim();

            return apiSuccess({ reply: response });
        } catch (error: any) {
            console.error('[AI Chat] Error:', error?.message || error);
            return apiError('Erro ao processar mensagem. Tente novamente.', 500);
        }
    },
    { roles: ['CLIENT_USER', 'TENANT_ADMIN', 'SUPERADMIN'] }
);
