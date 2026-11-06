import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { PagePreloaderProvider } from './components/smoothui/page-preloader';

createInertiaApp({
  title: (title) => (title ? `${title} - KRYAcademia` : 'KRYAcademia - 21st Education Center'),
  resolve: (name) => {
    const pages = import.meta.glob('./Pages/**/*.{jsx,tsx}', { eager: true });
    const page = pages[`./Pages/${name}.jsx`] || pages[`./Pages/${name}.tsx`];
    if (!page) {
      throw new Error(`Page not found: ${name}`);
    }
    return page;
  },
  setup({ el, App, props }) {
    createRoot(el).render(<PagePreloaderProvider><App {...props} /></PagePreloaderProvider>);
  },
});
