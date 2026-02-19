import { STATE } from '../constants.js';
import { elements } from '../elements.js';
import { saveFileToDB, deleteFileFromDB } from '../storage.js';
import { githubRequest, enableGitHubPages } from '../api.js';
import { updateUI, showError, clearError, renderImagePreview, renderValidationBanner } from '../ui.js';
import { parseCSV, renderCSVTable } from '../utils/csv.js';
import { validateCsvFilename } from '../validation.js';
import { enableDropZone } from '../utils/dragdrop.js';

// --- File / CSV / Image Logic ---

// ── CSV upload to GitHub ──────────────────────────────────────────────────────

async function uploadCSVToGitHub(csvContent, fileName) {
    const path = `_data/${fileName}`;
    const base64Content = btoa(unescape(encodeURIComponent(csvContent)));

    // Check if file already exists (need its SHA to update)
    let sha = null;
    try {
        const existing = await githubRequest(`/repos/${STATE.targetRepo}/contents/${path}`);
        sha = existing.sha;
    } catch (e) {
        if (e.status !== 404) throw e; // 404 just means file doesn't exist yet
    }

    const body = {
        message: `Add metadata CSV: ${fileName} with CBWizard`,
        content: base64Content,
        ...(sha ? { sha } : {})
    };

    await githubRequest(`/repos/${STATE.targetRepo}/contents/${path}`, 'PUT', body);
    return path;
}

// ── Image upload to GitHub ────────────────────────────────────────────────────

async function uploadMediaToGitHub(file) {
    const { content, path, name } = file;

    // Check if file already exists
    let sha = null;
    try {
        const existing = await githubRequest(`/repos/${STATE.targetRepo}/contents/${path}`);
        sha = existing.sha;
    } catch (e) {
        if (e.status !== 404) throw e;
    }

    const body = {
        message: `Add media: ${name} with CBWizard`,
        content: content,
        ...(sha ? { sha } : {})
    };

    await githubRequest(`/repos/${STATE.targetRepo}/contents/${path}`, 'PUT', body);
    return path;
}

// ── Event listeners ───────────────────────────────────────────────────────────

export const handleMediaDelete = async (id) => {
    STATE.mediaFiles = STATE.mediaFiles.filter(f => f.id !== id);
    await deleteFileFromDB(id);
    renderImagePreview(STATE.mediaFiles, handleMediaDelete);
};

