import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './revisions.css';
import './globals.css';
import './page-preloader.css';
import type { Metadata } from 'next';
import { PagePreloaderProvider } from '@/components/smoothui/page-preloader';

export const metadata: Metadata = { title: 'KRYAcademia — The 21st Education Center', description: 'Creative, project-based learning experiences for young people, families, and schools.', icons: { icon: '/kryacademia-logo.png' } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><PagePreloaderProvider>{children}</PagePreloaderProvider></body></html>;
}
