/** Validates all rows in a parsed CSV against CollectionBuilder metadata rules. */
export function validateCSV(rows) {
    const report = new Map();
    if (!rows || rows.length < 2) return report; // Need header + data

    // Normalize header to lowercase for case-insensitive column matching
    const header = rows[0].map(h => h.trim().toLowerCase());

    // Map column names to indices
    const colMap = {};
    header.forEach((h, i) => colMap[h] = i);

    // Track uniqueness
    const objectIds = new Set();

    // Iterate data rows (skipping header)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Skip empty rows (if parseCSV doesn't handle them, but our current parseCSV might return empty rows for blank lines)
        if (row.length === 0 || (row.length === 1 && !row[0])) continue;

        // Validating Row i

        // --- Required Fields (Error if invalid) ---

        // 1. objectid
        validateObjectId(row, i, colMap, report, objectIds);

        // 2. format
        const formatVal = validateFormat(row, i, colMap, report);

        // 3. title
        validateTitle(row, i, colMap, report);

        // 4. filename
        validateFilename(row, i, colMap, report, formatVal);

        // --- Visualization Fields (Yellow if missing/invalid) ---

        // 5. latitude / longitude
        validateLatLong(row, i, colMap, report);

        // 6. date
        validateDate(row, i, colMap, report);

        // --- Optional / Other Fields ---

        // 7. rights (Recommended)
        validateRights(row, i, colMap, report);

        // 8. Subject / Location (Recommended for clouds)
        validateCloudFields(row, i, colMap, report);
    }

    return report;
}

/** Validates the objectid field for presence, format, and uniqueness. */
function validateObjectId(row, rowIndex, colMap, report, objectIds) {
    const idx = colMap['objectid'];
    if (idx === undefined) return; // Column missing (global error check could be added elsewhere)

    const val = (row[idx] || '').trim();
    const key = `${rowIndex},${idx}`;

    if (!val) {
        report.set(key, { type: 'error', msg: 'Missing required objectid.' });
    } else if (/[^a-z0-9_-]/.test(val)) {
        report.set(key, { type: 'error', msg: 'Object ID must be lowercase, no spaces or special chars (except - and _).' });
    } else if (objectIds.has(val)) {
        report.set(key, { type: 'error', msg: 'Duplicate objectid.' });
    } else {
        objectIds.add(val);
    }
}

/** Validates the format field against allowed MIME types and CB types. */
function validateFormat(row, rowIndex, colMap, report) {
    const idx = colMap['format'];
    if (idx === undefined) return null;

    const val = (row[idx] || '').trim();
    const key = `${rowIndex},${idx}`;

    if (!val) {
        report.set(key, { type: 'error', msg: 'Missing required format.' });
        return null;
    }

    const validFormats = [
        'image/jpeg', 'image/png', 'application/pdf', 'audio/mp3', 'video/mp4', 'video/quicktime',
        'record', 'compound_object', 'multiple'
    ];

    if (!validFormats.includes(val)) {
        if (val.includes('/')) {
            // MIME-like but not in our strict list
            report.set(key, { type: 'warning', msg: 'Non-standard format. Standard types: image/jpeg, application/pdf, etc.' });
        } else {
            report.set(key, { type: 'warning', msg: 'Invalid format. Use a MIME type (e.g. image/jpeg) or CB type (record).' });
        }
    }
    return val;
}

/** Validates that the title field is present. */
function validateTitle(row, rowIndex, colMap, report) {
    const idx = colMap['title'];
    if (idx === undefined) return;

    const val = (row[idx] || '').trim();
    const key = `${rowIndex},${idx}`;

    if (!val) {
        report.set(key, { type: 'error', msg: 'Missing required title.' });
    }
}

