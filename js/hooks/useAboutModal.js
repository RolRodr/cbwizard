/**
 * useAboutModal — Creates and manages the "About this Project" modal.
 *
 * Usage:
 *   import { initAboutModal, openAboutModal } from './hooks/useAboutModal.js';
 *   initAboutModal();                         // call once after DOMContentLoaded
 *   someLink.addEventListener('click', openAboutModal);
 */

let modalEl = null;

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
                     Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus arcu est, 
                     tempor eu interdum efficitur, fringilla non eros. Fusce molestie, mi vitae ullamcorper egestas, 
                     nunc risus malesuada elit, vestibulum dictum eros tortor nec lectus. Suspendisse convallis posuere lacus ac hendrerit. 
                     Aliquam quis ligula venenatis, rutrum nulla eu, efficitur purus. Mauris fringilla maximus mi, ultricies consectetur justo faucibus vel. 
                     Donec ultrices mauris vel convallis gravida. Praesent varius ullamcorper dui et finibus. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. 
                     Quisque sit amet sem laoreet eros hendrerit efficitur. Donec id molestie erat. 
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

/** Open the About modal */
export function openAboutModal(e) {
    if (e) e.preventDefault();
    if (!modalEl) buildModal();
    modalEl.classList.remove('hidden');
    modalEl.querySelector('.about-modal-close').focus();
}

/** Close the About modal */
export function closeAboutModal() {
    if (modalEl) modalEl.classList.add('hidden');
}

/**
 * Call once at startup.
 * Lazily builds the modal DOM and wires the footer "About this project" link.
 */
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
