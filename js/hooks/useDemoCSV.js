import { STATE } from '../constants.js';
import { githubRequest } from '../api.js';
import { elements } from '../elements.js';
import { parseCSV, renderCSVTable } from '../utils/csv.js';

/** Fetches and renders the demo-metadata.csv from the user's forked repository. */
export async function loadDemoCSV() {
    const tableWrap = elements.demoCsvTableWrap;
    const loading = elements.demoCsvLoading;
    const errorEl = elements.demoCsvError;
    const table = elements.demoCsvTable;

    // Already loaded — nothing to do
    if (tableWrap && !tableWrap.classList.contains('hidden')) return;

    if (!STATE.targetRepo) return;

    // Reset state
    if (loading) loading.classList.remove('hidden');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
    if (tableWrap) tableWrap.classList.add('hidden');

    try {
        const data = await githubRequest(`/repos/${STATE.targetRepo}/contents/_data/demo-metadata.csv`);

        // GitHub returns base64-encoded content
        const raw = atob(data.content.replace(/\n/g, ''));
        renderCSVTable(raw, table, false); // False = No validation for demo data


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