export function registerFileListeners() {

    // Enable drag-and-drop on file inputs
    enableDropZone(elements.csvInput, { label: 'Drop your CSV metadata file here' });
    enableDropZone(elements.imageInput, { label: 'Drop media files here (images, audio, PDFs)' });

    // CSV file selected → show table preview + filename controls
    elements.csvInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate that the selected file is a CSV
        const isCSV = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
        if (!isCSV) {
            alert('Please select a CSV file (.csv).');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const content = evt.target.result;
            STATE.csvFile = { id: 'data.csv', name: file.name, type: file.type, content, path: '_data/data.csv' };
            await saveFileToDB('data.csv', STATE.csvFile);

            // Render table preview
            const { hasErrors, validationReport, header } = renderCSVTable(content, elements.csvTable);

            // Render validation banner
            renderValidationBanner(validationReport, header);

            elements.csvPreview.classList.remove('hidden');

            // Pre-fill filename with the uploaded file's name (minus extension), show controls
            const safeName = file.name.replace(/\.csv$/i, '');
            elements.csvFilenameInput.value = safeName;
            elements.csvUploadControls.classList.remove('hidden');

            // Trigger validation immediately to set initial state
            setTimeout(() => {
                elements.csvFilenameInput.dispatchEvent(new Event('input'));
            }, 0);
        };
        reader.readAsText(file);
    });

    // Real-time filename validation
    elements.csvFilenameInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const isValid = validateCsvFilename(val);

        if (isValid) {
            elements.csvFilenameInput.classList.add('valid-input');
            elements.csvFilenameInput.classList.remove('invalid-input');
            if (elements.step3Next) elements.step3Next.disabled = false;
        } else {
            elements.csvFilenameInput.classList.add('invalid-input');
            elements.csvFilenameInput.classList.remove('valid-input');
            if (elements.step3Next) elements.step3Next.disabled = true;
        }
    });

    // Next → Step 4
    elements.step3Next.addEventListener('click', () => {
        // Save the final filename to state before moving on
        const baseName = elements.csvFilenameInput.value.trim();
        if (baseName && STATE.csvFile) {
            STATE.csvFile.name = `${baseName}.csv`;
            STATE.csvFile.path = `_data/${baseName}.csv`;
            saveFileToDB('data.csv', STATE.csvFile);
        }

        STATE.currentStep = 4;
        STATE.maxStep = Math.max(STATE.maxStep, 4);
        updateUI();
    });

    // Media file selection
    elements.imageInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — GitHub's limit for the Contents API
        const skipped = [];

        if (!STATE.mediaFiles) {
            STATE.mediaFiles = [];
        }

        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                skipped.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
                continue;
            }

            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    const base64 = evt.target.result.split(',')[1];
                    const id = `media_${file.name}`;
                    const imgData = { id, name: file.name, type: file.type, content: base64, path: `objects/${file.name}` };

                    const existingIdx = STATE.mediaFiles.findIndex(f => f.id === id);
                    if (existingIdx !== -1) {
                        STATE.mediaFiles[existingIdx] = imgData;
                    } else {
                        STATE.mediaFiles.push(imgData);
                    }

                    await saveFileToDB(id, imgData);
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }

        renderImagePreview(STATE.mediaFiles, handleMediaDelete);

        // Warn about skipped files
        if (skipped.length > 0) {
            showError(`${skipped.length} file(s) exceeded the 10 MB limit and were skipped: ${skipped.join(', ')}`);
        }

        // Clear value so the same file can be selected again if needed
        elements.imageInput.value = '';
    });

    elements.step4Next.addEventListener('click', () => {
        STATE.currentStep = 5;
        STATE.maxStep = Math.max(STATE.maxStep, 5);
        prepareConfigStep();
        updateUI();
    });

    elements.step4Skip.addEventListener('click', () => {
        STATE.currentStep = 5;
        STATE.maxStep = Math.max(STATE.maxStep, 5);
        prepareConfigStep();
        updateUI();
    });

    // Publish button → Upload CSV + Media + Config + Enable GitHub Pages
    if (elements.publishBtn) {
        elements.publishBtn.addEventListener('click', async () => {
            clearError();

            if (!STATE.csvFile) {
                showError('No CSV file selected. Please go back to Step 3 and select a CSV file.');
                return;
            }
            if (!STATE.targetRepo) {
                showError('No forked repository found. Please complete Step 2 first.');
                return;
            }

            elements.publishBtn.disabled = true;
            const originalText = elements.publishBtn.textContent;
            elements.publishBtn.textContent = 'Publishing...';

            // Show progress bar
            const progressContainer = elements.publishProgress;
            const progressLabel = elements.publishProgressLabel;
            const progressFill = elements.publishProgressFill;
            if (progressContainer) progressContainer.classList.remove('hidden');

            // Calculate total steps: CSV(1) + media files + config(1) + pages(1)
            const mediaCount = (STATE.mediaFiles && STATE.mediaFiles.length) || 0;
            const totalSteps = 1 + mediaCount + 1 + 1;
            let completedSteps = 0;

            function updateProgress(label) {
                completedSteps++;
                const pct = Math.round((completedSteps / totalSteps) * 100);
                if (progressFill) progressFill.style.width = pct + '%';
                if (progressLabel) progressLabel.textContent = label;
                if (progressContainer) {
                    progressContainer.setAttribute('aria-valuenow', pct);
                }
            }

            try {
                const [owner, repoName] = STATE.targetRepo.split('/');

                // 1. Upload CSV
                const csvFileName = STATE.csvFile.name || 'data.csv';
                elements.publishBtn.textContent = 'Uploading CSV metadata...';
                await uploadCSVToGitHub(STATE.csvFile.content, csvFileName);
                updateProgress('CSV metadata uploaded');

                // 2. Upload media files (if any)
                if (mediaCount > 0) {
                    let count = 0;
                    for (const file of STATE.mediaFiles) {
                        count++;
                        const label = `Uploading media ${count}/${mediaCount}: ${file.name}`;
                        elements.publishBtn.textContent = label;
                        await uploadMediaToGitHub(file);
                        updateProgress(label);
                    }
                }

                // 3. Update _config.yml
                elements.publishBtn.textContent = 'Updating site configuration...';
                try {
                    await updateConfigYml(owner, repoName);
                } catch (configErr) {
                    console.warn('Could not update _config.yml:', configErr.message);
                }
                updateProgress('Configuration updated');

                // 3b. Update _data/theme.yml with featured image (if selected)
                const featuredId = elements.configFeaturedImage ? elements.configFeaturedImage.value : '';
                if (featuredId) {
                    elements.publishBtn.textContent = 'Setting featured image...';
                    try {
                        await updateThemeYml(owner, repoName, featuredId);
                    } catch (themeErr) {
                        console.warn('Could not update theme.yml:', themeErr.message);
                    }
                }

                // 4. Enable GitHub Pages
                elements.publishBtn.textContent = 'Enabling GitHub Pages...';
                const pagesResult = await enableGitHubPages(owner, repoName);
                if (pagesResult && pagesResult.error) {
                    console.warn('GitHub Pages auto-enable failed:', pagesResult.error);
                }
                updateProgress('GitHub Pages enabled');

                // 5. Success!
                STATE.currentStep = 6;
                STATE.maxStep = Math.max(STATE.maxStep, 6);
                localStorage.setItem('gh_wizard_published', 'true');
                if (progressContainer) progressContainer.classList.add('hidden');
                showPublishSuccess();
                updateUI();
            } catch (error) {
                showError(`Publish failed: ${error.message}`);
                elements.publishBtn.textContent = originalText;
                elements.publishBtn.disabled = false;
                if (progressContainer) progressContainer.classList.add('hidden');
            }
        });
    }
}

