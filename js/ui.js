import { STATE } from './constants.js';
import { getSteps, ELEMENTS } from './elements.js';
import { loadDemoCSV } from './hooks/useDemoCSV.js';
import { handleMediaDelete, checkDerivativesVisibility } from './hooks/useMedia.js';
import { loadRepoCsvPicker } from './hooks/useCsvUpload.js';
import { validateMediaFilenames, validateCSV } from './validation.js';
import { renderCSVTable, parseCSV } from './utils/csv.js';
import { getRepoContents, getGitHubPages } from './api.js';
import { prepareConfigStep } from './hooks/useConfigStep.js';


/** Renders a repository's top-level file structure into the file tree container. */
export async function renderRepoFileTree(owner, repoName) {
    const treeContainer = ELEMENTS.repoFileTreeContainer;
    const treeCode = ELEMENTS.repoFileTree;

    if (!treeContainer || !treeCode) return;

    treeContainer.classList.remove('hidden');
    treeCode.textContent = "Loading file structure...";

    try {
        const contents = await getRepoContents(owner, repoName);

        // Sort: directories first, then files
        contents.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
        });

        let treeStr = "";
        contents.forEach(item => {
            const icon = item.type === 'dir' ? '/' : '';
            treeStr += `${item.name}${icon}\n`;
        });

        treeCode.textContent = treeStr;
    } catch (err) {
        console.error("Error fetching repo contents:", err);
        treeCode.textContent = "Error loading file structure.";
    }
}

/** Renders repository configuration from _config.yml to the UI. */
export async function renderRepoConfig(owner, repoName) {
    const configContainer = ELEMENTS.repoConfigContainer;
    const configContent = ELEMENTS.repoConfigContent;

    if (!configContainer || !configContent) return;

    configContainer.classList.remove('hidden');
    configContent.innerHTML = "<p>Loading repository configuration...</p>";

    try {
        const fileData = await getRepoContents(owner, repoName, '_config.yml');

        if (!fileData || !fileData.content) {
            throw new Error("Could not fetch _config.yml.");
        }

        // Decode base64 content
        const contentStr = decodeURIComponent(escape(atob(fileData.content)));

        // Simple regex extraction for YAML properties
        const extractProp = (key) => {
            const regex = new RegExp(`^${key}:\\s*(.*)`, 'm');
            const match = contentStr.match(regex);
            let val = match ? match[1].trim() : '';
            // Remove optional surrounding quotes
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            return val || `<span style="color: #999; font-style: italic;">Not set</span>`;
        };

        const configUI = `
            <ul style="list-style: none; padding: 0; margin: 0; text-align: left;">
                <li style="margin-bottom: 8px;"><strong>Title:</strong> ${extractProp('title')}</li>
                <li style="margin-bottom: 8px;"><strong>Tagline:</strong> ${extractProp('tagline')}</li>
                <li style="margin-bottom: 8px;"><strong>Description:</strong> ${extractProp('description')}</li>
                <li style="margin-bottom: 8px;"><strong>Author:</strong> ${extractProp('author')}</li>
                <li style="margin-bottom: 8px;"><strong>Metadata:</strong> ${extractProp('metadata')}</li>
            </ul>
        `;

        configContent.innerHTML = configUI;

        // Fetch and append GitHub Pages configuration
        try {
            const pagesData = await getGitHubPages(owner, repoName);
            const ul = configContent.querySelector('ul');
            const li = document.createElement('li');
            li.style.marginTop = '16px';
            li.style.paddingTop = '16px';
            li.style.borderTop = '1px solid #eaecef';

            if (pagesData && pagesData.html_url) {
                li.innerHTML = `<strong>GitHub Pages:</strong> <a href="${pagesData.html_url}" target="_blank" rel="noopener noreferrer">${pagesData.html_url} <i data-lucide="external-link" aria-hidden="true" class="lucide-inline"></i></a>`;
            } else {
                li.innerHTML = `<strong>GitHub Pages:</strong> <span style="color: #d9534f; font-weight: 500;">Not configured</span>`;
            }
            ul.appendChild(li);
        } catch (pagesErr) {
            console.warn("Failed to fetch GitHub Pages status:", pagesErr);
            // Optionally, we could append an error message, but continuing silently is okay too.
        }

    } catch (err) {
        console.error("Error fetching repo config:", err);
        configContent.innerHTML = `<p class="error-text">Error loading configuration: ${err.message}</p>`;
    }
}

