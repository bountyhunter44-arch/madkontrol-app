import { session } from '/core/session.js';
import { auth } from '/core/firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export function renderIdentityBlock(mountElement) {
    if (!mountElement) return;

    mountElement.innerHTML = `
        <div class="identity-block">
            <button class="identity-trigger" id="identityTrigger" aria-label="Åbn brugermenu">
                <div class="identity-avatar" id="identityAvatar"></div>
                <div class="identity-info">
                    <div class="identity-name" id="identityName">Ikke logget ind</div>
                    <div class="identity-context" id="identityContext"></div>
                </div>
                <svg class="identity-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>

            <div class="identity-menu" id="identityMenu" hidden>
                <a href="/profile.html" class="identity-menu-item">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M3 14C3 11.2386 5.23858 9 8 9C10.7614 9 13 11.2386 13 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span>Min profil</span>
                </a>
                <a href="/companies.html" class="identity-menu-item">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M5 6H11M5 9H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span>Virksomhed</span>
                </a>
                <button class="identity-menu-item" id="switchLocationBtn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 14C8 14 13 10 13 6C13 3.23858 10.7614 1 8 1C5.23858 1 3 3.23858 3 6C3 10 8 14 8 14Z" stroke="currentColor" stroke-width="1.5"/>
                        <circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                    <span>Skift lokation</span>
                </button>
                <div class="identity-menu-divider"></div>
                <button class="identity-menu-item identity-menu-item-danger" id="logoutBtn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6M11 11L14 8M14 8L11 5M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Log ud</span>
                </button>
            </div>
        </div>
    `;

    const trigger = mountElement.querySelector('#identityTrigger');
    const menu = mountElement.querySelector('#identityMenu');
    const avatar = mountElement.querySelector('#identityAvatar');
    const nameEl = mountElement.querySelector('#identityName');
    const contextEl = mountElement.querySelector('#identityContext');
    const logoutBtn = mountElement.querySelector('#logoutBtn');
    const switchLocationBtn = mountElement.querySelector('#switchLocationBtn');

    function getInitials(user) {
        if (!user) return '?';
        const name = user.displayName || user.email || '';
        const parts = name.split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase() || '?';
    }

    function updateIdentityBlock(data) {
        const { user, company, location } = data;

        if (!user) {
            avatar.innerHTML = '?';
            nameEl.textContent = 'Ikke logget ind';
            contextEl.textContent = '';
            return;
        }

        if (company?.logoUrl) {
            avatar.innerHTML = `<img src="${company.logoUrl}" alt="${company.name || 'Logo'}">`;
        } else if (user.photoURL) {
            avatar.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || 'Bruger'}">`;
        } else {
            avatar.textContent = getInitials(user);
        }

        nameEl.textContent = user.displayName || user.email || 'Bruger';

        const contextParts = [];
        if (company?.name) contextParts.push(company.name);
        if (location?.name) contextParts.push(location.name);
        contextEl.textContent = contextParts.join(' · ');
    }

    session.subscribe(updateIdentityBlock);
    updateIdentityBlock({
        user: session.user || session.authUser,
        company: session.company,
        location: session.location
    });

    trigger.addEventListener('click', () => {
        const isOpen = menu.hidden === false;
        menu.hidden = !isOpen;
        trigger.setAttribute('aria-expanded', !isOpen);
    });

    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !menu.contains(e.target)) {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.replace('/');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    switchLocationBtn.addEventListener('click', () => {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        window.location.href = '/locations.html';
    });
}

if (typeof window !== 'undefined') {
    const mount = document.getElementById('identityBlockMount');
    if (mount) {
        renderIdentityBlock(mount);
    }
}
