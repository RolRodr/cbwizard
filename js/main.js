/**
 * GitHub Pages Wizard — Entry Point
 */

import { STATE } from './constants.js';
import { ELEMENTS } from './elements.js';
import { initDB, getAllFilesFromDB } from './storage.js';
import { decryptToken } from './utils/crypto.js';
import { authenticate, registerAuthListeners } from './hooks/useAuth.js';
import { registerForkListeners } from './hooks/useFork.js';
import { registerExistingForkListeners } from './hooks/useExistingFork.js';
import { registerMediaListeners, handleMediaDelete } from './hooks/useMedia.js';
import { registerCsvUploadListeners } from './hooks/useCsvUpload.js';
import { registerPublishListeners, showPublishSuccess } from './hooks/usePublish.js';
import { updateUI, initSidebarNav, renderImagePreview } from './ui.js';
import { initAboutModal } from './hooks/useAboutModal.js';
import { initCsvModal } from './hooks/useCsvModal.js';
import { loadPartials } from './utils/loadPartials.js';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadPartials();
    window.lucide?.createIcons();
    await initDB();
    await loadState();

    // Welcome Step Listener
    if (ELEMENTS.startBtn) {
        ELEMENTS.startBtn.addEventListener('click', () => {
            STATE.currentStep = 1;
            STATE.maxStep = Math.max(STATE.maxStep, 1);
            updateUI();
        });
    }

    registerAuthListeners();
    registerForkListeners();
    registerExistingForkListeners();
    registerCsvUploadListeners();
    registerMediaListeners();
    registerPublishListeners();
    initAboutModal();
    initCsvModal();
    initSidebarNav();
    initCsvPreviewModal();

    // If we restored to the Published step, render the success view
    if (STATE.currentStep === 6) {
        showPublishSuccess();
    }

    updateUI();
});

/** Restores persisted state (token, repo, files) from localStorage and IndexedDB. */
async function loadState() {
    const savedEncrypted = localStorage.getItem('gh_wizard_token');

    // If we have an encrypted token, decrypt and restore
    if (savedEncrypted) {
        const savedToken = await decryptToken(savedEncrypted);
        if (savedToken) {
            STATE.token = savedToken;
            STATE.currentStep = 2; // Default to Fork if authenticated
            authenticate(savedToken, true);
        } else {
            // Decryption failed — discard corrupted token
            localStorage.removeItem('gh_wizard_token');
        }
    }

    STATE.templateRepo = localStorage.getItem('gh_wizard_template') || STATE.templateRepo;
    STATE.targetRepo = localStorage.getItem('gh_wizard_target');
    STATE.isExistingRepo = localStorage.getItem('gh_wizard_is_existing') === 'true';

    // Restore files from IndexedDB
    try {
        const files = await getAllFilesFromDB();

        // Restore CSV
        const csv = files.find(f => f.id === 'data.csv');
        if (csv) {
            STATE.csvFile = csv;
        }

        // Restore Media (support both new 'media_' and old 'image_' for transition)
        const mediaFiles = files.filter(f => f.id.startsWith('media_') || f.id.startsWith('image_'));
        if (mediaFiles.length > 0) {
            STATE.mediaFiles = mediaFiles;
            renderImagePreview(STATE.mediaFiles, handleMediaDelete);
        }

    } catch (e) {
        console.warn("Failed to restore files from DB:", e);
    }

    // Determine the furthest step based on progress
    let computedStep = STATE.currentStep;
    if (STATE.targetRepo) {
        if (localStorage.getItem('gh_wizard_published') === 'true') {
            computedStep = 6;
        } else if (STATE.csvFile) {
            computedStep = STATE.mediaFiles.length > 0 ? 5 : 4;
        } else {
            computedStep = 3;
        }
    }

    STATE.maxStep = Math.max(computedStep, STATE.maxStep);

    // Restore the user's last-viewed step (clamped to their max progress)
    const savedStep = localStorage.getItem('gh_wizard_current_step');
    if (savedStep !== null) {
        STATE.currentStep = Math.min(parseInt(savedStep, 10), STATE.maxStep);
    } else {
        STATE.currentStep = computedStep;
    }
}

// ── Global CSV Preview Modal ──
export function initCsvPreviewModal() {
    // Use event delegation for the preview button in case the sidebar is rendered dynamically
    document.addEventListener('click', async (e) => {
        const previewBtn = e.target.closest('#sidebar-csv-preview-btn');
        if (previewBtn) {
            e.preventDefault();
            let csvContentToRender = null;

            if (STATE.csvFile && STATE.csvFile.content) {
                csvContentToRender = STATE.csvFile.content;
            } else if (STATE.googleSheetUrl) {
                try {
                    if (ELEMENTS.csvPreviewTableContainer) ELEMENTS.csvPreviewTableContainer.innerHTML = '<div style="padding: 24px;">Fetching Google Sheet data...</div>';
                    if (ELEMENTS.csvPreviewOverlay) ELEMENTS.csvPreviewOverlay.classList.remove('hidden');

                    const response = await fetch(STATE.googleSheetUrl);
                    if (response.ok) {
                        const text = await response.text();
                        if (!text.trim().startsWith('<!DOCTYPE html>')) {
                            csvContentToRender = text;
                        } else {
                            throw new Error("Received HTML instead of valid CSV data (double-check the Publish URL).");
                        }
                    } else {
                        throw new Error(`Failed to fetch Google Sheet: ${response.statusText}`);
                    }
                } catch (err) {
                    if (ELEMENTS.csvPreviewTableContainer) ELEMENTS.csvPreviewTableContainer.innerHTML = `<div style="padding: 24px; color: var(--error-color);">Error fetching sheet: ${err.message}</div>`;
                    return;
                }
            }

            if (csvContentToRender) {
                // We need to import renderCSVTable to show it
                const { renderCSVTable } = await import('./utils/csv.js');

                // Clear out previous
                if (ELEMENTS.csvPreviewTableContainer) ELEMENTS.csvPreviewTableContainer.innerHTML = '';

                // Render table
                renderCSVTable(csvContentToRender, ELEMENTS.csvPreviewTableContainer);

                // Show modal
                if (ELEMENTS.csvPreviewOverlay) ELEMENTS.csvPreviewOverlay.classList.remove('hidden');
            }
        }
    });

    // Close button delegation

    if (ELEMENTS.csvPreviewClose) {
        ELEMENTS.csvPreviewClose.addEventListener('click', () => {
            if (ELEMENTS.csvPreviewOverlay) ELEMENTS.csvPreviewOverlay.classList.add('hidden');
            if (ELEMENTS.csvPreviewTableContainer) ELEMENTS.csvPreviewTableContainer.innerHTML = '';
        });
    }

    if (ELEMENTS.csvPreviewOverlay) {
        ELEMENTS.csvPreviewOverlay.addEventListener('click', (e) => {
            if (e.target === ELEMENTS.csvPreviewOverlay) {
                ELEMENTS.csvPreviewOverlay.classList.add('hidden');
                if (ELEMENTS.csvPreviewTableContainer) ELEMENTS.csvPreviewTableContainer.innerHTML = '';
            }
        });
    }
}