/** Renders thumbnail previews for all media files, flagging those not found in the CSV. */
export function renderImagePreview(mediaFiles, onDelete) {
    ELEMENTS.imagePreview.innerHTML = '';
    if (!mediaFiles || mediaFiles.length === 0) {
        ELEMENTS.imagePreview.classList.add('hidden');
        return;
    }

    // Get valid filenames from CSV if available
    let invalidFiles = new Set();
    if (STATE.csvFile && STATE.csvFile.content) {
        const rows = parseCSV(STATE.csvFile.content);
        // Reuse validateMediaFilenames for checking if filename exists in CSV
        // (Assuming validateMediaFilenames checks against the 'filename' column)
        invalidFiles = validateMediaFilenames(mediaFiles, rows);
    }

    // Filter out generated derivatives so they don't clutter the preview
    const originalMediaFiles = mediaFiles.filter(f => !f.id.startsWith('media_thumb_') && !f.id.startsWith('media_small_'));

    originalMediaFiles.forEach(file => {
        const container = document.createElement('div');
        container.classList.add('image-preview-item');

        const isInvalid = invalidFiles.has(file.name);
        if (isInvalid) {
            container.classList.add('invalid-image');
            container.title = 'Filename not found in CSV';
        }

        // Thumbnail Wrapper
        const thumbWrapper = document.createElement('div');
        thumbWrapper.classList.add('image-thumbnail-wrapper');
        // Center content in wrapper
        thumbWrapper.style.display = 'flex';
        thumbWrapper.style.justifyContent = 'center';
        thumbWrapper.style.alignItems = 'center';
        thumbWrapper.style.backgroundColor = '#f6f8fa';

        let previewEl;
        if (file.type.startsWith('image/')) {
            previewEl = document.createElement('img');
            previewEl.src = `data:${file.type};base64,${file.content}`;
            previewEl.alt = file.name;
            previewEl.classList.add('image-thumbnail');
        } else if (file.type.startsWith('audio/')) {
            previewEl = document.createElement('div');
            previewEl.textContent = 'Audio';
            previewEl.style.fontSize = '16px';
        } else if (file.type === 'application/pdf') {
            previewEl = document.createElement('div');
            previewEl.textContent = 'PDF';
            previewEl.style.fontSize = '16px';
        } else {
            previewEl = document.createElement('div');
            previewEl.textContent = 'File';
            previewEl.style.fontSize = '16px';
        }

        thumbWrapper.appendChild(previewEl);

        // Info Section
        const infoDiv = document.createElement('div');
        infoDiv.classList.add('image-info');

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('image-filename');
        nameSpan.textContent = file.name;
        nameSpan.title = file.name;

        infoDiv.appendChild(nameSpan);

        if (isInvalid) {
            const badge = document.createElement('span');
            badge.classList.add('validation-badge');
            badge.textContent = 'Not in CSV';
            infoDiv.appendChild(badge);
        }

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
        deleteBtn.title = 'Remove file';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.setAttribute('aria-label', `Remove ${file.name}`);

        deleteBtn.onclick = (e) => {
            e.preventDefault();
            onDelete(file.id);
        };

        container.appendChild(deleteBtn);
        container.appendChild(thumbWrapper);
        container.appendChild(infoDiv);

        ELEMENTS.imagePreview.appendChild(container);
    });
    ELEMENTS.imagePreview.classList.remove('hidden');
    window.lucide?.createIcons();
}

