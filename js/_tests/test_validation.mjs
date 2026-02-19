/**
 * Test script for validation.js
 * Run with: node test_validation.js
 */
import { validateCSV } from '../validation.js';

const headers = ['objectid', 'title', 'format', 'filename', 'date', 'latitude', 'longitude'];

const testData = [
    headers,
    // Row 1: Valid
    ['obj_001', 'My Title', 'image/jpeg', 'file.jpg', '2020-01-01', '45.0', '-110.0'],
    // Row 2: Missing objectid, invalid format, bad date, bad lat
    ['', 'Title 2', 'bad/format', 'file2.jpg', '2020/01/01', 'not-a-number', '-110.0'],
    // Row 3: Duplicate objectid, missing title
    ['obj_001', '', 'image/jpeg', 'file3.jpg', '2020-01-01', '45.0', '-110.0']
];

console.log('--- Running Validation Test ---');
const report = validateCSV(testData);

for (const [key, value] of report.entries()) {
    console.log(`Cell [${key}]: ${value.type.toUpperCase()} - ${value.msg}`);
}

// Expected:
// Row 2 (index 2): 
// - objectid (col 0): Error (missing)
// - format (col 2): Warning (invalid)
// - date (col 4): Warning (format)
// - lat (col 5): Error (NaN)

// Row 3 (index 3):
// - objectid (col 0): Error (duplicate of obj_001)
// - title (col 1): Error (missing)

import { validateMediaFilenames } from '../validation.js';

console.log('\n--- Running Media Filename Validation Test ---');
const imageTestData = [
    { name: 'file.jpg', type: 'image/jpeg' },
    { name: 'file2.jpg', type: 'image/jpeg' },
    { name: 'random.png', type: 'image/png' } // Invalid
];

// Re-using testData from above which has 'file.jpg' and 'file2.jpg' in filename column
const invalidImages = validateMediaFilenames(imageTestData, testData);

console.log('Invalid Images:', [...invalidImages]);

// Expected:
// 'random.png' should be in the set.
// 'file.jpg' and 'file2.jpg' should NOT be in the set.

if (invalidImages.has('random.png') && !invalidImages.has('file.jpg') && invalidImages.size === 1) {
    console.log('PASS: Image validation logic is correct.');
} else {
    console.error('FAIL: Image validation logic failed.');
}
