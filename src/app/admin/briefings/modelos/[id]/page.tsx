'use client';

import { useParams } from 'next/navigation';
import TemplateBuilder from '../TemplateBuilder';

export default function EditBriefingTemplatePage() {
    const { id } = useParams<{ id: string }>();
    return <TemplateBuilder templateId={id} />;
}