function prepareConfigStep() {
    // Auto-populate config metadata filename from CSV
    if (STATE.csvFile && STATE.csvFile.name && elements.configMetadata) {
        elements.configMetadata.value = STATE.csvFile.name;
    }

    // Auto-populate title from repo name if empty
    if (elements.configTitle && !elements.configTitle.value && STATE.targetRepo) {
        const repoName = STATE.targetRepo.split('/')[1] || '';
        elements.configTitle.value = repoName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // Populate featured image dropdown from CSV objectids
    populateFeaturedImageSelect();

    // Listen for featured image selection changes to show preview
    if (elements.configFeaturedImage) {
        elements.configFeaturedImage.onchange = () => {
            updateFeaturedImagePreview();
        };
    }

    // Populate publish summary
    if (elements.publishSummaryList) {
        elements.publishSummaryList.innerHTML = '';
        const items = [];

        if (STATE.csvFile) {
            items.push(`📄 CSV metadata: ${STATE.csvFile.name || 'data.csv'} → _data/`);
        }

        const mediaCount = (STATE.mediaFiles && STATE.mediaFiles.length) || 0;
        if (mediaCount > 0) {
            items.push(`🖼️ ${mediaCount} media file${mediaCount > 1 ? 's' : ''} → objects/`);
        }

        items.push('⚙️ Site configuration (_config.yml)');
        items.push('🌐 Enable GitHub Pages');

        items.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            elements.publishSummaryList.appendChild(li);
        });
    }
}

// Track active polling interval so it can be cleared on reset
let _liveCheckInterval = null;

export function showPublishSuccess() {
    const repoUrl = `https://github.com/${STATE.targetRepo}`;
    const owner = STATE.targetRepo.split('/')[0];
    const repoName = STATE.targetRepo.split('/')[1];
    const pageUrl = `https://${owner}.github.io/${repoName}/`;

    const container = elements.publishLinks;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'success-links';

    const repoLink = document.createElement('a');
    repoLink.href = repoUrl;
    repoLink.target = '_blank';
    repoLink.className = 'primary-link';
    repoLink.textContent = 'View Repository \u2197';
    wrapper.appendChild(repoLink);

    const note = document.createElement('p');
    note.className = 'small-note';
    note.textContent = 'Your site is building! It may take a few minutes to be live at:';
    const br = document.createElement('br');
    note.appendChild(br);
    const pageLink = document.createElement('a');
    pageLink.href = pageUrl;
    pageLink.target = '_blank';
    pageLink.textContent = pageUrl;
    note.appendChild(pageLink);
    wrapper.appendChild(note);

    // Live-check status indicator
    const liveCheck = document.createElement('div');
    liveCheck.className = 'live-check';
    liveCheck.innerHTML = `
        <div class="live-check-spinner"></div>
        <span class="live-check-text">Checking every few seconds to see if your site is live…</span>
    `;
    wrapper.appendChild(liveCheck);

    container.appendChild(wrapper);

    // Start polling for the live site
    startLiveCheck(pageUrl, liveCheck);

    // Wire up Start Over button
    elements.resetBtn.onclick = () => {
        if (confirm('Are you sure you want to start over? This will clear current progress.')) {
            // Stop any active polling
            if (_liveCheckInterval) {
                clearInterval(_liveCheckInterval);
                _liveCheckInterval = null;
            }
            // Clear everything except token
            const token = STATE.token;
            localStorage.clear();
            if (token) localStorage.setItem('gh_wizard_token', token);
            window.location.reload();
        }
    };
}

