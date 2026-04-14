import { STATE } from '../constants.js';
import { ELEMENTS } from '../elements.js';
import { saveFileToDB } from '../storage.js';
import { githubRequest, getRepoContents } from '../api.js';
import { updateUI } from '../ui.js';
import { parseCSV, renderCSVTable } from '../utils/csv.js';
import { validateCSV } from '../validation.js';
import { validateCsvFilename } from '../validation.js';
import { enableDropZone } from '../utils/dragdrop.js';
import { openCsvModal } from './useCsvModal.js';
import { prepareConfigStep } from './useConfigStep.js';

// ─────── CSV Status Card ───────

/** Updates the Step 3 status card with filename and validation summary. */
function updateCsvStatusCard(fileName, csvText) {
    const filenameEl = document.getElementById('csv-status-filename');
    const badgeEl = document.getElementById('csv-status-badge');
    if (filenameEl) filenameEl.textContent = fileName;

    if (badgeEl) {
        const rows = parseCSV(csvText);
        const report = validateCSV(rows);
        let errorCount = 0;
        let warningCount = 0;
        for (const issue of report.values()) {
            if (issue.type === 'error') errorCount++;
            else if (issue.type === 'warning') warningCount++;
        }

        badgeEl.className = 'csv-modal-badge';
        if (errorCount > 0) {
            badgeEl.classList.add('csv-modal-badge--error');
            badgeEl.textContent = `${errorCount} error${errorCount > 1 ? 's' : ''}`;
        } else if (warningCount > 0) {
            badgeEl.classList.add('csv-modal-badge--warning');
            badgeEl.textContent = `${warningCount} warning${warningCount > 1 ? 's' : ''}`;
        } else {
            badgeEl.classList.add('csv-modal-badge--success');
            badgeEl.innerHTML = '<i data-lucide="check" aria-hidden="true" class="lucide-inline"></i> All clear';
        }
        window.lucide?.createIcons();
    }
}

// ─────── Inline CSV Preview ───────

/**
 * Renders the inline read-only CSV preview table with validation highlights
 * and a summary of errors/warnings.
 */
function showCsvPreview(csvText, fileName) {
    const previewEl = document.getElementById('csv-inline-preview');
    const tableEl = document.getElementById('csv-inline-preview-table');
    const badgesEl = document.getElementById('csv-inline-preview-badges');
    const hintEl = document.getElementById('csv-inline-preview-hint');

    if (!previewEl || !tableEl) return;

    // Render table with validation highlights
    const result = renderCSVTable(csvText, tableEl, true);

    // Count errors and warnings
    let errorCount = 0;
    let warningCount = 0;
    if (result && result.validationReport) {
        for (const issue of result.validationReport.values()) {
            if (issue.type === 'error') errorCount++;
            else if (issue.type === 'warning') warningCount++;
        }
    }

    // Update validation summary badges
    if (badgesEl) {
        badgesEl.innerHTML = '';
        if (errorCount > 0) {
            const b = document.createElement('span');
            b.className = 'csv-modal-badge csv-modal-badge--error';
            b.textContent = `${errorCount} error${errorCount > 1 ? 's' : ''}`;
            badgesEl.appendChild(b);
        }
        if (warningCount > 0) {
            const b = document.createElement('span');
            b.className = 'csv-modal-badge csv-modal-badge--warning';
            b.textContent = `${warningCount} warning${warningCount > 1 ? 's' : ''}`;
            badgesEl.appendChild(b);
        }
        if (errorCount === 0 && warningCount === 0) {
            const b = document.createElement('span');
            b.className = 'csv-modal-badge csv-modal-badge--success';
            b.innerHTML = '<i data-lucide="check" aria-hidden="true" class="lucide-inline"></i> All clear';
            badgesEl.appendChild(b);
        }
    }

    // Hint text
    if (hintEl) {
        const rows = parseCSV(csvText);
        const dataRowCount = Math.max(0, rows.length - 1);
        const colCount = rows[0]?.length || 0;
        let hint = `${dataRowCount} row${dataRowCount !== 1 ? 's' : ''}, ${colCount} column${colCount !== 1 ? 's' : ''}.`;
        if (errorCount > 0 || warningCount > 0) {
            hint += ' Hover over highlighted cells to see details. Use the CSV Editor to fix issues.';
        }
        hintEl.textContent = hint;
    }

    previewEl.classList.remove('hidden');
    window.lucide?.createIcons();
}

