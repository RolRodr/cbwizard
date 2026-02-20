/**
 * Loads HTML partials, replacing placeholder elements entirely.
 * Any element with a `data-partial` attribute will be replaced by the
 * parsed content of the fetched HTML from the path specified in that attribute.
 */
export async function loadPartials() {
    const slots = document.querySelectorAll('[data-partial]');
    await Promise.all([...slots].map(async (el) => {
        const path = el.dataset.partial;
        try {
            const resp = await fetch(path);
            if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
            const html = await resp.text();
            const template = document.createElement('template');
            template.innerHTML = html;
            el.replaceWith(template.content);
        } catch (err) {
            console.error(`Failed to load partial "${path}":`, err);
        }
    }));
}