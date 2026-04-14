/**
 * Shared CSV utilities used by useDemoCSV.js, useCsvUpload.js, useConfigStep.js, and ui.js.
 */

/** Parses CSV text into a 2D array of rows and columns (RFC 4180 compliant). */
export function parseCSV(text) {
    const rows = [];
    const cols = [];
    let cur = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    cur += '"';
                    i += 2;
                } else {
                    inQuotes = false;
                    i++;
                }
            } else {
                cur += ch;
                i++;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
                i++;
            } else if (ch === ',') {
                cols.push(cur);
                cur = '';
                i++;
            } else if (ch === '\r' || ch === '\n') {
                // End of record
                cols.push(cur);
                cur = '';
                // Only add non-empty rows
                if (cols.length > 1 || cols[0] !== '') {
                    rows.push(cols.slice());
                }
                cols.length = 0;
                // Skip \r\n as a single line ending
                if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
                    i += 2;
                } else {
                    i++;
                }
            } else {
                cur += ch;
                i++;
            }
        }
    }

    // Handle last record (if file doesn't end with newline)
    if (cur || cols.length > 0) {
        cols.push(cur);
        if (cols.length > 1 || cols[0] !== '') {
            rows.push(cols.slice());
        }
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

    // Allow clicking on truncated cells to expand/collapse their full value
    tableEl.addEventListener('click', (e) => {
        const td = e.target.closest('td');
        if (!td || !tableEl.contains(td)) return;
        td.classList.toggle('cell-expanded');
    });

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

/** Converts a 2D array of rows/columns back into a CSV string (RFC 4180). */
export function serializeCSV(rows) {
    return rows.map(row =>
        row.map(cell => {
            const val = cell == null ? '' : String(cell);
            // Quote the field if it contains a comma, quote, or newline
            if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
                return '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        }).join(',')
    ).join('\n');
}
