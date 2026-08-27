import { headers } from 'next/headers';
import { XCircle, Ban, Clock, CheckCircle2, Archive } from 'lucide-react';
import prisma from '@/lib/db';
import { hashToken, hashIp } from '@/lib/briefings/token';
import { dbDateToIso, formatDateBR, formatMonthBR } from '@/lib/briefings/dates';
import BriefingForm from './BriefingForm';
import styles from './briefing-public.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
    robots: { index: false, follow: false },
    title: 'Briefing',
};

function StatePage({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
    return (
        <div className={styles.stateWrapper}>
            <div className={styles.stateCard}>
                {icon}
                <h1 className={styles.stateTitle}>{title}</h1>
                <p className={styles.stateMessage}>{message}</p>
            </div>
        </div>
    );
}

function getClientIp(hdrs: Headers): string {
    return hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
        || hdrs.get('x-real-ip')
        || 'unknown';
}

export default async function BriefingPublicPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const tokenHash = hashToken(token);

    const link = await prisma.briefingLink.findUnique({
        where: { tokenHash },
        include: {
            cycle: {
                include: {
                    client: { select: { name: true } },
                    template: {
                        include: {
                            sections: {
                                orderBy: { sortOrder: 'asc' },
                                include: { fields: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
                            },
                        },
                    },
                    answers: true,
                },
            },
        },
    });

    if (!link) {
        return <StatePage icon={<XCircle size={40} color="#FF3B30" />} title="Link inválido" message="Verifique o link recebido ou fale com seu contato." />;
    }
    if (link.revokedAt) {
        return <StatePage icon={<Ban size={40} color="#FF3B30" />} title="Link cancelado" message="Este link foi cancelado. Fale com seu contato." />;
    }
    if (link.expiresAt < new Date()) {
        return <StatePage icon={<Clock size={40} color="#FF9500" />} title="Link expirado" message="Este link expirou. Peça um novo ao seu contato." />;
    }

    const cycle = link.cycle;

    if (cycle.status === 'archived') {
        return <StatePage icon={<Archive size={40} color="#8E8E93" />} title="Briefing encerrado" message="Este briefing foi encerrado." />;
    }

    if (cycle.status === 'submitted') {
        return (
            <StatePage
                icon={<CheckCircle2 size={40} color="#34C759" />}
                title="Briefing enviado"
                message={`Recebido${cycle.submittedAt ? ` em ${formatDateBR(dbDateToIso(cycle.submittedAt))}` : ''}. Obrigado! Se precisar alterar algo, fale com seu contato.`}
            />
        );
    }

    const hdrs = await headers();
    const ip = getClientIp(hdrs);
    const userAgent = hdrs.get('user-agent') || undefined;

    await prisma.$transaction([
        prisma.briefingLink.update({
            where: { id: link.id },
            data: { opensCount: { increment: 1 }, lastOpenedAt: new Date() },
        }),
        prisma.briefingEvent.create({
            data: { cycleId: cycle.id, type: 'link_opened', ipHash: hashIp(ip), userAgent },
        }),
        ...(cycle.status === 'sent'
            ? [prisma.briefingCycle.update({ where: { id: cycle.id }, data: { status: 'in_progress' } })]
            : []),
    ]);

    const initialAnswers = cycle.answers.map((a) => ({
        fieldId: a.fieldId,
        groupIndex: a.groupIndex,
        value: a.value as { raw: unknown },
    }));

    return (
        <BriefingForm
            token={token}
            clientName={cycle.client.name}
            referenceMonthLabel={formatMonthBR(dbDateToIso(cycle.referenceMonth))}
            sections={cycle.template.sections.map((s) => ({
                id: s.id,
                title: s.title,
                description: s.description,
                kind: s.kind,
                repeaterItemLabel: s.repeaterItemLabel,
                emptyLabel: s.emptyLabel,
                isOptional: s.isOptional,
                fields: s.fields.map((f) => ({
                    id: f.id,
                    key: f.key,
                    label: f.label,
                    hint: f.hint,
                    placeholder: f.placeholder,
                    type: f.type,
                    options: f.options as string[] | null,
                    isRequired: f.isRequired,
                    width: f.width,
                })),
            }))}
            initialAnswers={initialAnswers}
        />
    );
}
