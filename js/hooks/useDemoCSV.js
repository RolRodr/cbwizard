import { ELEMENTS } from '../elements.js';
import { renderCSVTable } from '../utils/csv.js';

/** Fetches and renders the local demo-metadata.csv from assets/. */
export async function loadDemoCSV() {
    const tableWrap = ELEMENTS.demoCsvTableWrap;
    const loading = ELEMENTS.demoCsvLoading;
    const errorEl = ELEMENTS.demoCsvError;
    const table = ELEMENTS.demoCsvTable;

    // Already loaded — nothing to do
    if (tableWrap && !tableWrap.classList.contains('hidden')) return;

    // Reset state
    if (loading) loading.classList.remove('hidden');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
    if (tableWrap) tableWrap.classList.add('hidden');

    try {
        const resp = await fetch('assets/demo-metadata.csv');
        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
        const raw = await resp.text();
        renderCSVTable(raw, table, false); // false = no validation for demo data

        if (loading) loading.classList.add('hidden');
        if (tableWrap) tableWrap.classList.remove('hidden');
    } catch (err) {
        if (loading) loading.classList.add('hidden');
        if (errorEl) {
            errorEl.textContent = `Could not load demo data: ${err.message}`;
            errorEl.classList.remove('hidden');
        }
    }
}

