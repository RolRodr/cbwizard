/**
 * useAboutModal — Creates and manages the "About this Project" modal.
 *
 * Usage:
 *   import { initAboutModal, openAboutModal } from './hooks/useAboutModal.js';
 *   initAboutModal();                         // call once after DOMContentLoaded
 *   someLink.addEventListener('click', openAboutModal);
 */

let modalEl = null;
let buildPromise = null;

/** Creates the modal DOM element and wires close/backdrop/escape listeners. */
async function buildModal() {
    modalEl = document.createElement('div');
    modalEl.id = 'about-modal';
    modalEl.classList.add('about-modal-overlay', 'hidden');
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'about-modal-title');

    try {
        const response = await fetch('partials/about-modal.html');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        modalEl.innerHTML = await response.text();
    } catch (error) {
        console.error('Failed to load about modal content:', error);
        modalEl.innerHTML = `
            <div class="about-modal-content">
                <button class="about-modal-close" aria-label="Close">&times;</button>
                <div class="about-modal-body"><p>Error loading modal content.</p></div>
            </div>`;
    }

    document.body.appendChild(modalEl);

    // Close button
    const closeBtn = modalEl.querySelector('.about-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAboutModal);
    }

    // Click on backdrop
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeAboutModal();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) {
            closeAboutModal();
        }
    });
}

function ensureModal() {
    if (!buildPromise) {
        buildPromise = buildModal();
    }
    return buildPromise;
}

/** Opens the About modal and focuses the close button. */
export async function openAboutModal(e) {
    if (e) e.preventDefault();
    await ensureModal();
    modalEl.classList.remove('hidden');
    const closeBtn = modalEl.querySelector('.about-modal-close');
    if (closeBtn) closeBtn.focus();
}

/** Closes the About modal. */
export function closeAboutModal() {
    if (modalEl) modalEl.classList.add('hidden');
}

/** Initializes the About modal and wires footer/step-0 trigger links. */
export function initAboutModal() {
    ensureModal();

    // Footer link — replace its external href with the modal opener
    const footerAboutLink = document.querySelector('#main-footer .footer-right a[href*="collectionbuilder"]');
    if (footerAboutLink) {
        footerAboutLink.setAttribute('href', '#');
        footerAboutLink.removeAttribute('target');
        footerAboutLink.removeAttribute('rel');
        footerAboutLink.addEventListener('click', openAboutModal);
    }

    // Step-0 link
    const step0Link = document.getElementById('about-link-step0');
    if (step0Link) {
        step0Link.addEventListener('click', openAboutModal);
    }
}
