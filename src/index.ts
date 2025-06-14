/**
 * MFE module exports common to all MFEs.
 *
 * It is expected that the mount function returned by {@linkcode bootstrap} will be exported as `default`.
 * The MFE mount function may accept additional partial parameters, and the MFE module may export additional utilities.
 * In both cases it is not possible to share type information, the host must know the MFE types ahead of time, because
 * of that, it is not recommended to expect additional parameters or export additional properties.
 *
 * @param TParams MFE mount additional parameters type.
 * @param TExports MFE module additional exports type.
 */
export type MfeModule<TParams = object, TExports = object> = {
    default: (host: HTMLElement, params: { basePath?: string } & Partial<TParams>) => () => void
} & TExports

/**
 * Return the MFE name.
 *
 * Using a plugin, `import.meta.env.MFE` is preserved in the bundle. The environment variable defined by `plugin.ts` is
 * only injected into this module when bundled by the MFE, not by this package itself.
 */
export const getMfe = (): ImportMetaEnv['MFE'] => import.meta.env.MFE

/**
 * Create a style element and connects it to the plugin's `mfe:css` events.
 *
 * All styles are written to the style element when it is imported, also works for asynchronous modules or chunks.
 */
export const getStyle = () => {
    const style = document.createElement('style')
    const ref = new WeakRef(style)
    const abort = new AbortController()
    const { signal } = abort
    new FinalizationRegistry<AbortController>(abort => abort.abort()).register(style, abort)
    addEventListener(`${getMfe()}-styles`, e => ref.deref()?.replaceChildren(e.detail), { signal })
    dispatchEvent(new CustomEvent(`${getMfe()}-styles-request`))
    return style
}

/**
 * Get a reference to the current MFE's shadow root.
 *
 * The reference is stored in a `WeakRef`, keeping references to it will prevent the MFE to be fully evicted after
 * dispose. This reference is also used by integrations with external libraries, such as allowing `solid-js` to work
 * with `@webcomponents/scoped-custom-elements-registry`.
 */
export const getShadow = (): ShadowRoot | undefined => window[`${getMfe()}-shadow`]?.deref()

/**
 * Set the reference to the shadow root on MFE mount.
 *
 * @param shadow MFE shadow root.
 */
const setShadow = (shadow: ShadowRoot) => (window[`${getMfe()}-shadow`] = new WeakRef(shadow))

/**
 * Create a MFE mount function that performs MFE isolation procedures and calls the MFE `render` function.
 *
 * Isolation procedures:
 * - Set `host` dataset to the MFE name for debugging purposes.
 * - Set up the shadow root as the MFE container and make it available through `getShadow`.
 * - Subscribe to the style notifications using `getStyle` and append styles to the shadow root.
 *
 * The `render` dispose is returned.
 *
 * @param options Shadow root initialization options.
 * @param render MFE render function.
 * @param host MFE host element.
 * @param params Render params.
 * @param TParams Additional render parameters.
 */
export const bootstrap =
    <TParams>(
        options: ShadowRootInit,
        render: (shadow: ShadowRoot, params: Parameters<MfeModule<TParams>['default']>[1]) => () => void,
    ): MfeModule<TParams>['default'] =>
    (host, params) => {
        host.dataset.mfe = host.dataset.test = getMfe()
        const shadow = host.attachShadow(options)
        setShadow(shadow)
        shadow.append(getStyle())
        return render(shadow, params)
    }
