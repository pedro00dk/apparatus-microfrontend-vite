import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        minify: false,
        lib: { entry: ['./src/index.ts', './src/plugin.ts'], formats: ['es'] },
        rollupOptions: { external: ['node:fs', 'vite', 'rollup', 'magic-string'] },
    },
    plugins: [
        { name: 'keepEnv', enforce: 'pre', transform: code => code.replaceAll('import.meta.env', '_import.meta.env') },
        { name: 'keepEnv', enforce: 'post', transform: code => code.replaceAll('_import.meta.env', 'import.meta.env') },
    ],
})
