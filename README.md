# @\_apparatus\_/microfrontend-vite

[![bundle size](https://deno.bundlejs.com/?q=@_apparatus_/microfrontend-vite&badge=detailed)](https://bundlejs.com/?q=@_apparatus_/microfrontend-vite)

A [Vite](https://vitejs.dev/) plugin and a runtime utility for building and managing ECMAScript module based micro-frontends (MFEs).

## Key Features

-   **Vite Plugin**: Simplifies the configuration and build process for MFEs.
-   **ES Module Support**: Leverages native ES modules for loading and managing MFE dependencies.
-   **CSS Isolation**: Provides a mechanism for isolating CSS styles within each MFE.
-   **Shadow DOM**: Utilizes Shadow DOM to encapsulate MFE content and prevent style conflicts.
-   **React and SolidJS Support**: Includes specific fixes and adaptations for seamless integration with React and SolidJS.

## Installation

```bash
npm install @_apparatus_/microfrontend-vite
```

## Usage (Plugin)

To use the plugin, first import it in your `vite.config.ts` file and call the plugin with the MFE name and entries.

### Basic usage

You may defined zero or more script entries. Each entry will generate one output file with the entry key as the file name.

```typescript
import { defineConfig } from 'vite'
import { mfe } from '@_apparatus_/microfrontend-vite'

export default defineConfig({
    plugins: [mfe('mfe-name', { 'index.js': './src/index.ts', 'secondary.ts': './src/secondary.ts' })],
})
```

### Custom index.html

An `index.html` file is provided automatically, if your MFE can run standalone and you want to customize starting styles and DOM, you can override the default template by providing an `index` entry.

```typescript
import { mfe } from '@_apparatus_/microfrontend-vite'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
    plugins: [solid(), mfe('mfe-name', { index: './index.html', 'index.js': './src/index.ts' })],
})
```

### With other plugins

You can use it together with any other vite plugins e.g. for rendering libraries such as [solid-js](https://www.solidjs.com/) and [react](https://react.dev), or for styling utilities such as [tailwind](https://tailwindcss.com/).

```typescript
import { mfe } from '@_apparatus_/microfrontend-vite'
import tailwind from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
    plugins: [solid(), tailwind(), mfe('mfe-name', { 'index.js': './src/index.ts' })],
})
```

## Usage (Runtime)

This package also provides runtime utilities to simplify the creation of MFEs. These utilities are designed to be used within your microfrontend code to handle tasks such as:

### Core Functions

#### `getMfe()`

Gets the MFE name provided in the plugin's `mfe` function.

```typescript
import { getMfe } from '@_apparatus_/microfrontend-vite'

const mfeName = getMfe()
console.log(mfeName)
```

#### `getStyle()`

Create and return a new style tag connected to the MFE's styles. The style tag is subscribed to the MFE styles notification events, any newly loaded style from asynchronous imports/chunks will be added to the style tag automatically.

Style tags are unsubscribed automatically to the styles notification events when they are garbage collected.

By default, you will not need this function when using `bootstrap`, it automatically calls it and appends the styles to your MFE shadow root.

```typescript
import { getStyle } from '@_apparatus_/microfrontend-vite'

const styleElement = getStyle()
console.log(styleElement)
```

#### `getShadow()`

After your MFE is mounted by `bootstrap`, you can use this function to retrieve the MFE's shadow root. After your MFE unmounts, the shadow root will be garbage collected automatically as long as not references to it are kept.

```typescript
import { getShadow } from '@_apparatus_/microfrontend-vite'

const shadowRoot = getShadow()
console.log(styleElement)
```

#### `bootstrap(<shadow-init-options>, <shadow-render-function>)`

Bootstrap creates the MFE mount function. It does some MFE isolation procedures:

-   Attaching a shadow DOM to the host element.
-   Appending style to the shadow DOM.

Parameters:

-   options: `ShadowRootInit` options for the shadow DOM.
-   `render`: A render function that receives the shadow DOM and any additional parameters. It must return a cleanup function that will be called when the MFE is unmounted.

```typescript
import { bootstrap } from '@_apparatus_/microfrontend-vite'

export default bootstrap({ mode: 'open' }, (shadow, params) => {
    const div = document.createElement('div')
    div.textContent = 'hello world!'
    shadow.appendChild(div)
    return () => shadow.removeChild(div)
})
```
