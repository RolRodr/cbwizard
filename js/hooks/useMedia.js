import { STATE } from '../constants.js';
import { ELEMENTS } from '../elements.js';
import { saveFileToDB, deleteFileFromDB } from '../storage.js';
import { renderImagePreview, showError, updateUI } from '../ui.js';
import { generateDerivativesForFile } from '../utils/derivatives.js';
import { parseCSV, serializeCSV } from '../utils/csv.js';
import { prepareConfigStep } from './useConfigStep.js';

// ─────── Image upload to GitHub ───────

/** Uploads a single media file to the repository's objects/ directory. */
export async function uploadMediaToGitHub(file) {
    const { content, path, name } = file;

    // Check if file already exists
    let sha = null;
    const { githubRequest } = await import('../api.js');
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

/** Deletes a media file from state and IndexedDB, then re-renders the preview. */
export const handleMediaDelete = async (id) => {
    STATE.mediaFiles = STATE.mediaFiles.filter(f => f.id !== id);
    await deleteFileFromDB(id);
    renderImagePreview(STATE.mediaFiles, handleMediaDelete);
    checkDerivativesVisibility();
};

/** Registers event listeners for media file handling (Step 4). */
export function registerMediaListeners() {
    // Media file selection
    ELEMENTS.imageInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB - GitHub's limit for the Contents API
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
        checkDerivativesVisibility();

        // Warn about skipped files
        if (skipped.length > 0) {
            showError(`${skipped.length} file(s) exceeded the 10 MB limit and were skipped: ${skipped.join(', ')}`);
        }

        // Clear value so the same file can be selected again if needed
        ELEMENTS.imageInput.value = '';
    });

    // Derivatives Toggle
    if (ELEMENTS.derivativesToggle) {
        ELEMENTS.derivativesToggle.addEventListener('change', (e) => {
            STATE.generateDerivatives = e.target.checked;
        });
    }

    // Next / Skip buttons
    if (ELEMENTS.step4Next) {
        ELEMENTS.step4Next.addEventListener('click', handleStep4Next);
    }
    if (ELEMENTS.step4Skip) {
        ELEMENTS.step4Skip.addEventListener('click', () => {
            STATE.currentStep = 5;
            STATE.maxStep = Math.max(STATE.maxStep, 5);
            prepareConfigStep();
            updateUI();
        });
    }
}

/** Toggles derivative section visibility depending on template repo and current state. */
export function checkDerivativesVisibility() {
    if (!ELEMENTS.derivativesSection) return;

    // Only CSV template supports automated derivatives via this feature
    const isCsvTemplate = STATE.templateRepo === 'CollectionBuilder/collectionbuilder-csv';

    // Hide original derivatives (thumb/small) from the file list to count manually uploaded images/PDFs
    const originalFiles = STATE.mediaFiles ? STATE.mediaFiles.filter(f => !f.id.startsWith('media_thumb_') && !f.id.startsWith('media_small_')) : [];

    if (isCsvTemplate && originalFiles.length > 0) {
        ELEMENTS.derivativesSection.classList.remove('hidden');
    } else {
        ELEMENTS.derivativesSection.classList.add('hidden');
    }
}

async function handleStep4Next() {
    if (STATE.generateDerivatives && STATE.mediaFiles && STATE.mediaFiles.length > 0) {
        const statusEl = ELEMENTS.derivativesStatus;
        if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.innerHTML = 'Generating derivatives...';
        }

        ELEMENTS.step4Next.disabled = true;
        ELEMENTS.step4Next.textContent = 'Generating...';

        const newDerivatives = [];
        let hasSkippedFiles = false;

        // Remove any old auto-generated derivatives first if user clicked next multiple times
        STATE.mediaFiles = STATE.mediaFiles.filter(f => !f.id.startsWith('media_thumb_') && !f.id.startsWith('media_small_'));

        for (const file of STATE.mediaFiles) {
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                hasSkippedFiles = true;
                continue;
            }
            const generated = await generateDerivativesForFile(file);
            for (const genFile of generated) {
                newDerivatives.push(genFile);
                await saveFileToDB(genFile.id, genFile);
            }
        }

        if (newDerivatives.length > 0) {
            STATE.mediaFiles = [...STATE.mediaFiles, ...newDerivatives];
            await injectDerivativeColumnsIntoCsv();
        }

        if (statusEl) {
            if (hasSkippedFiles) {
                statusEl.innerHTML = '<span style="color: #fca311;">Note: Some non-image files (e.g. Audio) were skipped.</span>';
                await new Promise(r => setTimeout(r, 2000));
            } else {
                statusEl.innerHTML = '<span style="color: var(--success-color);">Done! CSV updated.</span>';
                await new Promise(r => setTimeout(r, 800)); // Let them see it briefly
            }
        }

        ELEMENTS.step4Next.disabled = false;
        ELEMENTS.step4Next.textContent = 'Next: Configure & Publish';
    }

    STATE.currentStep = 5;
    STATE.maxStep = Math.max(STATE.maxStep, 5);
    prepareConfigStep();
    updateUI();
}

/**
 * Parses the current CSV, injects image_small and image_thumb columns,
 * maps them to uploaded image filenames, and serializes back.
 */
async function injectDerivativeColumnsIntoCsv() {
    if (!STATE.csvFile || !STATE.csvFile.content) return;

    const rows = parseCSV(STATE.csvFile.content);
    if (!rows || rows.length < 1) return;

    const header = rows[0];

    // Find or add columns
    let filenameIdx = header.indexOf('filename');
    if (filenameIdx === -1) return; // Can't map without a filename column

    let thumbIdx = header.indexOf('image_thumb');
    if (thumbIdx === -1) {
        thumbIdx = header.length;
        header.push('image_thumb');
        // Backfill existing rows
        for (let i = 1; i < rows.length; i++) rows[i].push('');
    }

    let smallIdx = header.indexOf('image_small');
    if (smallIdx === -1) {
        smallIdx = header.length;
        header.push('image_small');
        // Backfill existing rows
        for (let i = 1; i < rows.length; i++) rows[i].push('');
    }

    // Map uploaded files
    const mediaNames = new Set(STATE.mediaFiles.filter(f => !f.id.startsWith('media_thumb_') && !f.id.startsWith('media_small_')).map(f => f.name));

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const fname = row[filenameIdx];
        if (fname && mediaNames.has(fname)) {
            const baseName = fname.replace(/\.[^/.]+$/, "");

            // Set paths for images and PDFs
            const fileObj = STATE.mediaFiles.find(f => f.name === fname);
            if (fileObj && (fileObj.type.startsWith('image/') || fileObj.type === 'application/pdf')) {
                row[thumbIdx] = `objects/thumbs/${baseName}_th.jpg`;
                row[smallIdx] = `objects/small/${baseName}_sm.jpg`;
            }
        }
    }

    const updatedCsv = serializeCSV(rows);
    STATE.csvFile.content = updatedCsv;
    await saveFileToDB('data.csv', STATE.csvFile);
}
