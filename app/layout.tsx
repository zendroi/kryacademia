import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './revisions.css';
import type {Metadata} from 'next';import'./globals.css';import'./carousel.css';
export const metadata:Metadata={title:'KRYAcademia — The 21st Education Center',description:'Creative, project-based learning experiences for young people, families, and schools.'};export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