/**
 * Poll the GitHub Pages deployment status via the API every few seconds.
 * Uses the authenticated GitHub API to check the latest Pages build,
 * which avoids CORS issues and gives accurate build status.
 */
function startLiveCheck(pageUrl, indicatorEl) {
    // Clear any previous interval
    if (_liveCheckInterval) {
        clearInterval(_liveCheckInterval);
        _liveCheckInterval = null;
    }

    const INTERVAL_MS = 5000; // check every 5 seconds
    const MAX_ATTEMPTS = 120; // stop after ~10 minutes
    let attempts = 0;

    const [owner, repoName] = STATE.targetRepo.split('/');

    async function check() {
        attempts++;
        try {
            // Use the GitHub Pages API to check the latest deployment status
            const pagesData = await githubRequest(`/repos/${owner}/${repoName}/pages`);
            // pagesData.status can be: "built", "building", "errored", or null
            if (pagesData && pagesData.status === 'built') {
                onLive();
                return;
            }
        } catch (_) {
            // API error — keep trying
        }

        if (attempts >= MAX_ATTEMPTS) {
            onTimeout();
        }
    }

    function onLive() {
        clearInterval(_liveCheckInterval);
        _liveCheckInterval = null;
        indicatorEl.classList.add('live-check--success');
        indicatorEl.innerHTML = `
            <span class="live-check-icon">&#10003;</span>
            <span class="live-check-text">Your site is live! <a href="${pageUrl}" target="_blank">${pageUrl}</a></span>
        `;
    }

    function onTimeout() {
        clearInterval(_liveCheckInterval);
        _liveCheckInterval = null;
        indicatorEl.classList.add('live-check--timeout');
        indicatorEl.innerHTML = `
            <span class="live-check-text">We couldn't confirm the site is live yet. Try visiting <a href="${pageUrl}" target="_blank">${pageUrl}</a> manually.</span>
        `;
    }

    // Run the first check immediately, then every INTERVAL_MS
    check();
    _liveCheckInterval = setInterval(check, INTERVAL_MS);
}

/**
 * Populate the featured image <select> with objectids from the user's CSV.
 */
function populateFeaturedImageSelect() {
    const select = elements.configFeaturedImage;
    if (!select) return;

    // Clear existing options (keep the first "None" option)
    while (select.options.length > 1) {
        select.remove(1);
    }

    if (!STATE.csvFile || !STATE.csvFile.content) return;

    const rows = parseCSV(STATE.csvFile.content);
    if (rows.length < 2) return;

    const header = rows[0].map(h => h.trim().toLowerCase());
    const objectidIdx = header.indexOf('objectid');
    const titleIdx = header.indexOf('title');
    const formatIdx = header.indexOf('format');

    if (objectidIdx === -1) return; // No objectid column

    rows.slice(1).forEach(row => {
        const objectid = (row[objectidIdx] || '').trim();
        if (!objectid) return;

        const title = titleIdx !== -1 ? (row[titleIdx] || '').trim() : '';
        const format = formatIdx !== -1 ? (row[formatIdx] || '').trim() : '';

        // Only show image-type items (or all if no format column)
        const isImage = !format || /image/i.test(format);
        if (!isImage) return;

        const option = document.createElement('option');
        option.value = objectid;
        option.textContent = title ? `${objectid} — ${title}` : objectid;
        select.appendChild(option);
    });

    updateFeaturedImagePreview();
}

