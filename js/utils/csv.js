/**
 * Shared CSV utilities used by useDemoCSV.js, useFiles.js, and ui.js.
 */

/** Parses CSV text into a 2D array of rows and columns (RFC 4180 compliant). */
export function parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (!line.trim()) continue;
        const cols = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (ch === ',' && !inQuotes) {
                cols.push(cur); cur = '';
            } else {
                cur += ch;
            }
        }
        cols.push(cur);
        rows.push(cols);
    }
    return rows;
}

import { validateCSV } from '../validation.js';

/** Parses CSV text, renders it as an HTML table, and optionally validates cells. */
export function renderCSVTable(csvText, tableEl, shouldValidate = true) {
    if (!tableEl) return;
    tableEl.innerHTML = '';

    const rows = parseCSV(csvText);
    if (rows.length === 0) return;

    // Run validation only if requested
    let validationReport = new Map();
    if (shouldValidate) {
        validationReport = validateCSV(rows);
    }

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Header
    rows[0].forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Data rows
    rows.slice(1).forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        const originalRowIndex = rowIndex + 1;
        const colCount = rows[0].length; // Use header length as source of truth

        for (let colIndex = 0; colIndex < colCount; colIndex++) {
            const cell = row[colIndex] || ''; // Pad with empty string if missing
            const td = document.createElement('td');
            td.textContent = cell;

            // Check validation if enabled
            if (shouldValidate) {
                const key = `${originalRowIndex},${colIndex}`;
                const issue = validationReport.get(key);
                if (issue) {
                    if (issue.type === 'error') {
                        td.classList.add('cell-error');
                    } else if (issue.type === 'warning') {
                        td.classList.add('cell-warning');
                    }
                    td.setAttribute('data-tooltip', issue.msg);
                    td.setAttribute('title', issue.msg); // Fallback
                }
            }

            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);

    // Check if any errors exist in the report
    let hasErrors = false;
    for (const val of validationReport.values()) {
        if (val.type === 'error') {
            hasErrors = true;
            break;
        }
    }
    return { hasErrors, validationReport, header: rows[0] };
}