/** Hides the inline CSV preview. */
function hideCsvPreview() {
    const previewEl = document.getElementById('csv-inline-preview');
    if (previewEl) previewEl.classList.add('hidden');
    STATE.csvUploadedToRepo = false; // New CSV source selected — needs re-upload
}

// ─────── Repo CSV Picker ───────

let _configMetadataName = null;
let _pickerLoaded = false;

/**
 * Fetches CSV files from the repo's _data/ directory and the config's
 * metadata value, then populates the dropdown picker. Called when Step 3 loads.
 */
export async function loadRepoCsvPicker() {
    if (_pickerLoaded || !STATE.targetRepo) return;
    _pickerLoaded = true;

    const pickerEl = document.getElementById('repo-csv-picker');
    const selectEl = document.getElementById('repo-csv-select');
    if (!pickerEl || !selectEl) return;

    const [owner, repoName] = STATE.targetRepo.split('/');

    try {
        const [dataContents, configData] = await Promise.all([
            getRepoContents(owner, repoName, '_data').catch(() => []),
            getRepoContents(owner, repoName, '_config.yml').catch(() => null)
        ]);

        if (configData && configData.content) {
            const configStr = decodeURIComponent(escape(atob(configData.content.replace(/\n/g, ''))));
            const match = configStr.match(/^metadata:\s*(.*)/m);
            if (match) {
                _configMetadataName = match[1].trim().replace(/^["']|["']$/g, '');
            }
        }

        const csvFiles = (Array.isArray(dataContents) ? dataContents : [])
            .filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.csv') && !f.name.toLowerCase().startsWith('config'));

        if (csvFiles.length === 0) {
            selectEl.innerHTML = '<option value="">No CSV files found in _data/</option>';
            return;
        }

        selectEl.innerHTML = '<option value="">— Select a file —</option>';
        csvFiles.forEach(file => {
            const opt = document.createElement('option');
            opt.value = `_data/${file.name}`;
            opt.textContent = file.name;
            selectEl.appendChild(opt);
        });

    } catch (err) {
        console.warn('Failed to load repo _data/ CSV list:', err);
    }
}

/** Shows whether the selected CSV filename matches the _config.yml metadata value. */
function updateConfigMatchIndicator(selectedPath) {
    const matchEl = document.getElementById('repo-csv-config-match');
    if (!matchEl) return;

    if (!selectedPath || !_configMetadataName) {
        matchEl.classList.add('hidden');
        return;
    }

    const selectedName = selectedPath.split('/').pop().replace(/\.csv$/i, '');
    const isMatch = selectedName === _configMetadataName;

    matchEl.classList.remove('hidden');
    if (isMatch) {
        matchEl.className = 'repo-csv-config-match repo-csv-config-match--ok';
        matchEl.innerHTML = `<i data-lucide="check" aria-hidden="true" class="lucide-inline"></i> Matches your <code>_config.yml</code> metadata setting (<code>${_configMetadataName}</code>)`;
    } else {
        matchEl.className = 'repo-csv-config-match repo-csv-config-match--warn';
        matchEl.innerHTML = `<i data-lucide="alert-triangle" aria-hidden="true" class="lucide-inline"></i> Your <code>_config.yml</code> expects <code>${_configMetadataName}</code> but you selected <code>${selectedName}</code>`;
    }
    window.lucide?.createIcons();
}

// ─────── Step 3 Event Listeners ───────

/** Registers all event listeners for the Step 3 CSV acquisition flow. */
export function registerCsvUploadListeners() {

    // Enable drag-and-drop on CSV input
    enableDropZone(ELEMENTS.csvInput, { label: 'Drop your CSV metadata file here' });

    // ── Step 3 View Switching ──
    if (ELEMENTS.proceedToUploadBtn) {
        ELEMENTS.proceedToUploadBtn.addEventListener('click', () => {
            ELEMENTS.step3InfoView.classList.add('hidden');
            ELEMENTS.step3UploadView.classList.remove('hidden');
        });
    }

    if (ELEMENTS.backToInfoBtn) {
        ELEMENTS.backToInfoBtn.addEventListener('click', () => {
            ELEMENTS.step3UploadView.classList.add('hidden');
            ELEMENTS.step3InfoView.classList.remove('hidden');
        });
    }

    const showUploadSection = (sectionToShow) => {
        ELEMENTS.csvUploadChoicesContainer.classList.add('hidden');
        ELEMENTS.uploadCsvSection.classList.add('hidden');
        ELEMENTS.repoCsvPicker.classList.add('hidden');
        ELEMENTS.googleSheetsSection.classList.add('hidden');
        sectionToShow.classList.remove('hidden');
    };

    const backToUploadChoices = () => {
        ELEMENTS.uploadCsvSection.classList.add('hidden');
        ELEMENTS.repoCsvPicker.classList.add('hidden');
        ELEMENTS.googleSheetsSection.classList.add('hidden');
        ELEMENTS.csvUploadChoicesContainer.classList.remove('hidden');
        // Hide change-source button since choices are now visible
        const changeBtn = document.getElementById('csv-change-source-btn');
        if (changeBtn) changeBtn.classList.add('hidden');
        // Reset Google Sheets sub-flow
        const gsRouteChoice = document.getElementById('gs-route-choice');
        if (gsRouteChoice) gsRouteChoice.classList.add('hidden');
        document.getElementById('google-sheet-url').value = '';
        document.getElementById('google-sheet-error').classList.add('hidden');
        STATE.googleSheetUrl = null;
        _gsPendingRawContent = null;
        _gsPendingExportUrl = null;
    };

    const onCsvLoaded = () => {
        ELEMENTS.uploadCsvSection.classList.add('hidden');
        ELEMENTS.repoCsvPicker.classList.add('hidden');
        ELEMENTS.googleSheetsSection.classList.add('hidden');
        ELEMENTS.csvUploadChoicesContainer.classList.add('hidden');
        // Show "Change metadata source" button
        const changeBtn = document.getElementById('csv-change-source-btn');
        if (changeBtn) changeBtn.classList.remove('hidden');
    };

    if (ELEMENTS.choiceUploadCsv) {
        ELEMENTS.choiceUploadCsv.addEventListener('click', () => showUploadSection(ELEMENTS.uploadCsvSection));
    }
    if (ELEMENTS.choiceRepoCsv) {
        ELEMENTS.choiceRepoCsv.addEventListener('click', () => {
            showUploadSection(ELEMENTS.repoCsvPicker);
            if (STATE.targetRepo) loadRepoCsvPicker();
        });
    }
    if (ELEMENTS.choiceGoogleSheets) {
        ELEMENTS.choiceGoogleSheets.addEventListener('click', () => showUploadSection(ELEMENTS.googleSheetsSection));
    }

    [ELEMENTS.backToUploadChoicesBtn1, ELEMENTS.backToUploadChoicesBtn2, ELEMENTS.backToUploadChoicesBtn3].forEach(btn => {
        if (btn) btn.addEventListener('click', backToUploadChoices);
    });

    // ── "Change metadata source" — reveals option cards again ──
    const changeSourceBtn = document.getElementById('csv-change-source-btn');
    if (changeSourceBtn) {
        changeSourceBtn.addEventListener('click', () => {
            // Hide the current data controls/preview
            ELEMENTS.csvUploadControls.classList.add('hidden');

            // Show the option cards
            ELEMENTS.csvUploadChoicesContainer.classList.remove('hidden');

            // Hide sub-source forms
            ELEMENTS.uploadCsvSection.classList.add('hidden');
            ELEMENTS.repoCsvPicker.classList.add('hidden');
            ELEMENTS.googleSheetsSection.classList.add('hidden');

            // Hide change button itself (it reappears after a new source is loaded)
            changeSourceBtn.classList.add('hidden');
        });
    }

    // ── Google Sheets Fetch ──
    let _gsPendingRawContent = null;
    let _gsPendingExportUrl = null;

    const gsFetchBtn = document.getElementById('google-sheet-fetch-btn');
    const gsRouteChoice = document.getElementById('gs-route-choice');
    if (gsFetchBtn) {
        gsFetchBtn.addEventListener('click', async () => {
            const urlInput = document.getElementById('google-sheet-url').value.trim();
            const errorEl = document.getElementById('google-sheet-error');
            errorEl.classList.add('hidden');
            if (gsRouteChoice) gsRouteChoice.classList.add('hidden');

            if (!urlInput) {
                errorEl.textContent = 'Please enter a Google Sheet URL.';
                errorEl.classList.remove('hidden');
                return;
            }

            const publishedMatch = urlInput.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
            const regularMatch = !publishedMatch && urlInput.match(/\/d\/([a-zA-Z0-9-_]+)/);

            if (!publishedMatch && !regularMatch) {
                errorEl.textContent = 'Invalid Google Sheet URL. Make sure it contains /d/[Sheet-ID].';
                errorEl.classList.remove('hidden');
                return;
            }

            let csvExportUrl;
            if (publishedMatch) {
                const alreadyHasCsvParam = /[?&]output=csv/.test(urlInput);
                csvExportUrl = alreadyHasCsvParam
                    ? urlInput
                    : `https://docs.google.com/spreadsheets/d/e/${publishedMatch[1]}/pub?output=csv`;
            } else {
                csvExportUrl = `https://docs.google.com/spreadsheets/d/${regularMatch[1]}/export?format=csv`;
            }

            gsFetchBtn.disabled = true;
            gsFetchBtn.textContent = 'Fetching...';

            try {
                const response = await fetch(csvExportUrl);
                if (!response.ok) {
                    const hint = publishedMatch
                        ? 'The sheet returned an error. Make sure it is still published to the web.'
                        : 'Could not fetch the sheet. Please use a "Published to the web" URL: in Google Sheets go to File → Share → Publish to web, choose CSV, and copy that link.';
                    throw new Error(hint);
                }

                const rawContent = await response.text();
                if (rawContent.trim().startsWith('<!DOCTYPE html>')) {
                    throw new Error('Sheet is private or not published to the web.');
                }

                _gsPendingRawContent = rawContent;
                _gsPendingExportUrl = csvExportUrl;
                if (gsRouteChoice) gsRouteChoice.classList.remove('hidden');

            } catch (err) {
                errorEl.textContent = `Failed to fetch CSV: ${err.message} Ensure the sheet is "Published to the web" as CSV.`;
                errorEl.classList.remove('hidden');
                console.error(err);
            } finally {
                gsFetchBtn.disabled = false;
                gsFetchBtn.textContent = 'Fetch Metadata';
            }
        });
    }

    // ── Helper: reset controls before switching CSV source ──
    function resetCsvControls() {
        const statusCard = document.getElementById('csv-status-card');
        if (statusCard) statusCard.classList.remove('hidden');
        const filenameEl = document.getElementById('csv-status-filename');
        if (filenameEl) filenameEl.textContent = '';
        const badgeEl = document.getElementById('csv-status-badge');
        if (badgeEl) { badgeEl.className = 'csv-modal-badge'; badgeEl.textContent = ''; }

        const gsLinkStatus = document.getElementById('gs-link-status');
        if (gsLinkStatus) gsLinkStatus.classList.add('hidden');

        const filenameRow = document.getElementById('csv-filename-row');
        if (filenameRow) filenameRow.classList.remove('hidden');

        if (ELEMENTS.csvFilenameInput) ELEMENTS.csvFilenameInput.value = '';
        if (ELEMENTS.csvFilenameInput) {
            ELEMENTS.csvFilenameInput.classList.remove('valid-input', 'invalid-input');
        }

        if (ELEMENTS.step3Next) ELEMENTS.step3Next.disabled = true;

        hideCsvPreview();
    }

    // ── Google Sheets: Download as CSV ──
    const gsChoiceCsvBtn = document.getElementById('gs-choice-csv');
    if (gsChoiceCsvBtn) {
        gsChoiceCsvBtn.addEventListener('click', async () => {
            if (!_gsPendingRawContent) return;
            resetCsvControls();

            const csvText = _gsPendingRawContent;
            STATE.csvFile = { id: 'data.csv', name: 'google-sheets-data.csv', type: 'text/csv', content: csvText, path: '_data/google-sheets-data.csv' };
            STATE.googleSheetUrl = null;
            await saveFileToDB('data.csv', STATE.csvFile);

            document.getElementById('csv-status-card').classList.remove('hidden');
            const gsLinkStatus = document.getElementById('gs-link-status');
            if (gsLinkStatus) gsLinkStatus.classList.add('hidden');
            const filenameRow = document.getElementById('csv-filename-row');
            if (filenameRow) filenameRow.classList.remove('hidden');

            onCsvLoaded();
            ELEMENTS.csvUploadControls.classList.remove('hidden');

            updateCsvStatusCard('google-sheets-data.csv', csvText);
            showCsvPreview(csvText, 'google-sheets-data.csv');

            ELEMENTS.csvFilenameInput.value = 'google-sheets-data';
            setTimeout(() => ELEMENTS.csvFilenameInput.dispatchEvent(new Event('input')), 0);
        });
    }

    // ── Google Sheets: Use Sheet Link ──
    const gsChoiceLinkBtn = document.getElementById('gs-choice-link');
    if (gsChoiceLinkBtn) {
        gsChoiceLinkBtn.addEventListener('click', async () => {
            if (!_gsPendingExportUrl) return;
            resetCsvControls();

            STATE.csvFile = null;
            STATE.googleSheetUrl = _gsPendingExportUrl;

            document.getElementById('csv-status-card').classList.add('hidden');
            const gsLinkStatus = document.getElementById('gs-link-status');
            if (gsLinkStatus) gsLinkStatus.classList.remove('hidden');
            const filenameRow = document.getElementById('csv-filename-row');
            if (filenameRow) filenameRow.classList.add('hidden');

            if (ELEMENTS.step3Next) ELEMENTS.step3Next.disabled = false;

            onCsvLoaded();
            ELEMENTS.csvUploadControls.classList.remove('hidden');
        });
    }

    // ── CSV file selected → show inline preview ──
    ELEMENTS.csvInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isCSV = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
        if (!isCSV) {
            alert('Please select a CSV file (.csv).');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const rawContent = evt.target.result;

            STATE.csvFile = { id: 'data.csv', name: file.name, type: file.type, content: rawContent, path: '_data/data.csv' };
            await saveFileToDB('data.csv', STATE.csvFile);

            updateCsvStatusCard(file.name, rawContent);
            showCsvPreview(rawContent, file.name);

            onCsvLoaded();
            ELEMENTS.csvUploadControls.classList.remove('hidden');

            const safeName = file.name.replace(/\.csv$/i, '');
            ELEMENTS.csvFilenameInput.value = safeName;
            setTimeout(() => ELEMENTS.csvFilenameInput.dispatchEvent(new Event('input')), 0);
        };
        reader.readAsText(file);
    });

    // ── "Open CSV Editor" button ──
    const reviewBtn = document.getElementById('csv-review-btn');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
            if (!STATE.csvFile || !STATE.csvFile.content) return;
            openCsvModal(STATE.csvFile.content, async (correctedCsvText) => {
                STATE.csvFile.content = correctedCsvText;
                STATE.csvUploadedToRepo = false; // Content changed — needs re-upload
                await saveFileToDB('data.csv', STATE.csvFile);
                updateCsvStatusCard(STATE.csvFile.name, correctedCsvText);
                showCsvPreview(correctedCsvText, STATE.csvFile.name);
            });
        });
    }

    // ── Repo _data/ CSV Picker ──
    const repoSelect = document.getElementById('repo-csv-select');
    const repoUseBtn = document.getElementById('repo-csv-use-btn');

    if (repoSelect) {
        repoSelect.addEventListener('change', () => {
            const val = repoSelect.value;
            if (repoUseBtn) repoUseBtn.disabled = !val;
            updateConfigMatchIndicator(val);
        });
    }

    if (repoUseBtn) {
        repoUseBtn.addEventListener('click', async () => {
            const selectedPath = repoSelect?.value;
            if (!selectedPath || !STATE.targetRepo) return;

            repoUseBtn.disabled = true;
            repoUseBtn.textContent = 'Loading…';

            try {
                const data = await githubRequest(`/repos/${STATE.targetRepo}/contents/${selectedPath}`);
                const csvText = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
                const fileName = selectedPath.split('/').pop();

                STATE.csvFile = { id: 'data.csv', name: fileName, type: 'text/csv', content: csvText, path: '_data/' + fileName };
                await saveFileToDB('data.csv', STATE.csvFile);
                updateCsvStatusCard(fileName, csvText);
                showCsvPreview(csvText, fileName);

                onCsvLoaded();
                ELEMENTS.csvUploadControls.classList.remove('hidden');

                const safeName = fileName.replace(/\.csv$/i, '');
                ELEMENTS.csvFilenameInput.value = safeName;
                setTimeout(() => ELEMENTS.csvFilenameInput.dispatchEvent(new Event('input')), 0);
            } catch (err) {
                console.error('Failed to fetch repo CSV:', err);
                alert(`Could not load file: ${err.message}`);
            } finally {
                repoUseBtn.disabled = false;
                repoUseBtn.textContent = 'Use This File';
            }
        });
    }

    // ── Real-time filename validation ──
    ELEMENTS.csvFilenameInput.addEventListener('input', (e) => {
        const filenameRow = document.getElementById('csv-filename-row');
        if (filenameRow && filenameRow.classList.contains('hidden')) return; // link mode — ignore

        const val = e.target.value;
        const isValid = validateCsvFilename(val);

        if (isValid) {
            ELEMENTS.csvFilenameInput.classList.add('valid-input');
            ELEMENTS.csvFilenameInput.classList.remove('invalid-input');
            if (ELEMENTS.step3Next) ELEMENTS.step3Next.disabled = false;
        } else {
            ELEMENTS.csvFilenameInput.classList.add('invalid-input');
            ELEMENTS.csvFilenameInput.classList.remove('valid-input');
            if (ELEMENTS.step3Next) ELEMENTS.step3Next.disabled = true;
        }
    });

    // ── Download CSV ──
    const downloadBtn = document.getElementById('csv-download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!STATE.csvFile || !STATE.csvFile.content) return;
            const blob = new Blob([STATE.csvFile.content], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = STATE.csvFile.name || 'metadata.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // ── Step 3 → Step 4 Next (uploads CSV to GitHub before proceeding) ──
    ELEMENTS.step3Next.addEventListener('click', async () => {
        const baseName = ELEMENTS.csvFilenameInput.value.trim();
        if (baseName && STATE.csvFile) {
            STATE.csvFile.name = `${baseName}.csv`;
            STATE.csvFile.path = `_data/${baseName}.csv`;
            await saveFileToDB('data.csv', STATE.csvFile);
        }

        // Upload CSV to GitHub now if we have a file and a target repo
        const uploadStatusEl = document.getElementById('csv-upload-status');
        if (STATE.csvFile && STATE.targetRepo && !STATE.csvUploadedToRepo) {
            const btn = ELEMENTS.step3Next;
            const origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Uploading CSV…';
            if (uploadStatusEl) {
                uploadStatusEl.className = 'info-message';
                uploadStatusEl.textContent = 'Uploading CSV to your repository…';
                uploadStatusEl.classList.remove('hidden');
            }
            try {
                await uploadCsvToRepo(STATE.csvFile.content, STATE.csvFile.name);
                STATE.csvUploadedToRepo = true;
            } catch (err) {
                console.warn('CSV upload to repo failed (will retry at publish):', err);
                if (uploadStatusEl) {
                    uploadStatusEl.className = 'warning-message';
                    uploadStatusEl.textContent = `CSV upload failed (${err.message}) — it will be uploaded when you publish.`;
                    uploadStatusEl.classList.remove('hidden');
                }
                // Give the user a moment to read the warning before navigating
                await new Promise(resolve => setTimeout(resolve, 2000));
            } finally {
                btn.disabled = false;
                btn.textContent = origText;
            }
        } else if (uploadStatusEl) {
            uploadStatusEl.classList.add('hidden');
        }

        STATE.currentStep = 4;
        STATE.maxStep = Math.max(STATE.maxStep, 4);
        updateUI();
    });
}

// ─────── CSV upload to GitHub ───────

/** Commits a CSV file to the repository's _data/ directory. */
async function uploadCsvToRepo(csvContent, fileName) {
    const path = `_data/${fileName}`;
    const base64Content = btoa(unescape(encodeURIComponent(csvContent)));

    let sha = null;
    try {
        const existing = await githubRequest(`/repos/${STATE.targetRepo}/contents/${path}`);
        sha = existing.sha;
    } catch (e) {
        if (e.status !== 404) throw e;
    }

    await githubRequest(`/repos/${STATE.targetRepo}/contents/${path}`, 'PUT', {
        message: `Add metadata CSV: ${fileName} via CollectionBuilder Wizard`,
        content: base64Content,
        ...(sha ? { sha } : {})
    });
}
