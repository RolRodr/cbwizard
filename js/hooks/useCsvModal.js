/**
 * useCsvModal — Creates and manages the CSV Validation / Edit modal.
 *
 * When a user uploads a CSV, this modal displays it as an editable table
 * with validation-error and warning highlights. Users can fix cells in-place,
 * see live re-validation, and save the corrected CSV back.
 *
 * Usage:
 *   import { initCsvModal, openCsvModal } from './hooks/useCsvModal.js';
 *   initCsvModal();                          // call once after DOMContentLoaded
 *   openCsvModal(csvText, onSaveCallback);   // open with CSV content
 */

import { parseCSV } from '../utils/csv.js';
import { serializeCSV } from '../utils/csv.js';
import { validateCSV } from '../validation.js';

let modalEl = null;
let _rows = [];          // Live 2D array of current cell values
let _onSave = null;      // Callback when user clicks "Save & Continue"

// ─────── Build ───────

/** Creates the modal DOM once and appends it to the document body. */
function buildModal() {
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'csv-modal';
    modalEl.classList.add('csv-modal-overlay', 'hidden');
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'csv-modal-title');

    modalEl.innerHTML = `
        <div class="csv-modal-panel">
            <div class="csv-modal-header">
                <h2 id="csv-modal-title">CSV Review</h2>
                <div class="csv-modal-badges" id="csv-modal-badges"></div>
                <button class="csv-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="csv-modal-top-panel">
                <div class="csv-modal-tabs" role="tablist">
                    <button class="csv-modal-tab csv-modal-tab--active" role="tab" aria-selected="true" aria-controls="csv-modal-issues" data-tab="issues">
                        <i data-lucide="alert-circle" aria-hidden="true" class="lucide-inline"></i> Issues
                    </button>
                    <button class="csv-modal-tab" role="tab" aria-selected="false" aria-controls="csv-modal-reference" data-tab="reference">
                        <i data-lucide="book-open" aria-hidden="true" class="lucide-inline"></i> Field Reference
                    </button>
                </div>
                <div id="csv-modal-issues" class="csv-modal-issues csv-modal-tab-content" role="tabpanel"></div>
                <div id="csv-modal-reference" class="csv-modal-reference csv-modal-tab-content hidden" role="tabpanel">
                    <div class="csv-modal-reference-inner">
                        <h4>Required Fields</h4>
                        <table class="demo-table csv-modal-ref-table">
                            <thead><tr><th>Field</th><th>Description</th><th>Example</th></tr></thead>
                            <tbody>
                                <tr><td><strong>objectid</strong></td><td>Unique identifier. Lowercase, no spaces or special characters.</td><td><code>coll002</code></td></tr>
                                <tr><td><strong>filename</strong></td><td>Object's filename with extension, or full HTTPS URL. Leave blank for YouTube/Vimeo.</td><td><code>letter001.pdf</code></td></tr>
                                <tr><td><strong>title</strong></td><td>Short, descriptive name for the item.</td><td><code>Haystack Rock</code></td></tr>
                                <tr><td><strong>format</strong></td><td>MIME type. Controls display. E.g. <code>image/jpeg</code>, <code>application/pdf</code>, <code>video/mp4</code>.</td><td><code>image/jpeg</code></td></tr>
                            </tbody>
                        </table>
                        <h4>Fields Required for Visualizations</h4>
                        <table class="demo-table csv-modal-ref-table">
                            <thead><tr><th>Page</th><th>Required Fields</th></tr></thead>
                            <tbody>
                                <tr><td>Map</td><td><strong>latitude</strong> &amp; <strong>longitude</strong> — geographic coordinates</td></tr>
                                <tr><td>Timeline</td><td><strong>date</strong> — format <code>yyyy-mm-dd</code>, <code>yyyy-mm</code>, or <code>yyyy</code></td></tr>
                                <tr><td>Subjects</td><td><strong>subject</strong> — semicolon-separated topics</td></tr>
                                <tr><td>Locations</td><td><strong>location</strong> — semicolon-separated place names</td></tr>
                            </tbody>
                        </table>
                        <h4>Compound Objects</h4>
                        <table class="demo-table csv-modal-ref-table">
                            <thead><tr><th>Field</th><th>Description</th><th>Example</th></tr></thead>
                            <tbody>
                                <tr><td><strong>parentid</strong></td><td>Leave blank for standalone/parent items. For child items, set to the parent's <code>objectid</code>.</td><td><code>compound001</code></td></tr>
                                <tr><td><strong>format</strong></td><td>Parent: <code>compound_object</code> (mixed media) or <code>multiple</code> (images only). Children: the media MIME type.</td><td><code>compound_object</code></td></tr>
                            </tbody>
                        </table>
                        <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">Children of <code>multiple</code> parents must be images (e.g. <code>image/jpeg</code>). See <a href="https://collectionbuilder.github.io/cb-docs/docs/metadata/compound-objects/" target="_blank" rel="noopener noreferrer">Compound Objects docs</a>.</p>
                        <h4>Optional (Recommended)</h4>
                        <ul>
                            <li><strong>youtubeid</strong> — YouTube video ID (only for YouTube items)</li>
                            <li><strong>vimeoid</strong> — Vimeo video ID (only for Vimeo items)</li>
                            <li><strong>creator</strong> — entity who made the resource; semicolon-separated</li>
                            <li><strong>description</strong> — brief account of the item</li>
                            <li><strong>source</strong> — related source collection</li>
                            <li><strong>identifier</strong> — unique ID from the source collection</li>
                            <li><strong>type</strong> — DCMI Type (e.g. <code>Image;StillImage</code>, <code>Text</code>)</li>
                            <li><strong>language</strong> — ISO 639-2 code (e.g. <code>eng</code>)</li>
                            <li><strong>rights</strong> — free-text rights statement</li>
                            <li><strong>rightsstatement</strong> — standardized rights URI</li>
                        </ul>
                        <p class="csv-modal-ref-link">Full details: <a href="https://collectionbuilder.github.io/cb-docs/docs/metadata/gh_metadata/" target="_blank" rel="noopener noreferrer">CollectionBuilder Metadata Docs <i data-lucide="external-link" aria-hidden="true" class="lucide-inline"></i></a></p>
                    </div>
                </div>
            </div>
            <div class="csv-modal-body">
                <div class="csv-modal-table-wrap">
                    <table id="csv-modal-table" class="demo-table csv-modal-table"></table>
                </div>
            </div>
            <div class="csv-modal-footer">
                <div class="csv-modal-footer-summary" id="csv-modal-footer-summary"></div>
                <div class="csv-modal-footer-actions">
                    <button id="csv-modal-cancel" type="button" class="csv-modal-btn csv-modal-btn--secondary">Cancel</button>
                    <button id="csv-modal-save" type="button" class="csv-modal-btn csv-modal-btn--primary">Save &amp; Continue</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);
    window.lucide?.createIcons();

    // ── Wire event listeners ──

    // Close button
    modalEl.querySelector('.csv-modal-close')
        .addEventListener('click', closeCsvModal);

    // Cancel button
    document.getElementById('csv-modal-cancel')
        .addEventListener('click', closeCsvModal);

    // Save button
    document.getElementById('csv-modal-save')
        .addEventListener('click', handleSave);

    // Backdrop click
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeCsvModal();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl && !modalEl.classList.contains('hidden')) {
            closeCsvModal();
        }
    });

    // Tab toggle (Issues / Field Reference)
    modalEl.querySelectorAll('.csv-modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            modalEl.querySelectorAll('.csv-modal-tab').forEach(t => {
                t.classList.remove('csv-modal-tab--active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('csv-modal-tab--active');
            tab.setAttribute('aria-selected', 'true');

            modalEl.querySelectorAll('.csv-modal-tab-content').forEach(panel => {
                panel.classList.add('hidden');
            });
            const panelId = target === 'issues' ? 'csv-modal-issues' : 'csv-modal-reference';
            document.getElementById(panelId).classList.remove('hidden');
        });
    });
}

// ─────── Open / Close ───────

/**
 * Opens the CSV modal with the given CSV text, validates it, and renders
 * an editable table. Accepts a callback that will be invoked with the
 * (potentially corrected) CSV text when the user clicks "Save & Continue".
 */
export function openCsvModal(csvText, onSave) {
    if (!modalEl) buildModal();

    _onSave = onSave || null;
    _rows = parseCSV(csvText);

    renderTable();
    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // prevent background scroll

    // Focus the close button for accessibility
    const closeBtn = modalEl.querySelector('.csv-modal-close');
    if (closeBtn) closeBtn.focus();
}

/** Closes / hides the CSV modal. */
export function closeCsvModal() {
    if (modalEl) modalEl.classList.add('hidden');
    document.body.style.overflow = '';
}

/** Initializes the modal DOM (call once after DOMContentLoaded). */
export function initCsvModal() {
    buildModal();
}

// ─────── Render ───────

/** Renders (or re-renders) the editable table from `_rows` and updates badges. */
function renderTable() {
    const tableEl = document.getElementById('csv-modal-table');
    if (!tableEl || _rows.length === 0) return;

    const report = validateCSV(_rows);

    tableEl.innerHTML = '';

    // ── Header ──
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Row-number header (empty corner cell)
    const thCorner = document.createElement('th');
    thCorner.classList.add('csv-modal-row-num');
    thCorner.textContent = '#';
    headerRow.appendChild(thCorner);

    _rows[0].forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    tableEl.appendChild(thead);

    // ── Body ──
    const tbody = document.createElement('tbody');
    const colCount = _rows[0].length;

    for (let ri = 1; ri < _rows.length; ri++) {
        const tr = document.createElement('tr');

        // Row number cell
        const tdNum = document.createElement('td');
        tdNum.classList.add('csv-modal-row-num');
        tdNum.textContent = ri + 1; // Display as 1-indexed (header = row 1)
        tr.appendChild(tdNum);

        for (let ci = 0; ci < colCount; ci++) {
            const td = document.createElement('td');
            td.textContent = _rows[ri]?.[ci] || '';
            td.setAttribute('contenteditable', 'true');
            td.setAttribute('data-row', ri);
            td.setAttribute('data-col', ci);

            // Validation highlights
            const key = `${ri},${ci}`;
            const issue = report.get(key);
            if (issue) {
                applyIssue(td, issue);
            }

            // Live re-validation on edit
            td.addEventListener('blur', handleCellEdit);

            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    tableEl.appendChild(tbody);

    // Update badges & footer
    updateSummary(report);
}

/** Applies error/warning styling + tooltip to a cell. */
function applyIssue(td, issue) {
    td.classList.remove('cell-error', 'cell-warning');
    if (issue.type === 'error') {
        td.classList.add('cell-error');
    } else if (issue.type === 'warning') {
        td.classList.add('cell-warning');
    }
    td.setAttribute('data-tooltip', issue.msg);
    td.setAttribute('title', issue.msg);
}

/** Clears error/warning styling from a cell. */
function clearIssue(td) {
    td.classList.remove('cell-error', 'cell-warning');
    td.removeAttribute('data-tooltip');
    td.removeAttribute('title');
}

// ─────── Cell Edit Handler ───────

/** Called when a cell loses focus — syncs value back to `_rows`, re-validates. */
function handleCellEdit(e) {
    const td = e.target;
    const ri = parseInt(td.getAttribute('data-row'), 10);
    const ci = parseInt(td.getAttribute('data-col'), 10);

    // Ensure the row array exists and is long enough
    while (_rows.length <= ri) _rows.push([]);
    while (_rows[ri].length <= ci) _rows[ri].push('');

    _rows[ri][ci] = td.textContent;

    // Re-validate the entire dataset
    const report = validateCSV(_rows);

    // Update ALL visible cells (not just this one, since some rules are cross-row)
    const tbody = document.querySelector('#csv-modal-table tbody');
    if (tbody) {
        const tds = tbody.querySelectorAll('td[data-row]');
        tds.forEach(cell => {
            const r = cell.getAttribute('data-row');
            const c = cell.getAttribute('data-col');
            const key = `${r},${c}`;
            const issue = report.get(key);
            if (issue) {
                applyIssue(cell, issue);
            } else {
                clearIssue(cell);
            }
        });
    }

    updateSummary(report);
}

// ─────── Summary / Badges ───────

/** Updates the header badges, footer summary, and issues list. */
function updateSummary(report) {
    let errorCount = 0;
    let warningCount = 0;
    const errors = [];
    const warnings = [];
    const header = _rows[0] || [];

    for (const [key, issue] of report) {
        const [rowStr, colStr] = key.split(',');
        const rowNum = parseInt(rowStr, 10) + 1; // display as 1-indexed line
        const colIndex = parseInt(colStr, 10);
        const colName = header[colIndex] || `Column ${colIndex + 1}`;
        const entry = { rowNum, colName, msg: issue.msg };

        if (issue.type === 'error') {
            errorCount++;
            errors.push(entry);
        } else if (issue.type === 'warning') {
            warningCount++;
            warnings.push(entry);
        }
    }

    // ── Header badges ──
    const badgesEl = document.getElementById('csv-modal-badges');
    if (badgesEl) {
        badgesEl.innerHTML = '';
        if (errorCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'csv-modal-badge csv-modal-badge--error';
            badge.textContent = `${errorCount} error${errorCount > 1 ? 's' : ''}`;
            badgesEl.appendChild(badge);
        }
        if (warningCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'csv-modal-badge csv-modal-badge--warning';
            badge.textContent = `${warningCount} warning${warningCount > 1 ? 's' : ''}`;
            badgesEl.appendChild(badge);
        }
        if (errorCount === 0 && warningCount === 0) {
            const badge = document.createElement('span');
            badge.className = 'csv-modal-badge csv-modal-badge--success';
            badge.innerHTML = '<i data-lucide="check" aria-hidden="true" class="lucide-inline"></i> All clear';
            badgesEl.appendChild(badge);
        }
    }

    // ── Issues list ──
    const issuesEl = document.getElementById('csv-modal-issues');
    if (issuesEl) {
        issuesEl.innerHTML = '';

        if (errors.length > 0) {
            const section = document.createElement('div');
            section.className = 'csv-modal-issues-group csv-modal-issues-group--error';
            section.innerHTML = `<h4>Critical Errors (${errors.length})</h4>`;
            const ul = document.createElement('ul');
            errors.forEach(e => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${e.colName}</strong> · Row ${e.rowNum} — ${e.msg}`;
                ul.appendChild(li);
            });
            section.appendChild(ul);
            issuesEl.appendChild(section);
        }

        if (warnings.length > 0) {
            const section = document.createElement('div');
            section.className = 'csv-modal-issues-group csv-modal-issues-group--warning';
            section.innerHTML = `<h4>Warnings (${warnings.length})</h4>`;
            const ul = document.createElement('ul');
            warnings.forEach(w => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${w.colName}</strong> · Row ${w.rowNum} — ${w.msg}`;
                ul.appendChild(li);
            });
            section.appendChild(ul);
            issuesEl.appendChild(section);
        }

        if (errors.length === 0 && warnings.length === 0) {
            issuesEl.innerHTML = '<div class="csv-modal-issues-ok"><i data-lucide="check" aria-hidden="true" class="lucide-inline"></i> No issues found — your CSV looks great!</div>';
        }
    }

    // ── Footer summary ──
    const footerSummary = document.getElementById('csv-modal-footer-summary');
    if (footerSummary) {
        if (errorCount > 0) {
            footerSummary.innerHTML = `<span class="csv-modal-footer-error"><i data-lucide="alert-triangle" aria-hidden="true" class="lucide-inline"></i> ${errorCount} critical error${errorCount > 1 ? 's' : ''} must be fixed before continuing.</span>`;
        } else if (warningCount > 0) {
            footerSummary.innerHTML = `<span class="csv-modal-footer-warn">${warningCount} warning${warningCount > 1 ? 's' : ''} found — you can still continue.</span>`;
        } else {
            footerSummary.innerHTML = `<span class="csv-modal-footer-ok">No issues found. Ready to continue.</span>`;
        }
    }

    // ── Save button warning state ──
    const saveBtn = document.getElementById('csv-modal-save');
    if (saveBtn) {
        saveBtn.disabled = false;
        if (errorCount > 0) {
            saveBtn.classList.add('csv-modal-btn--warn');
            saveBtn.textContent = 'Save Anyway';
        } else {
            saveBtn.classList.remove('csv-modal-btn--warn');
            saveBtn.textContent = 'Save & Continue';
        }
    }
    window.lucide?.createIcons();
}

// ─────── Save Handler ───────

/** Serializes the current cell data back to CSV text and invokes the onSave callback. */
function handleSave() {
    const csvText = serializeCSV(_rows);
    closeCsvModal();
    if (typeof _onSave === 'function') {
        _onSave(csvText);
    }
}
