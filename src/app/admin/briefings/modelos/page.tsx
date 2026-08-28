import TemplatesListClient from './TemplatesListClient';

// Sibling to a nested [id] segment one level down (modelos/[id]) while also
// being a sibling of the cycle detail's own [id] one level up
// (admin/briefings/[id]) -- that combination made Next's static generation
// misresolve this route at build time (it baked in a 404 into the static
// output). Skipping static generation sidesteps it; this page is behind
// auth and fetches live data client-side anyway, so nothing is lost.
// (Only works here because this is a Server Component -- route segment
// config exports are ignored inside a 'use client' module.)
export const dynamic = 'force-dynamic';

export default function BriefingTemplatesPage() {
    return <TemplatesListClient />;
}
