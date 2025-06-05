import { defineConfig, Plugin } from 'vite'

const mfeKey: Plugin = {
    name: 'mfe:key',
    enforce: 'post',
    transform: code => code.replaceAll(/['"`]__key__['"`]/g, 'import.meta.env.KEY'),
}

export default defineConfig({
    build: {
        lib: { entry: ['./src/index.ts', './src/plugin.ts'], formats: ['es'] },
        rollupOptions: { external: ['vite', 'rollup', 'magic-string'] },
    },
    plugins: [mfeKey],
})
