import assert from 'node:assert/strict'
import test from 'node:test'
import { bootstrap, getShadow } from './index.ts'

test('bootstrap', async () => {
    const mount = bootstrap({ mode: 'open' }, shadow => {
        const content = shadow.appendChild(document.createElement('div'))
        return () => content.remove()
    })
    const host = document.body.appendChild(document.createElement('article'))
    const dispose = mount(host, {})
    const shadow = getShadow()
    assert.ok(shadow)
    assert.equal(shadow.querySelector('article')?.shadowRoot, shadow)
    assert.ok()
    // await vi.exists(vi.find('article', 'div'))
    // dispose()
    gc
    // await vi.notExists(vi.find('article', 'div'))
})
