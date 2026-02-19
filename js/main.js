/**
 * GitHub Pages Wizard — Entry Point
 */

import { STATE } from './constants.js';
import { elements } from './elements.js';
import { initDB, getAllFilesFromDB } from './storage.js';
import { decryptToken } from './utils/crypto.js';
import { authenticate, registerAuthListeners } from './hooks/useAuth.js';
import { registerForkListeners } from './hooks/useFork.js';
import { registerExistingForkListeners } from './hooks/useExistingFork.js';
import { registerFileListeners, handleMediaDelete, showPublishSuccess } from './hooks/useFiles.js';
import { updateUI, initSidebarNav, renderImagePreview } from './ui.js';
import { initAboutModal } from './hooks/useAboutModal.js';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    await loadState();

    // Welcome Step Listener
    if (elements.startBtn) {
        elements.startBtn.addEventListener('click', () => {
            STATE.currentStep = 1;
            STATE.maxStep = Math.max(STATE.maxStep, 1);
            updateUI();
        });
    }

    registerAuthListeners();
    registerForkListeners();
    registerExistingForkListeners();
    registerFileListeners();
    initAboutModal();
    initSidebarNav();

    // If we restored to the Published step, render the success view
    if (STATE.currentStep === 6) {
        showPublishSuccess();
    }

    updateUI();
});

// --- State Restoration ---
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

    // Determine step based on progress
    if (STATE.targetRepo) {
        // If user already published, go straight to success (Step 6)
        if (localStorage.getItem('gh_wizard_published') === 'true') {
            STATE.currentStep = 6;
        } else if (STATE.csvFile) {
            STATE.currentStep = STATE.mediaFiles.length > 0 ? 5 : 4;
        } else {
            STATE.currentStep = 3;
        }
    }

    STATE.maxStep = Math.max(STATE.currentStep, STATE.maxStep);
}
