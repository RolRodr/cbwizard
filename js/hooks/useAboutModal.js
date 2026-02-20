/**
 * useAboutModal — Creates and manages the "About this Project" modal.
 *
 * Usage:
 *   import { initAboutModal, openAboutModal } from './hooks/useAboutModal.js';
 *   initAboutModal();                         // call once after DOMContentLoaded
 *   someLink.addEventListener('click', openAboutModal);
 */

let modalEl = null;

/** Creates the modal DOM element and wires close/backdrop/escape listeners. */
function buildModal() {
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'about-modal';
    modalEl.classList.add('about-modal-overlay', 'hidden');
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'about-modal-title');

    modalEl.innerHTML = `
        <div class="about-modal-content">
            <button class="about-modal-close" aria-label="Close">&times;</button>
            <h2 id="about-modal-title">About this Project</h2>
            <div class="about-modal-body">
                <p>
                    CollectionBuilder Wizard is a small project created by Rolando Rodriguez, Humanities Data Librarian
                    at the University of North Carolina at Chapel Hill as a personal passionate project. Having used and taught
                    CollectionBuilder for the last handful of years, Rolando found that digital humanists struggled with 
                    the technical curve when they wanted to set up a digital exhibit quickly. In repsonse, he created this
                    project to allow more digital humanists to get an guided start to using CollectionBuilder.
                </p>
                <p>
                Some things to note about this project: It is written in HTML, CSS, and vanilla Javascript. It is open-source and
                hosted via GitHub Pages. All data is stored via LocalStorage or IndexedDB on the client's browser. 
                <a href="https://github.com/RolRodr/cbwizard" target="_blank">Click here to visit the repository</a>.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);

    // Close button
    modalEl.querySelector('.about-modal-close')
        .addEventListener('click', closeAboutModal);

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

/** Opens the About modal and focuses the close button. */
export function openAboutModal(e) {
    if (e) e.preventDefault();
    if (!modalEl) buildModal();
    modalEl.classList.remove('hidden');
    modalEl.querySelector('.about-modal-close').focus();
}

/** Closes the About modal. */
export function closeAboutModal() {
    if (modalEl) modalEl.classList.add('hidden');
}

/** Initializes the About modal and wires footer/step-0 trigger links. */
export function initAboutModal() {
    buildModal();

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