/**
 * Show a thumbnail preview of the selected featured image (if the file is in media uploads).
 */
function updateFeaturedImagePreview() {
    const preview = elements.featuredImagePreview;
    const select = elements.configFeaturedImage;
    if (!preview || !select) return;

    const objectid = select.value;
    if (!objectid) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        return;
    }

    // Try to find a matching media file by objectid (filename without extension)
    const match = STATE.mediaFiles.find(f => {
        const nameNoExt = f.name.replace(/\.[^.]+$/, '');
        return nameNoExt === objectid;
    });

    preview.innerHTML = '';
    if (match && match.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = `data:${match.type};base64,${match.content}`;
        img.alt = `Preview of ${objectid}`;
        preview.appendChild(img);
        preview.classList.remove('hidden');
    } else {
        const note = document.createElement('span');
        note.className = 'featured-image-note';
        note.textContent = match
            ? `Selected: ${objectid} (non-image file, no preview available)`
            : `Selected: ${objectid}`;
        preview.appendChild(note);
        preview.classList.remove('hidden');
    }
}

/**
 * Fetch _data/theme.yml from the repo, update the featured-image field, and push it back.
 */
async function updateThemeYml(owner, repoName, featuredImageId) {
    const path = '_data/theme.yml';
    const fileData = await githubRequest(`/repos/${owner}/${repoName}/contents/${path}`);
    const currentContent = atob(fileData.content.replace(/\n/g, ''));
    const sha = fileData.sha;

    let lines = currentContent.split('\n');
    lines = replaceYamlField(lines, 'featured-image', featuredImageId);

    const updatedContent = lines.join('\n');
    const base64 = btoa(unescape(encodeURIComponent(updatedContent)));

    await githubRequest(`/repos/${owner}/${repoName}/contents/${path}`, 'PUT', {
        message: 'Set featured image via CollectionBuilder Wizard',
        content: base64,
        sha
    });
}

/**
 * Fetch the existing _config.yml from the repo, update key fields, and push it back.
 */
async function updateConfigYml(owner, repoName) {
    // Fetch current _config.yml
    const configData = await githubRequest(`/repos/${owner}/${repoName}/contents/_config.yml`);
    const currentContent = atob(configData.content.replace(/\n/g, ''));
    const sha = configData.sha;

    // Read user-entered values
    const siteTitle = (elements.configTitle && elements.configTitle.value.trim()) || repoName;
    const tagline = (elements.configTagline && elements.configTagline.value.trim()) || '';
    const description = (elements.configDescription && elements.configDescription.value.trim()) || '';
    const csvFilename = STATE.csvFile ? STATE.csvFile.name : '';

    // Simple line-by-line YAML replacement
    let lines = currentContent.split('\n');
    lines = replaceYamlField(lines, 'title', siteTitle);
    if (tagline) lines = replaceYamlField(lines, 'tagline', tagline);
    if (description) lines = replaceYamlField(lines, 'description', description);
    if (csvFilename) lines = replaceYamlField(lines, 'metadata', csvFilename.replace(/\.csv$/i, ''));

    const updatedContent = lines.join('\n');
    const base64 = btoa(unescape(encodeURIComponent(updatedContent)));

    await githubRequest(`/repos/${owner}/${repoName}/contents/_config.yml`, 'PUT', {
        message: 'Update _config.yml via CollectionBuilder Wizard',
        content: base64,
        sha
    });
}

/**
 * Replace or append a top-level YAML field value.
 * Handles simple `key: value` patterns (not nested YAML).
 */
function replaceYamlField(lines, key, value) {
    const regex = new RegExp(`^(${key}:\\s*)(.*)$`);
    let found = false;
    const result = lines.map(line => {
        const match = line.match(regex);
        if (match) {
            found = true;
            // Quote the value if it contains special YAML characters
            const safeValue = /[:#\[\]{}&*!|>'"@`]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
            return `${match[1]}${safeValue}`;
        }
        return line;
    });
    // If the key wasn't found, append it
    if (!found) {
        const safeValue = /[:#\[\]{}&*!|>'"@`]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
        result.push(`${key}: ${safeValue}`);
    }
    return result;
}
