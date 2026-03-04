import { elements } from './elements.js';

let showTime = 0;
let hideTimeout = null;
const MIN_DISPLAY_TIME_MS = 2000;
let activeLoadingElement = null;
let hiddenSiblings = [];

/**
 * Shows the global wizard loading overlay with a specific message.
 * @param {string} message - The message to display. If not provided, a default applies.
 */
export function showWizardLoading(message = "The wizard is conjuring...") {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }

    const activeStep = document.querySelector('.wizard-step:not(.hidden)');
    if (!activeStep) return;

    const titleElement = activeStep.querySelector('h2');
    if (!titleElement) return;

    // First time showing the loading element for this sequence
    if (!activeLoadingElement) {
        showTime = Date.now();

        // Instantiate template
        const template = elements.wizardLoadingTemplate;
        if (!template) return;

        const clone = template.content.cloneNode(true);
        activeLoadingElement = clone.querySelector('.wizard-loading-inline');

        // Hide siblings but keep h2 and success messages safe if we want
        hiddenSiblings = [];
        Array.from(activeStep.children).forEach(child => {
            // We only hide specific configuration containers during loading
            // to prevent the UI from jumping around, instead of blindly hiding everything.
            // These are the main structural containers inside steps.
            const isMainContainer = child.classList.contains('step-content') ||
                child.id === 'fork-options-container' ||
                child.id === 'repo-choices-container' ||
                child.id === 'existing-repos-container' ||
                child.id === 'step2-success' ||
                child.id === 'repo-config-container' ||
                child.classList.contains('csv-upload-controls');

            if (isMainContainer && !child.classList.contains('hidden')) {
                hiddenSiblings.push(child);
                child.classList.add('hidden');
            }
        });

        // Inject below h2
        titleElement.insertAdjacentElement('afterend', activeLoadingElement);
    }

    // Update text
    if (activeLoadingElement) {
        const textNode = activeLoadingElement.querySelector('.wizard-loading-text');
        if (textNode) textNode.textContent = message;
    }
}

/**
 * Hides the global wizard loading overlay.
 * @returns {Promise<void>} Resolves when the overlay is fully hidden.
 */
export function hideWizardLoading() {
    return new Promise((resolve) => {
        if (!activeLoadingElement) {
            resolve();
            return;
        }

        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        const elapsed = Date.now() - showTime;

        const resolveHide = () => {
            if (activeLoadingElement) {
                activeLoadingElement.remove();
                activeLoadingElement = null;
            }

            // DO NOT automatically restore hiddenSiblings here.
            // UI state management (updateUI, showForkOptions, showExistingRepos, handleValidRepo)
            // is responsible for making sure the correct containers are unhidden.
            // Automatically unhiding them here causes race conditions where
            // containers meant to stay hidden are temporarily flashed back to visibility.
            hiddenSiblings = [];

            resolve();
        };

        if (elapsed < MIN_DISPLAY_TIME_MS) {
            hideTimeout = setTimeout(resolveHide, MIN_DISPLAY_TIME_MS - elapsed);
        } else {
            resolveHide();
        }
    });
}