/** Displays a banner listing critical CSV validation errors, if any. */
export function renderValidationBanner(validationReport, header) {
    const existingBanner = document.getElementById('csv-validation-banner');
    if (existingBanner) existingBanner.remove();

    const navCsv = document.getElementById('nav-csv');

    if (!validationReport || validationReport.size === 0) {
        if (navCsv) navCsv.classList.remove('nav-has-errors');
        return;
    }

    let errors = [];
    for (const [key, issue] of validationReport) {
        if (issue.type === 'error') errors.push({ key, issue });
    }

    if (errors.length === 0) {
        if (navStep3) navStep3.classList.remove('nav-has-errors');
        return;
    }

    // Flag the CSV nav step with a critical-issue indicator
    if (navCsv) navCsv.classList.add('nav-has-errors');

    const banner = document.createElement('div');
    banner.id = 'csv-validation-banner';
    banner.className = 'validation-error-banner';

    const title = document.createElement('h3');
    title.textContent = `Found ${errors.length} Critical Issue${errors.length > 1 ? 's' : ''}`;
    banner.appendChild(title);

    const list = document.createElement('ul');
    errors.forEach(({ key, issue }) => {
        const [rowStr, colStr] = key.split(',');
        const rowNum = parseInt(rowStr, 10);
        const colIndex = parseInt(colStr, 10);
        const colName = header[colIndex] || `Column ${colIndex + 1}`;
        const lineNum = rowNum + 1;

        const li = document.createElement('li');
        li.textContent = `${colName} | Row ${lineNum} | ${issue.msg}`;
        list.appendChild(li);
    });
    banner.appendChild(list);

    const csvUploadControls = ELEMENTS.csvUploadControls;
    if (csvUploadControls && csvUploadControls.parentNode) {
        csvUploadControls.after(banner);
    }

    // Announce to screen readers
    announce(`Found ${errors.length} critical issue${errors.length > 1 ? 's' : ''} in your CSV file. Review the highlighted cells.`);
}

/** Whether a step transition is currently animating. */
let _transitioning = false;

/** Set to true to skip animation (e.g. initial load). */
let _skipTransition = true;

/** Updates the entire UI to reflect the current wizard step and app state. */
export function updateUI() {
    // Persist the current step so refreshes return to the same view
    localStorage.setItem('gh_wizard_current_step', STATE.currentStep);

    const steps = getSteps();

    if (_skipTransition || _transitioning) {
        // Instant swap (initial load or already animating)
        _skipTransition = false;
        steps.forEach((step, index) => {
            if (index === STATE.currentStep) {
                step.classList.remove('hidden', 'step-exiting', 'step-entering');
                step.classList.add('active', 'step-entering');
            } else {
                step.classList.add('hidden');
                step.classList.remove('active', 'step-entering', 'step-exiting');
            }
        });
        _finishTransition(steps);
        return;
    }

    // Find the currently visible step
    const currentlyVisible = Array.from(steps).find(
        s => s.classList.contains('active') && !s.classList.contains('hidden')
    );

    if (!currentlyVisible || currentlyVisible === steps[STATE.currentStep]) {
        // No animation needed — just show the target
        steps.forEach((step, index) => {
            if (index === STATE.currentStep) {
                step.classList.remove('hidden');
                step.classList.add('active', 'step-entering');
            } else {
                step.classList.add('hidden');
                step.classList.remove('active', 'step-entering', 'step-exiting');
            }
        });
        _finishTransition(steps);
        return;
    }

    _transitioning = true;

    // Animate out the current step
    currentlyVisible.classList.add('step-exiting');

    const onExitEnd = (e) => {
        // Ignore bubbled animationend events from child elements
        if (e && e.target !== currentlyVisible) return;
        currentlyVisible.removeEventListener('animationend', onExitEnd);
        currentlyVisible.classList.add('hidden');
        currentlyVisible.classList.remove('active', 'step-exiting');

        // Animate in the new step
        const nextStep = steps[STATE.currentStep];
        if (nextStep) {
            nextStep.classList.remove('hidden');
            nextStep.classList.add('active', 'step-entering');

            const onEnterEnd = (e) => {
                // Ignore bubbled animationend events from child elements
                if (e && e.target !== nextStep) return;
                nextStep.removeEventListener('animationend', onEnterEnd);
                nextStep.classList.remove('step-entering');
                _transitioning = false;
            };
            nextStep.addEventListener('animationend', onEnterEnd);
        } else {
            _transitioning = false;
        }

        _finishTransition(steps);
    };

    currentlyVisible.addEventListener('animationend', onExitEnd);

    // Safety fallback in case animationend doesn't fire
    setTimeout(() => {
        if (_transitioning) {
            currentlyVisible.removeEventListener('animationend', onExitEnd);
            onExitEnd();
        }
    }, 300);
}

