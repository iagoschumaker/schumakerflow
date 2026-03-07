import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError, ApiContext } from '@/lib/api/helpers';
import { getCalendarClient } from '@/lib/calendar/client';

// GET /api/admin/calendar — list events
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        try {
            const calendar = await getCalendarClient(ctx.tenantId);

            const url = new URL(req.url);
            const timeMin = url.searchParams.get('start') || new Date().toISOString();
            const timeMax = url.searchParams.get('end') || new Date(Date.now() + 30 * 86400000).toISOString();
            const calendarId = url.searchParams.get('calendarId') || 'primary';

            const res = await calendar.events.list({
                calendarId,
                timeMin,
                timeMax,
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 250,
            });

            const events = (res.data.items || []).map((ev) => ({
                id: ev.id,
                summary: ev.summary || '',
                description: ev.description || '',
                start: ev.start?.dateTime || ev.start?.date || '',
                end: ev.end?.dateTime || ev.end?.date || '',
                allDay: !!ev.start?.date,
                color: ev.colorId || null,
                htmlLink: ev.htmlLink || '',
                location: ev.location || '',
            }));

            return NextResponse.json({ data: events });
        } catch (e: any) {
            console.error('Calendar list error:', e);
            return apiError(e.message || 'Erro ao listar eventos', 500);
        }
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// POST /api/admin/calendar — create event
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        try {
            const calendar = await getCalendarClient(ctx.tenantId);
            const body = await req.json();
            const { summary, description, start, end, allDay, calendarId, reminders } = body;

            if (!summary || !start) {
                return apiError('Título e data de início são obrigatórios', 400);
            }

            const eventBody: any = {
                summary,
                description: description || '',
            };

            if (allDay) {
                eventBody.start = { date: start.split('T')[0] };
                eventBody.end = { date: (end || start).split('T')[0] };
            } else {
                eventBody.start = { dateTime: start, timeZone: 'America/Sao_Paulo' };
                eventBody.end = { dateTime: end || start, timeZone: 'America/Sao_Paulo' };
            }

            // Custom reminders
            if (reminders && Array.isArray(reminders) && reminders.length > 0) {
                eventBody.reminders = {
                    useDefault: false,
                    overrides: reminders.map((m: number) => ({ method: 'popup', minutes: m })),
                };
            }

            const res = await calendar.events.insert({
                calendarId: calendarId || 'primary',
                requestBody: eventBody,
            });

            return NextResponse.json({ data: { id: res.data.id, htmlLink: res.data.htmlLink } });
        } catch (e: any) {
            console.error('Calendar create error:', e);
            return apiError(e.message || 'Erro ao criar evento', 500);
        }
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// PUT /api/admin/calendar — update event
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        try {
            const calendar = await getCalendarClient(ctx.tenantId);
            const body = await req.json();
            const { eventId, summary, description, start, end, allDay, calendarId, reminders } = body;

            if (!eventId) {
                return apiError('eventId é obrigatório', 400);
            }

            const eventBody: any = {};
            if (summary !== undefined) eventBody.summary = summary;
            if (description !== undefined) eventBody.description = description;

            if (start) {
                if (allDay) {
                    eventBody.start = { date: start.split('T')[0] };
                    eventBody.end = { date: (end || start).split('T')[0] };
                } else {
                    eventBody.start = { dateTime: start, timeZone: 'America/Sao_Paulo' };
                    eventBody.end = { dateTime: end || start, timeZone: 'America/Sao_Paulo' };
                }
            }

            if (reminders && Array.isArray(reminders) && reminders.length > 0) {
                eventBody.reminders = {
                    useDefault: false,
                    overrides: reminders.map((m: number) => ({ method: 'popup', minutes: m })),
                };
            }

            await calendar.events.patch({
                calendarId: calendarId || 'primary',
                eventId,
                requestBody: eventBody,
            });

            return NextResponse.json({ data: { success: true } });
        } catch (e: any) {
            console.error('Calendar update error:', e);
            return apiError(e.message || 'Erro ao atualizar evento', 500);
        }
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// DELETE /api/admin/calendar — delete event
export const DELETE = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        try {
            const calendar = await getCalendarClient(ctx.tenantId);
            const body = await req.json();
            const { eventId, calendarId } = body;

            if (!eventId) {
                return apiError('eventId é obrigatório', 400);
            }

            await calendar.events.delete({
                calendarId: calendarId || 'primary',
                eventId,
            });

            return NextResponse.json({ data: { success: true } });
        } catch (e: any) {
            console.error('Calendar delete error:', e);
            return apiError(e.message || 'Erro ao deletar evento', 500);
        }
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
