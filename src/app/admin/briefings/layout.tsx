import { assertBriefingsEnabled } from '@/lib/briefings/flag';

export default function BriefingsLayout({ children }: { children: React.ReactNode }) {
    assertBriefingsEnabled();
    return <>{children}</>;
}
