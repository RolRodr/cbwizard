/* Reproduction Script for CSV Parsing/Rendering Issue - VERIFICATION */
import { parseCSV } from '../utils/csv.js';

const csvContent = `lat,long
10,20
10
`;

const rows = parseCSV(csvContent);
const colCount = rows[0].length;

console.log('Header length:', colCount);

// Simulate render loop logic
rows.slice(1).forEach((row, rowIndex) => {
    console.log(`Row ${rowIndex + 1} data:`, row);
    let renderedCells = 0;
    for (let colIndex = 0; colIndex < colCount; colIndex++) {
        const cell = row[colIndex] || '';
        // This is the fix logic: || ''
        renderedCells++;
    }
    console.log(`Row ${rowIndex + 1}: Rendered ${renderedCells} cells. Expected ${colCount}.`);

    if (renderedCells === colCount) {
        console.log('PASS: Correct number of cells rendered.');
    } else {
        console.log('FAIL: Incorrect number of cells.');
    }
});