/** Shared post-transition work: focus, user info, restore state, sidebar. */
function _finishTransition(steps) {
    // Move focus to the active step heading for keyboard/screen-reader users
    const activeStep = steps[STATE.currentStep];
    if (activeStep) {
        const heading = activeStep.querySelector('h2');
        if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus();
        }
    }

    if (STATE.user) {
        ELEMENTS.userInfo.classList.remove('hidden');
        if (ELEMENTS.username) ELEMENTS.username.textContent = STATE.user.login;
        if (ELEMENTS.topAvatar) ELEMENTS.topAvatar.src = STATE.user.avatar_url;
    } else {
        ELEMENTS.userInfo.classList.add('hidden');
    }

    // Restore input values if available
    if (STATE.templateRepo) ELEMENTS.templateRepoInput.value = STATE.templateRepo;

    // Prepare the Configure step whenever it becomes active
    if (STATE.currentStep === 5) {
        prepareConfigStep();
    }

    restoreStepState();
    updateSidebarNav();
    updateRepoSidebar();
    window.lucide?.createIcons();
}

/** Restores within-step UI state so navigating back shows the correct post-action view. */
function restoreStepState() {
    // Step 1: if user is authenticated and navigating back, show the profile card
    if (STATE.currentStep === 1 && STATE.user) {
        ELEMENTS.authForm.classList.add('hidden');
        ELEMENTS.userAvatar.src = STATE.user.avatar_url;
        ELEMENTS.userAvatar.alt = `${STATE.user.login}'s avatar`;
        ELEMENTS.confirmDisplayname.textContent = STATE.user.name || STATE.user.login;
        ELEMENTS.confirmUsername.textContent = `@${STATE.user.login}`;
        ELEMENTS.confirmBio.textContent = STATE.user.bio || '';
        ELEMENTS.confirmRepos.textContent = STATE.user.public_repos + (STATE.user.total_private_repos || 0);
        ELEMENTS.userConfirmation.classList.remove('hidden');
    }

    // Step 2: if repository selected/forked, show success, hide selection options
    if (STATE.targetRepo) {
        const [owner, repoName] = STATE.targetRepo.split('/');

        // Hide initial options
        if (ELEMENTS.forkForm) ELEMENTS.forkForm.classList.add('hidden');
        if (ELEMENTS.forkOptionsContainer) ELEMENTS.forkOptionsContainer.classList.add('hidden');
        if (ELEMENTS.existingReposContainer) ELEMENTS.existingReposContainer.classList.add('hidden');
        if (ELEMENTS.repoChoicesContainer) ELEMENTS.repoChoicesContainer.classList.add('hidden');

        // Show success state
        if (ELEMENTS.repositorySuccess) {
            ELEMENTS.repositorySuccess.classList.remove('hidden');

            // Restore Repo Name
            if (ELEMENTS.selectedRepoName) {
                ELEMENTS.selectedRepoName.textContent = repoName;
            }

            // Restore Link
            if (ELEMENTS.newRepoLink) {
                ELEMENTS.newRepoLink.href = `https://github.com/${STATE.targetRepo}`;
            }

            // Restore Config or File Tree
            if (STATE.isExistingRepo) {
                if (ELEMENTS.repoFileTreeContainer) ELEMENTS.repoFileTreeContainer.classList.add('hidden');

                if (ELEMENTS.repoConfigContainer) ELEMENTS.repoConfigContainer.classList.remove('hidden');
                if (ELEMENTS.repoConfigContent && !ELEMENTS.repoConfigContent.innerHTML.trim()) {
                    renderRepoConfig(owner, repoName);
                }
            } else {
                if (ELEMENTS.repoConfigContainer) ELEMENTS.repoConfigContainer.classList.add('hidden');

                if (ELEMENTS.repoFileTreeContainer) ELEMENTS.repoFileTreeContainer.classList.remove('hidden');
                if (ELEMENTS.repoFileTree && !ELEMENTS.repoFileTree.textContent.trim()) {
                    renderRepoFileTree(owner, repoName);
                }
            }
        }
    }

    // Step 3: restore CSV state on back-navigation
    if (STATE.currentStep === 3) {
        const hasCsv = STATE.csvFile && STATE.csvFile.content;
        const hasGsLink = STATE.googleSheetUrl;

        if (hasCsv || hasGsLink) {
            // Skip info view and option cards — go straight to the data preview
            ELEMENTS.step3InfoView.classList.add('hidden');
            ELEMENTS.step3UploadView.classList.remove('hidden');
            ELEMENTS.csvUploadChoicesContainer.classList.add('hidden');

            // Hide the sub-source forms
            const uploadCsvSection = document.getElementById('upload-csv-section');
            const repoCsvPicker = document.getElementById('repo-csv-picker');
            const googleSheetsSection = document.getElementById('google-sheets-section');
            if (uploadCsvSection) uploadCsvSection.classList.add('hidden');
            if (repoCsvPicker) repoCsvPicker.classList.add('hidden');
            if (googleSheetsSection) googleSheetsSection.classList.add('hidden');

            // Show "Change metadata source" button
            const changeBtn = document.getElementById('csv-change-source-btn');
            if (changeBtn) changeBtn.classList.remove('hidden');
        }

        if (hasCsv) {
            // CSV file mode — restore status card
            const filenameEl = document.getElementById('csv-status-filename');
            const badgeEl = document.getElementById('csv-status-badge');
            if (filenameEl) filenameEl.textContent = STATE.csvFile.name || 'data.csv';
            if (badgeEl) {
                const rows = parseCSV(STATE.csvFile.content);
                const report = validateCSV(rows);
                let errorCount = 0, warningCount = 0;
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

            // Ensure CSV mode UI is correct
            const statusCard = document.getElementById('csv-status-card');
            const gsLinkStatus = document.getElementById('gs-link-status');
            const filenameRow = document.getElementById('csv-filename-row');
            if (statusCard) statusCard.classList.remove('hidden');
            if (gsLinkStatus) gsLinkStatus.classList.add('hidden');
            if (filenameRow) filenameRow.classList.remove('hidden');

            // Restore filename input and show controls
            const safeName = (STATE.csvFile.name || 'data.csv').replace(/\.csv$/i, '');
            ELEMENTS.csvFilenameInput.value = safeName;
            ELEMENTS.csvUploadControls.classList.remove('hidden');

            // Restore inline preview
            const inlinePreviewEl = document.getElementById('csv-inline-preview');
            const inlineTableEl = document.getElementById('csv-inline-preview-table');
            if (inlinePreviewEl && inlineTableEl) {
                const previewResult = renderCSVTable(STATE.csvFile.content, inlineTableEl, true);
                const badgesEl2 = document.getElementById('csv-inline-preview-badges');
                const hintEl2 = document.getElementById('csv-inline-preview-hint');
                if (badgesEl2 && previewResult) {
                    badgesEl2.innerHTML = '';
                    let ec = 0, wc = 0;
                    for (const iss of previewResult.validationReport.values()) {
                        if (iss.type === 'error') ec++;
                        else if (iss.type === 'warning') wc++;
                    }
                    if (ec > 0) {
                        const b = document.createElement('span');
                        b.className = 'csv-modal-badge csv-modal-badge--error';
                        b.textContent = `${ec} error${ec > 1 ? 's' : ''}`;
                        badgesEl2.appendChild(b);
                    }
                    if (wc > 0) {
                        const b = document.createElement('span');
                        b.className = 'csv-modal-badge csv-modal-badge--warning';
                        b.textContent = `${wc} warning${wc > 1 ? 's' : ''}`;
                        badgesEl2.appendChild(b);
                    }
                    if (ec === 0 && wc === 0) {
                        const b = document.createElement('span');
                        b.className = 'csv-modal-badge csv-modal-badge--success';
                        b.innerHTML = '<i data-lucide="check" aria-hidden="true" class="lucide-inline"></i> All clear';
                        badgesEl2.appendChild(b);
                    }
                    window.lucide?.createIcons();
                }
                if (hintEl2) {
                    const rows2 = parseCSV(STATE.csvFile.content);
                    const dataRows = Math.max(0, rows2.length - 1);
                    const cols = rows2[0]?.length || 0;
                    hintEl2.textContent = `${dataRows} row${dataRows !== 1 ? 's' : ''}, ${cols} column${cols !== 1 ? 's' : ''}.`;
                }
                inlinePreviewEl.classList.remove('hidden');
            }

        } else if (hasGsLink) {
            // Link mode — restore link status card, hide CSV-mode elements
            const statusCard = document.getElementById('csv-status-card');
            const gsLinkStatus = document.getElementById('gs-link-status');
            const filenameRow = document.getElementById('csv-filename-row');
            if (statusCard) statusCard.classList.add('hidden');
            if (gsLinkStatus) gsLinkStatus.classList.remove('hidden');
            if (filenameRow) filenameRow.classList.add('hidden');
            if (ELEMENTS.step3Next) ELEMENTS.step3Next.disabled = false;
            ELEMENTS.csvUploadControls.classList.remove('hidden');
        }

        if (STATE.targetRepo) {
            loadDemoCSV();
            loadRepoCsvPicker();
        }
    }

    // Step 4: restore media preview on back-navigation or refresh
    if (STATE.currentStep === 4) {
        if (STATE.mediaFiles && STATE.mediaFiles.length > 0) {
            renderImagePreview(STATE.mediaFiles, handleMediaDelete);
        }
        checkDerivativesVisibility();
    }
}

/** Updates sidebar navigation to highlight the current step and enable completed steps. */
function updateSidebarNav() {
    const { currentStep, user } = STATE;

    // Show the sidebar once user is on step 1+ and authenticated
    if (!user || currentStep < 1) {
        ELEMENTS.stepNav.classList.add('hidden');
        if (ELEMENTS.appLayout) {
            ELEMENTS.appLayout.classList.add('centered-view');
        }
        return;
    }
    ELEMENTS.stepNav.classList.remove('hidden');
    if (ELEMENTS.appLayout) ELEMENTS.appLayout.classList.remove('centered-view');

    // Hide the "Connect" nav item once the user is authenticated and past step 1
    const connectNav = document.getElementById('nav-connect');
    if (connectNav) {
        if (STATE.maxStep > 1) {
            connectNav.classList.add('hidden');
        } else {
            connectNav.classList.remove('hidden');
        }
    }

    ELEMENTS.navItems.forEach(item => {
        const itemStep = parseInt(item.dataset.step, 10);
        item.classList.remove('nav-active', 'nav-done');
        item.removeAttribute('aria-current');
        item.removeAttribute('aria-disabled');
        item.removeAttribute('tabindex');

        // Skip hidden items
        if (item.classList.contains('hidden')) return;

        if (itemStep === currentStep) {
            item.classList.add('nav-active');
            item.setAttribute('aria-current', 'step');
        } else if (itemStep <= STATE.maxStep) {
            item.classList.add('nav-done');
            item.setAttribute('tabindex', '0');
        } else {
            item.setAttribute('aria-disabled', 'true');
        }
    });
}


/** Populates the repo info panel (inside left nav) with current state data. */
let _sidebarConfigFetched = null; // tracks which repo config has been fetched

function updateRepoSidebar() {
    const sidebar = ELEMENTS.repoSidebar;
    if (!sidebar) return;

    if (!STATE.targetRepo) {
        sidebar.classList.add('hidden');
        return;
    }

    sidebar.classList.remove('hidden');

    const [owner, repoName] = STATE.targetRepo.split('/');

    // Repo identity
    if (ELEMENTS.sidebarRepoName) {
        ELEMENTS.sidebarRepoName.textContent = repoName;
    }
    if (ELEMENTS.sidebarRepoLink) {
        ELEMENTS.sidebarRepoLink.href = `https://github.com/${STATE.targetRepo}`;
        ELEMENTS.sidebarRepoLink.classList.remove('hidden');
    }
    if (ELEMENTS.sidebarForkSource) {
        if (!STATE.isExistingRepo && STATE.templateRepo) {
            ELEMENTS.sidebarForkSource.textContent = `Forked from ${STATE.templateRepo.split('/')[1]}`;
            ELEMENTS.sidebarForkSource.classList.remove('hidden');
        } else {
            ELEMENTS.sidebarForkSource.classList.add('hidden');
        }
    }

    // Files summary
    if (ELEMENTS.sidebarCsvStatus) {
        if (STATE.csvFile && STATE.csvFile.name) {
            ELEMENTS.sidebarCsvStatus.textContent = STATE.csvFile.name;
            ELEMENTS.sidebarCsvStatus.style.color = 'var(--success-color)';
            if (ELEMENTS.sidebarCsvPreviewBtn) ELEMENTS.sidebarCsvPreviewBtn.classList.remove('hidden');
        } else if (STATE.googleSheetUrl) {
            ELEMENTS.sidebarCsvStatus.textContent = 'Linked to Google Sheet';
            ELEMENTS.sidebarCsvStatus.style.color = 'var(--success-color)';
            if (ELEMENTS.sidebarCsvPreviewBtn) ELEMENTS.sidebarCsvPreviewBtn.classList.remove('hidden');
        } else {
            ELEMENTS.sidebarCsvStatus.textContent = 'Not uploaded';
            ELEMENTS.sidebarCsvStatus.style.color = '';
            if (ELEMENTS.sidebarCsvPreviewBtn) ELEMENTS.sidebarCsvPreviewBtn.classList.add('hidden');
        }
    }
    if (ELEMENTS.sidebarMediaCount) {
        const count = STATE.mediaFiles ? STATE.mediaFiles.length : 0;
        ELEMENTS.sidebarMediaCount.textContent = `${count} file${count !== 1 ? 's' : ''}`;
    }

    // Fetch config + pages status (only once per repo)
    if (_sidebarConfigFetched !== STATE.targetRepo) {
        _sidebarConfigFetched = STATE.targetRepo;
        _fetchSidebarConfig(owner, repoName);
    }
}

/** Fetches _config.yml and GitHub Pages status for the sidebar. */
async function _fetchSidebarConfig(owner, repoName) {
    // Config
    try {
        const fileData = await getRepoContents(owner, repoName, '_config.yml');
        if (fileData && fileData.content) {
            const contentStr = decodeURIComponent(escape(atob(fileData.content)));
            const extract = (key) => {
                const regex = new RegExp(`^${key}:\\s*(.*)`, 'm');
                const match = contentStr.match(regex);
                let val = match ? match[1].trim() : '';
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
                return val || '—';
            };

            if (ELEMENTS.sidebarConfigTitle) ELEMENTS.sidebarConfigTitle.textContent = extract('title');
            if (ELEMENTS.sidebarConfigTagline) ELEMENTS.sidebarConfigTagline.textContent = extract('tagline');
            if (ELEMENTS.sidebarConfigMetadata) ELEMENTS.sidebarConfigMetadata.textContent = extract('metadata');
        }
    } catch (e) {
        console.warn('Failed to fetch config for sidebar:', e);
    }

    // Pages status
    try {
        const pagesData = await getGitHubPages(owner, repoName);
        if (ELEMENTS.sidebarPagesStatus) {
            if (pagesData && pagesData.html_url) {
                ELEMENTS.sidebarPagesStatus.innerHTML = `
                    <span class="sidebar-status-dot sidebar-status-dot--active"></span>
                    <a href="${pagesData.html_url}" target="_blank" rel="noopener noreferrer">
                        Live <i data-lucide="external-link" aria-hidden="true" class="lucide-inline"></i>
                    </a>
                `;
            } else {
                ELEMENTS.sidebarPagesStatus.innerHTML = `
                    <span class="sidebar-status-dot sidebar-status-dot--inactive"></span>
                    Not configured
                `;
            }
            window.lucide?.createIcons();
        }
    } catch (e) {
        console.warn('Failed to fetch Pages status for sidebar:', e);
    }
}

/** Registers click and keyboard listeners on sidebar navigation items. */
export function initSidebarNav() {
    ELEMENTS.navItems.forEach(item => {
        // Click handler
        item.addEventListener('click', () => {
            if (item.classList.contains('nav-done')) {
                STATE.currentStep = parseInt(item.dataset.step, 10);
                updateUI();
            }
        });

        // Keyboard handler (Enter / Space)
        item.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && item.classList.contains('nav-done')) {
                e.preventDefault();
                STATE.currentStep = parseInt(item.dataset.step, 10);
                updateUI();
            }
        });
    });
}

/** Displays a global error message to the user. */
export function showError(msg) {
    ELEMENTS.globalError.textContent = msg;
    ELEMENTS.globalError.classList.remove('hidden');
    announce(msg);
}

/** Hides the global error message. */
export function clearError() {
    ELEMENTS.globalError.textContent = '';
    ELEMENTS.globalError.classList.add('hidden');
}

/** Announces a message to screen readers via the ARIA live region. */
export function announce(msg) {
    const el = document.getElementById('sr-announcer');
    if (el) {
        el.textContent = '';
        // Force re-announce by clearing first, then setting after a tick
        requestAnimationFrame(() => { el.textContent = msg; });
    }
}
