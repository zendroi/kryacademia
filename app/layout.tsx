import type {Metadata} from 'next';import'./globals.css';import'./carousel.css';
export const metadata:Metadata={title:'KRYAcademia — The 21st Education Center',description:'Creative, project-based learning experiences for young people, families, and schools.'};export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
