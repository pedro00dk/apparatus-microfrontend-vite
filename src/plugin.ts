import MagicString from 'magic-string'
import { OutputAsset, OutputChunk } from 'rollup'
import { Plugin, PluginOption } from 'vite'
import indexHtmlTemplate from './index.html?raw'

declare global {
    interface ImportMetaEnv {
        NAME: '__name__'
    }

    interface Window {
        '__name__-shadow'?: WeakRef<ShadowRoot>
        '__name__-styles'?: { [_ in string]: string }
    }

    interface WindowEventMap {
        '__name__-styles': CustomEvent<string>
        '__name__-styles-request': CustomEvent
    }
}

/**
 * MFE plugin container. See individual plugin functions for documentation.
 *
 * @param name MFE name.
 * @param entries Entries aliases and paths.
 */
export const mfe = (name: string, entries: { [_ in string]: string }): PluginOption => [
    mfeBase(name),
    mfeEsm(entries),
    mfeHtml(entries),
    mfeCss(name),
    mfeSolid(name),
    mfeReact(),
]

/**
 * MfeBase plugin sets configurations for proper MFE loading in production builds or development server.
 *
 * ### Build
 *
 * `base: /` loads assets from `<origin>/path/to/asset`. However, MFEs are served from their own origin.
 * `base: ./` causes assets to be fetched from `new URL('./path/to/asset', import.meta.url)`, `import.meta.url` is
 * relative to the MFE script loading the asset, which comes from the proper origin.
 *
 * ### Serve
 *
 * Asset imports are not transformed to include the server origin as in build. `server.origin` is explicitly set to
 * `http://localhost:port` to ensure assets are fetched from localhost when accessed from another domain. `CORS` is
 * enabled for the same purpose.
 *
 * @param name MFE name.
 */
const mfeBase = (name: string): Plugin => ({
    name: 'mfe:base',
    config: ({ server: { port = 5173 } = {} }, { mode }) => ({
        base: './',
        define: { 'import.meta.env.NAME': JSON.stringify(name) },
        server: { cors: true, origin: mode === 'development' ? `http://localhost:${port}` : undefined },
        preview: { cors: true },
    }),
})

/**
 * MfeEsm plugin sets configurations to expose MFE entries as ES modules.
 *
 * ### Build
 *
 * Exposes `entries` as ES modules using `build.options.output.format: es` allowing usage of native `import(<url>)`.
 * Exports are preserved using `build.options.preserveEntrySignatures: allow-extension` to avoid facade chunks.
 * `entries` are aliased using the `build.rollupOptions.output.entryFileNames`.
 *
 * ### Serve
 *
 * A middleware is added to forward `entries` aliases. `server.warmup.clientFiles` is set to `entries` values to
 * transpile on server start. This ensures `entries` are ready to be accessed immediately.
 *
 * @param entries Entries aliases and paths.
 */
const mfeEsm = (entries: { [_ in string]: string }): Plugin => ({
    name: 'mfe:esm',
    config: () => ({
        build: {
            modulePreload: false,
            rollupOptions: {
                input: entries,
                output: { format: 'es', entryFileNames: ({ name }) => name },
                preserveEntrySignatures: 'allow-extension',
            },
        },
        server: { warmup: { clientFiles: Object.values(entries) } },
    }),
    configureServer: ({ middlewares }) =>
        void middlewares.use((req, _, next) => ((req.url = entries[req.url!.slice(1)] ?? req.url), next())),
})

/**
 * MfeHtml plugin provides an [`index.html`](./vite.index.html) template that loads all `entries` modules.
 *
 * ### Build
 *
 * `index` is defined explicitly in `rollupOptions.input`. Contents are resolved from custom `resolveId` and `load`.
 *
 * ### Serve
 *
 * Plugins do not have access to the index file in development mode. A middleware is added to intercept index requests,
 * and the template content is transformed using `transformIndexHtml`.
 *
 * @param entries Entries aliases and paths.
 */
const mfeHtml = (entries: { [_ in string]: string }): Plugin => {
    const scripts = Object.values(entries).map(entry => `<script type="module" src="/${entry}"></script>`)
    const indexHtml = indexHtmlTemplate.replace('</head>', `${scripts.join('')}</head>`)
    return {
        name: 'mfe:html',
        config: () => ({ build: { rollupOptions: { input: { index: 'index.html' } } } }),
        resolveId: id => (id === 'index.html' ? id : undefined),
        load: id => (id === 'index.html' ? indexHtml : undefined),
        configureServer: server => () => {
            const indexHtmlPromise = server.transformIndexHtml('/index.html', indexHtml, '/')
            server.middlewares.use(async (_, res) => res.end(await indexHtmlPromise))
        },
    }
}

