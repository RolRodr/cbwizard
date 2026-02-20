import { STATE } from './constants.js';
import { getSteps, elements } from './elements.js';
import { loadDemoCSV } from './hooks/useDemoCSV.js';
import { handleMediaDelete } from './hooks/useFiles.js';
import { validateMediaFilenames } from './validation.js';
import { renderCSVTable, parseCSV } from './utils/csv.js';
import { getRepoContents } from './api.js';


/** Renders a repository's top-level file structure into the file tree container. */
export async function renderRepoFileTree(owner, repoName) {
    const treeContainer = elements.repoFileTreeContainer;
    const treeCode = elements.repoFileTree;

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

/** Renders thumbnail previews for all media files, flagging those not found in the CSV. */
export function renderImagePreview(mediaFiles, onDelete) {
    elements.imagePreview.innerHTML = '';
    if (!mediaFiles || mediaFiles.length === 0) {
        elements.imagePreview.classList.add('hidden');
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

    mediaFiles.forEach(file => {
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
        deleteBtn.innerHTML = '×';
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

        elements.imagePreview.appendChild(container);
    });
    elements.imagePreview.classList.remove('hidden');
}

/** Displays a banner listing critical CSV validation errors, if any. */
export function renderValidationBanner(validationReport, header) {
    const existingBanner = document.getElementById('csv-validation-banner');
    if (existingBanner) existingBanner.remove();

    const navStep3 = document.getElementById('nav-step-3');

    if (!validationReport || validationReport.size === 0) {
        if (navStep3) navStep3.classList.remove('nav-has-errors');
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
    if (navStep3) navStep3.classList.add('nav-has-errors');

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

    if (elements.csvPreview && elements.csvPreview.parentNode) {
        elements.csvPreview.after(banner);
    }

    // Announce to screen readers
    announce(`Found ${errors.length} critical issue${errors.length > 1 ? 's' : ''} in your CSV file. Review the highlighted cells.`);
}

/** Updates the entire UI to reflect the current wizard step and app state. */
export function updateUI() {
    const steps = getSteps();
    steps.forEach((step, index) => {
        if (index === STATE.currentStep) {
            step.classList.remove('hidden');
            step.classList.add('active');
        } else {
            step.classList.add('hidden');
            step.classList.remove('active');
        }
    });

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
        elements.userInfo.classList.remove('hidden');
        elements.username.textContent = STATE.user.login;
    } else {
        elements.userInfo.classList.add('hidden');
    }

    // Restore input values if available
    if (STATE.templateRepo) elements.templateRepoInput.value = STATE.templateRepo;

    restoreStepState();
    updateSidebarNav();
}

/** Restores within-step UI state so navigating back shows the correct post-action view. */
function restoreStepState() {
    // Step 1: if user is authenticated and navigating back, show the profile card
    if (STATE.currentStep === 1 && STATE.user) {
        elements.authForm.classList.add('hidden');
        elements.userAvatar.src = STATE.user.avatar_url;
        elements.userAvatar.alt = `${STATE.user.login}'s avatar`;
        elements.confirmDisplayname.textContent = STATE.user.name || STATE.user.login;
        elements.confirmUsername.textContent = `@${STATE.user.login}`;
        elements.confirmBio.textContent = STATE.user.bio || '';
        elements.confirmRepos.textContent = STATE.user.public_repos + (STATE.user.total_private_repos || 0);
        elements.userConfirmation.classList.remove('hidden');
    }

    // Step 2: if repository selected/forked, show success, hide selection options
    if (STATE.targetRepo) {
        const [owner, repoName] = STATE.targetRepo.split('/');

        // Hide initial options
        if (elements.forkForm) elements.forkForm.classList.add('hidden');
        if (elements.forkOptionsContainer) elements.forkOptionsContainer.classList.add('hidden');
        if (elements.existingReposContainer) elements.existingReposContainer.classList.add('hidden');

        // Show success state
        if (elements.step2Success) {
            elements.step2Success.classList.remove('hidden');

            // Restore Repo Name
            if (elements.selectedRepoName) {
                elements.selectedRepoName.textContent = repoName;
            }

            // Restore Link
            if (elements.newRepoLink) {
                elements.newRepoLink.href = `https://github.com/${STATE.targetRepo}`;
            }

            // Restore File Tree (if empty)
            if (elements.repoFileTree && !elements.repoFileTree.textContent.trim()) {
                renderRepoFileTree(owner, repoName);
            }
        }
    }

    // Step 3: restore CSV preview table on back-navigation
    if (STATE.currentStep === 3) {
        if (STATE.csvFile && STATE.csvFile.content) {
            // Re-render table preview if not yet shown
            const tableWrap = elements.csvPreview;
            const table = elements.csvTable;
            if (tableWrap && table && table.rows.length === 0) {
                const { validationReport, header } = renderCSVTable(STATE.csvFile.content, table);
                tableWrap.classList.remove('hidden');
                renderValidationBanner(validationReport, header);
            }

            // Restore filename input and show controls
            const safeName = (STATE.csvFile.name || 'data.csv').replace(/\.csv$/i, '');
            elements.csvFilenameInput.value = safeName;
            elements.csvUploadControls.classList.remove('hidden');
        }

        if (STATE.targetRepo) {
            loadDemoCSV();
        }
    }

    // Step 4: restore media preview on back-navigation or refresh
    if (STATE.currentStep === 4) {
        if (STATE.mediaFiles && STATE.mediaFiles.length > 0) {
            renderImagePreview(STATE.mediaFiles, handleMediaDelete);
        }
    }
}

/** Updates sidebar navigation to highlight the current step and enable completed steps. */
function updateSidebarNav() {
    const { currentStep, user } = STATE;

    // Show the sidebar once user is on step 1+ and authenticated
    if (!user || currentStep < 1) {
        elements.stepNav.classList.add('hidden');
        if (elements.appLayout) elements.appLayout.classList.add('centered-view');
        return;
    }
    elements.stepNav.classList.remove('hidden');
    if (elements.appLayout) elements.appLayout.classList.remove('centered-view');

    elements.navItems.forEach(item => {
        const itemStep = parseInt(item.dataset.step, 10);
        item.classList.remove('nav-active', 'nav-done');
        item.removeAttribute('aria-current');
        item.removeAttribute('aria-disabled');
        item.removeAttribute('tabindex');

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

/** Registers click and keyboard listeners on sidebar navigation items. */
export function initSidebarNav() {
    elements.navItems.forEach(item => {
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
    elements.globalError.textContent = msg;
    elements.globalError.classList.remove('hidden');
    announce(msg);
}

/** Hides the global error message. */
export function clearError() {
    elements.globalError.textContent = '';
    elements.globalError.classList.add('hidden');
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
