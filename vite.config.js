import { defineConfig } from 'vite';

// Sous Docker (Windows ou macOS), les changements d'un dossier monté ne se voient qu'en sondant
const sonder = Boolean(process.env.VITE_SONDER);

export default defineConfig({
    // des chemins relatifs : la version construite marche dans n'importe quel dossier
    base: './',
    server: {
        port: 5173,
        watch: sonder ? { usePolling: true, interval: 300 } : undefined,
    },
    preview: {
        port: 4173,
    },
    worker: {
        format: 'es',
    },
    build: {
        target: 'es2022',
        outDir: 'dist',
    },
});