/**
 * MfeCss plugin changes Vite's CSS handling to allow injection into JS using custom events.
 *
 * `${env.NAME}-styles` event publishes styles. `${env.NAME}-styles-request` is used to re-fire the event.
 * The events can be listened to build style tags dynamically, it works with HMR and lazy loading.
 *
 * ### Build
 *
 * CSS files are removed from the bundle and their links are stripped from HTML. JS chunks are scanned, and their CSS
 * imports are replaced by a dispatch script that publish events with CSS.
 *
 * ### Serve
 *
 * The development server emit JS files modules for CSS. These modules are modified to dispatch events with CSS.
 *
 * @param name MFE name.
 */
const mfeCss = (name: string): Plugin => {
    const dispatch = (name: ImportMetaEnv['NAME'], id: string, style: string) => {
        const setup = !window[`${name}-styles`]
        const styles = (window[`${name}-styles`] ??= {})
        styles[id] = style
        const event = () => new CustomEvent(`${name}-styles`, { detail: Object.values(styles).join('\n') })
        if (setup) addEventListener(`${name}-styles-request`, () => dispatchEvent(event()))
        dispatchEvent(new Event(`${name}-styles-request`))
    }
    return {
        name: 'mfe:css',
        enforce: 'post',
        transform: code =>
            code
                .replace(/__vite__updateStyle\(.+?\)/, `;(${dispatch})(\`${name}\`,__vite__id,__vite__css)`)
                .replace(/__vite__removeStyle\(.+?\)/, `(${dispatch})(\`${name}\`,__vite__id,'')`),
        generateBundle: (_, bundle) => {
            const html = Object.values(bundle).filter(({ fileName }) => fileName.endsWith('.html')) as OutputAsset[]
            const css = Object.values(bundle).filter(({ fileName }) => fileName.endsWith('.css')) as OutputAsset[]
            const js = Object.values(bundle).filter(({ fileName }) => fileName.endsWith('.js')) as OutputChunk[]
            html.forEach(h => (h.source = (h.source as string).replaceAll(/<link.+href="\.\/.+\.css">/g, '')))
            js.forEach(chunk => {
                const styles = css.filter(({ fileName }) => chunk.viteMetadata?.importedCss.has(fileName))
                if (!styles.length) return
                const style = styles.map(({ source }) => source.toString().trim().replaceAll('`', '\\`')).join('\n')
                chunk.code = `${chunk.code}\n\n;(${dispatch})(\`${name}\`,\`${chunk.name}\`,\`${style}\`)`
                chunk.viteMetadata?.importedCss.clear()
            })
        },
    }
}

/**
 * MfeSolid plugin enables injection of a custom container to replace `window.document` in `solid-js/web`.
 *
 * This is required when using `@webcomponents/scoped-custom-element-registry` to use a shadow DOM as document.
 * Injection works by setting `window[`${env.NAME}-shadow`] to a `WeakRef` of the shadow root to be used.
 *
 * @param name MFE name.
 */
const mfeSolid = (name: string): Plugin => ({
    name: 'mfe:solid',
    transform: code => {
        const ms = new MagicString(code)
        ms.replaceAll('document.importNode', `(window[\`${name}-shadow\`]?.deref()??document).importNode`)
        return { code: ms.toString(), map: ms.generateMap({ hires: true }) }
    },
})

/**
 * MfeReact plugin fixes a React Refresh issue on development server due to a missing preamble.
 *
 * The preamble is normally injected in `index.html` by one of vite's react plugins. When the module is sourced from a
 * parent application without the preamble, React Refresh fails. This plugin injects the preamble in JS directly to fix
 * the issue. The fix works for both `@vitejs/plugin-react` and `@vitejs/plugin-react-swc`.
 */
const mfeReact = (): Plugin => ({
    name: 'mfe:react',
    apply: 'serve',
    transform: code => {
        const ms = new MagicString(code)
        ms.replaceAll(
            /if \(!window\.(\$RefreshReg\$|__vite_plugin_react_preamble_installed__)\)/g,
            `RefreshRuntime.injectIntoGlobalHook(window)
            window.$RefreshReg$ = () => {}
            window.$RefreshSig$ = () => type => type
            window.__vite_plugin_react_preamble_installed__ = true
            if (false)`,
        )
        return { code: ms.toString(), map: ms.generateMap({ hires: true }) }
    },
})
