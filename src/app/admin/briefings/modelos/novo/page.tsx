import TemplateBuilder from '../TemplateBuilder';

// See src/app/admin/briefings/modelos/page.tsx for why this is forced
// dynamic and why it has to be a Server Component to take effect.
export const dynamic = 'force-dynamic';

export default function NewBriefingTemplatePage() {
    return <TemplateBuilder />;
}