/** Validates the filename field for presence and secure URL usage. */
function validateFilename(row, rowIndex, colMap, report, formatVal) {
    const idx = colMap['filename'];
    if (idx === undefined) return;

    const val = (row[idx] || '').trim();
    const key = `${rowIndex},${idx}`;

    if (!val) {
        // If record, filename is optional (external link), but usually expected unless strictly metadata-only
        if (formatVal !== 'record') {
            report.set(key, { type: 'error', msg: 'Missing filename.' });
        }
    } else {
        if (val.startsWith('http://')) {
            report.set(key, { type: 'error', msg: 'Insecure URL. Must use HTTPS.' });
        }
        // Could check extension vs format, but that's complex (e.g. image/jpeg vs .jpg/.jpeg)
    }
}

/** Validates latitude and longitude fields are valid numbers. */
function validateLatLong(row, rowIndex, colMap, report) {
    ['latitude', 'longitude'].forEach(field => {
        const idx = colMap[field];
        if (idx !== undefined) {
            const val = (row[idx] || '').trim();
            const key = `${rowIndex},${idx}`;

            if (val) {
                if (isNaN(parseFloat(val))) {
                    report.set(key, { type: 'error', msg: `Invalid ${field}. Must be a number.` });
                }
            } else {
                report.set(key, { type: 'warning', msg: `Missing ${field}. Required for Map.` });
            }
        }
    });
}

/** Validates the date field against accepted date formats. */
function validateDate(row, rowIndex, colMap, report) {
    const idx = colMap['date'];
    if (idx === undefined) return;

    const val = (row[idx] || '').trim();
    const key = `${rowIndex},${idx}`;

    if (val) {
        const yearRegex = /^\d{4}$/;
        const monthRegex = /^\d{4}-\d{2}$/;
        const dayRegex = /^\d{4}-\d{2}-\d{2}$/;
        const slashRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/; // also supported

        if (!yearRegex.test(val) && !monthRegex.test(val) && !dayRegex.test(val) && !slashRegex.test(val)) {
            report.set(key, { type: 'warning', msg: 'Invalid date format. Recommended: YYYY-MM-DD.' });
        }
    } else {
        report.set(key, { type: 'warning', msg: 'Missing date. Required for Timeline.' });
    }
}

/** Checks that the rights field is present (recommended). */
function validateRights(row, rowIndex, colMap, report) {
    const idx = colMap['rights'];
    if (idx === undefined) return;

    const val = (row[idx] || '').trim();
    const key = `${rowIndex},${idx}`;

    if (!val) {
        report.set(key, { type: 'warning', msg: 'Missing rights statement (Recommended).' });
    }
}

/** Checks that subject and location fields are present for tag cloud generation. */
function validateCloudFields(row, rowIndex, colMap, report) {
    ['subject', 'location'].forEach(field => {
        const idx = colMap[field];
        if (idx !== undefined) {
            const val = (row[idx] || '').trim();
            const key = `${rowIndex},${idx}`;
            if (!val) {
                report.set(key, { type: 'warning', msg: `Missing ${field}. Populates tag clouds.` });
            }
        }
    });
}

/** Returns a set of media filenames not found in the CSV's filename column. */
export function validateMediaFilenames(mediaFiles, csvRows) {
    const invalidNames = new Set();
    if (!mediaFiles || mediaFiles.length === 0 || !csvRows || csvRows.length < 2) {
        return invalidNames;
    }

    // Normalize header
    const header = csvRows[0].map(h => h.trim().toLowerCase());
    const filenameIdx = header.indexOf('filename');

    // No filename column, can't validate
    if (filenameIdx === -1) return invalidNames; 

    const validFilenames = new Set();
    for (let i = 1; i < csvRows.length; i++) {
        const val = csvRows[i][filenameIdx];
        if (val) validFilenames.add(val.trim());
    }

    mediaFiles.forEach(file => {
        if (!validFilenames.has(file.name)) {
            invalidNames.add(file.name);
        }
    });

    return invalidNames;
}

/** Validates a user-entered CSV filename (letters, numbers, hyphens, underscores, periods). */
export function validateCsvFilename(name) {
    if (!name) return false;
    // Regex for valid characters: a-z, A-Z, 0-9, -, _, .
    const checkRegex = /^[a-zA-Z0-9\._\-]+$/;
    return checkRegex.test(name);
}
