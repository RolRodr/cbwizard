import { STATE } from '../constants.js';
import { ELEMENTS } from '../elements.js';
import { githubRequest, enableGitHubPages, createJekyllWorkflow } from '../api.js';
import { showError, clearError } from '../ui.js';
import { showWizardLoading, hideWizardLoading } from '../loading.js';
import { uploadMediaToGitHub } from './useMedia.js';

// ─────── GitHub config helpers ───────

/** Replaces or appends a top-level YAML key-value pair in an array of lines. */
function replaceYamlField(lines, key, value) {
    const regex = new RegExp(`^(${key}:\\s*)(.*)$`);
    let found = false;
    const result = lines.map(line => {
        const match = line.match(regex);
        if (match) {
            found = true;
            // Quote the value if it contains special YAML characters
            const safeValue = /[:#\[\]{}&*!|>'\"@`]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
            return `${match[1]}${safeValue}`;
        }
        return line;
    });
    // If the key wasn't found, append it
    if (!found) {
        const safeValue = /[:#\[\]{}&*!|>'\"@`]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
        result.push(`${key}: ${safeValue}`);
    }
    return result;
}

/** Fetches _config.yml from the repo, updates key fields, and pushes it. */
async function updateConfigYml(owner, repoName) {
    const configData = await githubRequest(`/repos/${owner}/${repoName}/contents/_config.yml`);
    const currentContent = atob(configData.content.replace(/\n/g, ''));
    const sha = configData.sha;

    const siteTitle = (ELEMENTS.configTitle && ELEMENTS.configTitle.value.trim()) || repoName;
    const tagline = (ELEMENTS.configTagline && ELEMENTS.configTagline.value.trim()) || '';
    const description = (ELEMENTS.configDescription && ELEMENTS.configDescription.value.trim()) || '';
    const author = (ELEMENTS.configAuthor && ELEMENTS.configAuthor.value.trim()) || '';

    const metadataValue = STATE.csvFile
        ? STATE.csvFile.name.replace(/\.csv$/i, '')
        : (STATE.googleSheetUrl || '');

    let lines = currentContent.split('\n');
    lines = replaceYamlField(lines, 'title', siteTitle);
    if (tagline) lines = replaceYamlField(lines, 'tagline', tagline);
    if (description) lines = replaceYamlField(lines, 'description', description);
    if (author) lines = replaceYamlField(lines, 'author', author);
    if (metadataValue) lines = replaceYamlField(lines, 'metadata', metadataValue);

    const updatedContent = lines.join('\n');
    const base64 = btoa(unescape(encodeURIComponent(updatedContent)));

    await githubRequest(`/repos/${owner}/${repoName}/contents/_config.yml`, 'PUT', {
        message: 'Update _config.yml via CollectionBuilder Wizard',
        content: base64,
        sha
    });
}

/** Fetches theme.yml from the repo, updates the featured-image field, and pushes it. */
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

// ─────── CSV upload to GitHub ───────

/** Uploads a CSV file to the repository's _data/ directory. */
async function uploadCSVToGitHub(csvContent, fileName) {
    const path = `_data/${fileName}`;
    const base64Content = btoa(unescape(encodeURIComponent(csvContent)));

    let sha = null;
    try {
        const existing = await githubRequest(`/repos/${STATE.targetRepo}/contents/${path}`);
        sha = existing.sha;
    } catch (e) {
        if (e.status !== 404) throw e;
    }

    const body = {
        message: `Add metadata CSV: ${fileName} with CBWizard`,
        content: base64Content,
        ...(sha ? { sha } : {})
    };

    await githubRequest(`/repos/${STATE.targetRepo}/contents/${path}`, 'PUT', body);
    return path;
}

// ─────── Live-site polling ───────

let _liveCheckInterval = null;

/** Polls the GitHub Pages API to detect when the deployed site is live. */
function startLiveCheck(pageUrl, indicatorEl) {
    if (_liveCheckInterval) {
        clearInterval(_liveCheckInterval);
        _liveCheckInterval = null;
    }

    const INTERVAL_MS = 5000;
    const MAX_ATTEMPTS = 120;
    let attempts = 0;

    const [owner, repoName] = STATE.targetRepo.split('/');

    async function check() {
        attempts++;
        try {
            const pagesData = await githubRequest(`/repos/${owner}/${repoName}/pages`);
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

        const iframe = document.getElementById('live-preview-frame');
        if (iframe) iframe.src = pageUrl;
    }

    function onTimeout() {
        clearInterval(_liveCheckInterval);
        _liveCheckInterval = null;
        indicatorEl.classList.add('live-check--timeout');
        indicatorEl.innerHTML = `
            <span class="live-check-text">We couldn't confirm the site is live yet. Try visiting <a href="${pageUrl}" target="_blank">${pageUrl}</a> manually.</span>
        `;
    }

    check();
    _liveCheckInterval = setInterval(check, INTERVAL_MS);
}

// ─────── Success view ───────

/** Renders the publish success view with links and starts live-site polling. */
export function showPublishSuccess() {
    const repoUrl = `https://github.com/${STATE.targetRepo}`;
    const owner = STATE.targetRepo.split('/')[0];
    const repoName = STATE.targetRepo.split('/')[1];
    const pageUrl = `https://${owner}.github.io/${repoName}/`;

    const container = ELEMENTS.publishLinks;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'success-links';

    const repoLink = document.createElement('a');
    repoLink.href = repoUrl;
    repoLink.target = '_blank';
    repoLink.className = 'primary-link';
    repoLink.textContent = 'View Repository';
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

    const liveCheck = document.createElement('div');
    liveCheck.className = 'live-check';
    liveCheck.innerHTML = `
        <div class="live-check-spinner"></div>
        <span class="live-check-text">Checking every few seconds to see if your site is live…</span>
    `;
    wrapper.appendChild(liveCheck);

    const previewSection = document.createElement('div');
    previewSection.className = 'live-preview-container';
    previewSection.id = 'live-site-preview';
    previewSection.innerHTML = `
        <div class="live-preview-header">
            <h3>Live Preview</h3>
            <div class="live-preview-actions">
                <button type="button" class="live-preview-refresh" title="Reload preview">&#8635; Refresh</button>
                <a href="${pageUrl}" target="_blank" class="live-preview-open" title="Open in new tab">Open in new tab &#8599;</a>
            </div>
        </div>
        <div class="live-preview-frame-wrapper">
            <iframe src="${pageUrl}" class="live-preview-iframe" id="live-preview-frame" title="Live site preview" sandbox="allow-scripts allow-same-origin allow-popups" loading="lazy"></iframe>
        </div>
    `;
    wrapper.appendChild(previewSection);

    const refreshBtn = previewSection.querySelector('.live-preview-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const iframe = document.getElementById('live-preview-frame');
            if (iframe) iframe.src = pageUrl;
        });
    }

    container.appendChild(wrapper);

    startLiveCheck(pageUrl, liveCheck);

    ELEMENTS.resetAppBtn.onclick = () => {
        if (confirm('Are you sure you want to start over? This will clear current progress.')) {
            if (_liveCheckInterval) {
                clearInterval(_liveCheckInterval);
                _liveCheckInterval = null;
            }
            const token = STATE.token;
            localStorage.clear();
            if (token) localStorage.setItem('gh_wizard_token', token);
            window.location.reload();
        }
    };
}

// ─────── Publish button listener ───────

/** Registers the publish button click handler. */
export function registerPublishListeners() {
    if (!ELEMENTS.publishBtn) return;

    ELEMENTS.publishBtn.addEventListener('click', async () => {
        clearError();

        if (!STATE.csvFile && !STATE.googleSheetUrl) {
            showError('No CSV file or Google Sheet URL provided. Please go back to Step 3 and select a CSV.');
            return;
        }
        if (!STATE.targetRepo) {
            showError('No forked repository found. Please complete Step 2 first.');
            return;
        }

        ELEMENTS.publishBtn.disabled = true;
        const originalText = ELEMENTS.publishBtn.textContent;
        ELEMENTS.publishBtn.textContent = 'Publishing...';

        const progressContainer = ELEMENTS.publishProgress;
        const progressLabel = ELEMENTS.publishProgressLabel;
        const progressFill = ELEMENTS.publishProgressFill;
        if (progressContainer) progressContainer.classList.remove('hidden');

        const mediaCount = (STATE.mediaFiles && STATE.mediaFiles.length) || 0;
        const totalSteps = 1 + mediaCount + 1 + 1;
        let completedSteps = 0;

        function updateProgress(label) {
            completedSteps++;
            const pct = Math.round((completedSteps / totalSteps) * 100);
            if (progressFill) progressFill.style.width = pct + '%';
            if (progressLabel) progressLabel.textContent = label;
            if (progressContainer) progressContainer.setAttribute('aria-valuenow', pct);
        }

        try {
            const [owner, repoName] = STATE.targetRepo.split('/');
            const { updateUI } = await import('../ui.js');

            // 1. Upload CSV (skipped if already uploaded in Step 3, or when using Google Sheet link)
            if (STATE.csvFile && !STATE.csvUploadedToRepo) {
                const csvFileName = STATE.csvFile.name || 'data.csv';
                ELEMENTS.publishBtn.textContent = 'Uploading CSV metadata...';
                showWizardLoading('The wizard is uploading your CSV metadata to the cloud...');
                await uploadCSVToGitHub(STATE.csvFile.content, csvFileName);
                updateProgress('CSV metadata uploaded');
            } else if (STATE.csvFile && STATE.csvUploadedToRepo) {
                updateProgress('CSV metadata already uploaded');
            } else if (STATE.googleSheetUrl) {
                updateProgress('Google Sheet link will be set in _config.yml');
            }

            // 2. Upload media files (if any)
            if (mediaCount > 0) {
                let count = 0;
                for (const file of STATE.mediaFiles) {
                    count++;
                    const label = `Uploading media ${count}/${mediaCount}: ${file.name}`;
                    showWizardLoading(`The wizard is conjuring media ${count}/${mediaCount}: ${file.name}`);
                    ELEMENTS.publishBtn.textContent = label;
                    await uploadMediaToGitHub(file);
                    updateProgress(label);
                }
            }

            // 3. Update _config.yml
            ELEMENTS.publishBtn.textContent = 'Updating site configuration...';
            showWizardLoading('The wizard is updating the site configuration...');
            try {
                await updateConfigYml(owner, repoName);
            } catch (configErr) {
                console.warn('Could not update _config.yml:', configErr.message);
            }
            updateProgress('Configuration updated');

            // 3b. Update _data/theme.yml with featured image (if selected)
            const featuredId = ELEMENTS.configFeaturedImage ? ELEMENTS.configFeaturedImage.value : '';
            if (featuredId) {
                ELEMENTS.publishBtn.textContent = 'Setting featured image...';
                showWizardLoading('The wizard is setting the featured image...');
                try {
                    await updateThemeYml(owner, repoName, featuredId);
                } catch (themeErr) {
                    console.warn('Could not update theme.yml:', themeErr.message);
                }
            }

            // 4. Enable GitHub Pages
            const isCsvTemplate = STATE.templateRepo === 'CollectionBuilder/collectionbuilder-csv';
            const pagesBuildType = isCsvTemplate ? 'workflow' : 'legacy';

            if (isCsvTemplate) {
                ELEMENTS.publishBtn.textContent = 'Adding Jekyll workflow...';
                showWizardLoading('The wizard is adding the Jekyll build workflow...');
                try {
                    await createJekyllWorkflow(owner, repoName);
                } catch (workflowErr) {
                    console.warn('Could not create Jekyll workflow:', workflowErr.message);
                }
            }

            ELEMENTS.publishBtn.textContent = 'Enabling GitHub Pages...';
            showWizardLoading('The wizard is enabling GitHub Pages...');
            const pagesResult = await enableGitHubPages(owner, repoName, pagesBuildType);
            if (pagesResult && pagesResult.error) {
                console.warn('GitHub Pages auto-enable failed:', pagesResult.error);
            }
            updateProgress('GitHub Pages enabled');

            // 5. Success!
            STATE.currentStep = 6;
            STATE.maxStep = Math.max(STATE.maxStep, 6);
            localStorage.setItem('gh_wizard_published', 'true');
            if (progressContainer) progressContainer.classList.add('hidden');
            await hideWizardLoading();
            showPublishSuccess();
            updateUI();
        } catch (error) {
            showError(`Publish failed: ${error.message}`);
            ELEMENTS.publishBtn.textContent = originalText;
            ELEMENTS.publishBtn.disabled = false;
            if (progressContainer) progressContainer.classList.add('hidden');
            await hideWizardLoading();

            const activeStep = document.querySelector('.wizard-step:not(.hidden)');
            if (activeStep) {
                const stepContent = activeStep.querySelector('.step-content');
                if (stepContent) stepContent.classList.remove('hidden');
            }
        }
    });
}
