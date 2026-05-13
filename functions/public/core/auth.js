import { auth, db } from "./firebase-config.js";
import {
	onAuthStateChanged,
	FacebookAuthProvider,
	signInWithEmailAndPassword,
	signInWithPopup,
	signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	limit,
	query,
	where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const AUTH_STYLE_ID = "mkp-auth-gate-style";

function ensureAuthStyles() {
	if (document.getElementById(AUTH_STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = AUTH_STYLE_ID;
	style.textContent = `
		.mkp-auth-gate {
			position: fixed;
			inset: 0;
			z-index: 9999;
			display: grid;
			place-items: center;
			padding: 24px;
			background:
				radial-gradient(circle at 15% 15%, rgba(46, 125, 50, 0.2), transparent 35%),
				radial-gradient(circle at 85% 85%, rgba(46, 125, 50, 0.16), transparent 32%),
				linear-gradient(180deg, #eef7ee 0%, #e4f1e4 100%);
		}

		.mkp-auth-gate[hidden] {
			display: none !important;
		}

		.mkp-auth-card {
			width: min(460px, 100%);
			border-radius: 22px;
			border: 1px solid #cfe2cf;
			background: #ffffff;
			box-shadow: 0 20px 45px rgba(22, 41, 22, 0.14);
			padding: 24px;
		}

		.product {
			display: grid;
			gap: 14px;
			margin-bottom: 12px;
		}

		.logo-wrapper {
			display: flex;
			justify-content: center;
			padding: 6px 0;
		}

		.logo-wrapper img {
			width: min(340px, 100%);
			height: auto;
			display: block;
		}

		.description h3 {
			margin: 0;
			font-size: 28px;
			line-height: 1.15;
			color: #163316;
			letter-spacing: -0.02em;
			text-align: center;
		}

		.description p {
			margin: 8px 0 0;
			color: #4d604d;
			font-size: 14px;
			line-height: 1.5;
			text-align: center;
		}

		.mkp-auth-form {
			display: grid;
			gap: 12px;
			margin-top: 18px;
		}

		.mkp-auth-label {
			display: grid;
			gap: 6px;
			font-size: 13px;
			font-weight: 700;
			color: #234123;
		}

		.mkp-auth-input {
			width: 100%;
			min-height: 44px;
			border-radius: 12px;
			border: 1px solid #c8dcc8;
			padding: 10px 12px;
			font-size: 15px;
			color: #122912;
			background: #fdfefd;
		}

		.mkp-auth-input:focus {
			outline: none;
			border-color: #2e7d32;
			box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.2);
		}

		.mkp-auth-submit {
			min-height: 46px;
			border: none;
			border-radius: 12px;
			background: linear-gradient(135deg, #2e7d32 0%, #3f9b44 100%);
			color: #fff;
			font-size: 15px;
			font-weight: 800;
			cursor: pointer;
		}

		.mkp-auth-submit[disabled] {
			opacity: 0.7;
			cursor: not-allowed;
		}

		.mkp-auth-error {
			min-height: 20px;
			margin: 4px 0 0;
			color: #b42318;
			font-size: 13px;
			font-weight: 700;
		}

		.mkp-auth-divider {
			display: flex;
			align-items: center;
			gap: 12px;
			margin: 6px 0 2px;
			color: #8a9e8a;
			font-size: 12px;
			font-weight: 600;
		}

		.mkp-auth-divider::before,
		.mkp-auth-divider::after {
			content: "";
			flex: 1;
			height: 1px;
			background: #d5e5d5;
		}

		.mkp-auth-facebook {
			width: 100%;
			min-height: 46px;
			border: 1.5px solid #1877f2;
			border-radius: 12px;
			background: #fff;
			color: #1877f2;
			font-size: 15px;
			font-weight: 700;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 10px;
			transition: background 0.15s, color 0.15s;
		}

		.mkp-auth-facebook:hover:not([disabled]) {
			background: #1877f2;
			color: #fff;
		}

		.mkp-auth-facebook[disabled] {
			opacity: 0.7;
			cursor: not-allowed;
		}

		.mkp-logout-btn {
			position: fixed;
			top: 14px;
			right: 14px;
			z-index: 1100;
			min-height: 34px;
			border-radius: 999px;
			border: 1px solid #d9e4d9;
			background: rgba(255, 255, 255, 0.95);
			color: #1f5a23;
			font-size: 12px;
			font-weight: 800;
			padding: 7px 12px;
			box-shadow: 0 8px 18px rgba(16, 24, 16, 0.1);
			cursor: pointer;
		}

		.mkp-logout-btn[hidden] {
			display: none !important;
		}

		.mkp-demo-banner {
			position: fixed;
			right: 16px;
			bottom: 16px;
			z-index: 1095;
			width: min(360px, calc(100vw - 32px));
			border-radius: 20px;
			border: 1px solid #cfe2cf;
			background: linear-gradient(180deg, #ffffff 0%, #f4fbf4 100%);
			box-shadow: 0 20px 45px rgba(22, 41, 22, 0.14);
			padding: 16px;
		}

		.mkp-demo-banner[hidden] {
			display: none !important;
		}

		.mkp-demo-banner-badge {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			min-height: 28px;
			padding: 6px 10px;
			border-radius: 999px;
			background: #eaf6eb;
			border: 1px solid #cfe2cf;
			color: #1f5a23;
			font-size: 12px;
			font-weight: 800;
			margin-bottom: 10px;
		}

		.mkp-demo-banner-title {
			margin: 0 0 6px;
			font-size: 20px;
			line-height: 1.15;
			color: #163316;
		}

		.mkp-demo-banner-text {
			margin: 0;
			font-size: 14px;
			line-height: 1.55;
			color: #4d604d;
		}

		.mkp-demo-banner-meta {
			margin-top: 10px;
			font-size: 12px;
			font-weight: 700;
			color: #5c705d;
		}

		.mkp-demo-banner-actions {
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
			margin-top: 14px;
		}

		.mkp-demo-banner-link {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 40px;
			padding: 10px 14px;
			border-radius: 12px;
			background: linear-gradient(135deg, #2e7d32 0%, #3f9b44 100%);
			color: #fff;
			font-size: 13px;
			font-weight: 800;
			text-decoration: none;
		}

		.mkp-demo-banner-dismiss {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 40px;
			padding: 10px 14px;
			border-radius: 12px;
			border: 1px solid #d7e3d7;
			background: #fff;
			color: #2b412c;
			font-size: 13px;
			font-weight: 700;
			cursor: pointer;
		}
	`;

	document.head.appendChild(style);
}

function ensureAuthUi(appName = "Madkontrollen Pro") {
	ensureAuthStyles();

	let gate = document.getElementById("mkpAuthGate");
	let logoutBtn = document.getElementById("mkpLogoutBtn");

	if (!gate) {
		gate = document.createElement("div");
		gate.id = "mkpAuthGate";
		gate.className = "mkp-auth-gate";
		gate.hidden = true;
		gate.innerHTML = `
			<section class="mkp-auth-card" aria-label="Login">
				<div class="product">
					<div class="logo-wrapper">
						<img src="/images/logo.svg" alt="Madkontrollen Pro logo">
					</div>

					<div class="description">
						<h3>Velkommen til Madkontrollen Pro</h3>
						<p>Log ind for at håndtere din drift, egenkontrol og AI-bilag.</p>
					</div>
				</div>

				<form id="mkpLoginForm" class="mkp-auth-form">
					<label class="mkp-auth-label">
						Email
						<input id="mkpEmailInput" class="mkp-auth-input" type="email" autocomplete="email" required>
					</label>

					<label class="mkp-auth-label">
						Password
						<input id="mkpPasswordInput" class="mkp-auth-input" type="password" autocomplete="current-password" required>
					</label>

					<button id="mkpLoginSubmit" class="mkp-auth-submit" type="submit">Log ind</button>
				</form>

				<div class="mkp-auth-divider">eller</div>

				<button id="mkpFacebookLogin" class="mkp-auth-facebook" type="button">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
					Log ind med Facebook
				</button>

				<p id="mkpLoginError" class="mkp-auth-error" role="alert"></p>
			</section>
		`;
		document.body.appendChild(gate);
	}

	if (!logoutBtn) {
		logoutBtn = document.createElement("button");
		logoutBtn.id = "mkpLogoutBtn";
		logoutBtn.className = "mkp-logout-btn";
		logoutBtn.type = "button";
		logoutBtn.hidden = true;
		logoutBtn.textContent = "Log ud";
		document.body.appendChild(logoutBtn);
	}

	return { gate, logoutBtn };
}

function isDemoLocationId(value) {
	return String(value || "").trim().toLowerCase().includes("demo");
}

// Paths where onboarding gate should not trigger redirects
const ONBOARDING_GATE_BYPASS_PATHS = [
	"/onboarding",
	"/tak",
	"/debug-",
	"/create-company",
	"/create-location",
	"/admin/",
	"/modules/admin/",
	"/modules/egenkontrol/onboarding",
];

function shouldBypassOnboardingGate() {
	const path = (window.location.pathname || "").toLowerCase();
	return ONBOARDING_GATE_BYPASS_PATHS.some((prefix) => path.includes(prefix));
}

/**
 * Determines where a logged-in user should be redirected based on onboarding state.
 * Returns a path string to redirect to, or null if the user is ready.
 *
 * States:
 *   - no companyId                  → /modules/egenkontrol/onboarding.html
 *   - companyId but no locationIds  → /tak  (provisioning in progress)
 *   - companyId + locationIds       → null  (ready)
 *   - admin/superadmin role         → null  (bypass always)
 */
function resolveOnboardingRedirect(profile) {
	const role = String(profile.role || "employee").trim().toLowerCase();
	if (role === "superadmin" || role === "admin") return null;

	const companyId = String(profile.companyId || profile.organizationId || "").trim();
	const locationIds = normalizeProfileLocationIds(profile);

	if (!companyId) {
		return "/modules/egenkontrol/onboarding.html";
	}

	if (locationIds.length === 0) {
		return "/tak";
	}

	return null;
}

function normalizeProfileLocationIds(profile = {}) {
	const ids = [];
	const pushValue = (value) => {
		const normalized = String(value || "").trim();
		if (normalized) ids.push(normalized);
	};

	if (Array.isArray(profile.locationIds)) {
		profile.locationIds.forEach(pushValue);
	}

	pushValue(profile.primaryLocationId);
	pushValue(profile.locationId);

	const uniqueIds = [...new Set(ids)];
	const liveIds = uniqueIds.filter((item) => !isDemoLocationId(item));
	return liveIds.length ? liveIds : uniqueIds;
}

function getPreferredLocationId(profile = {}, locationIds = []) {
	const primaryLocationId = String(profile.primaryLocationId || profile.locationId || "").trim();
	if (primaryLocationId && locationIds.includes(primaryLocationId)) {
		return primaryLocationId;
	}

	const firstLiveLocationId = locationIds.find((item) => !isDemoLocationId(item));
	if (firstLiveLocationId) {
		return firstLiveLocationId;
	}

	return locationIds[0] || "";
}

function persistSessionScope(user, profile = {}) {
	try {
		const locationIds = normalizeProfileLocationIds(profile);
		const preferredLocationId = getPreferredLocationId(profile, locationIds);

		sessionStorage.setItem("mkp_user_uid", String(user?.uid || ""));
		sessionStorage.setItem("mkp_user_companyId", String(profile.companyId || "").trim());
		sessionStorage.setItem("mkp_user_locationIds", JSON.stringify(locationIds));
		sessionStorage.setItem("mkp_user_role", String(profile.role || "employee").trim().toLowerCase());
		if (preferredLocationId) {
			sessionStorage.setItem("mkp_selected_locationId", preferredLocationId);
		}
	} catch (error) {
		console.warn("Kunne ikke gemme user scope i sessionStorage:", error);
	}
}

function clearSessionScope() {
	try {
		sessionStorage.removeItem("mkp_user_uid");
		sessionStorage.removeItem("mkp_user_companyId");
		sessionStorage.removeItem("mkp_user_locationIds");
		sessionStorage.removeItem("mkp_user_role");
		sessionStorage.removeItem("mkp_selected_locationId");
	} catch (error) {
		console.warn("Kunne ikke rydde user scope i sessionStorage:", error);
	}
}

let demoBannerElements = null;
let demoBannerIntervalId = null;

function ensureDemoBanner() {
	if (demoBannerElements) return demoBannerElements;

	const wrapper = document.createElement("aside");
	wrapper.id = "mkpDemoBanner";
	wrapper.className = "mkp-demo-banner";
	wrapper.hidden = true;
	wrapper.innerHTML = `
		<div class="mkp-demo-banner-badge">Demo aktiv</div>
		<h3 id="mkpDemoBannerTitle" class="mkp-demo-banner-title">Din demo er klar</h3>
		<p id="mkpDemoBannerText" class="mkp-demo-banner-text"></p>
		<div id="mkpDemoBannerMeta" class="mkp-demo-banner-meta"></div>
		<div class="mkp-demo-banner-actions">
			<a id="mkpDemoBannerLink" class="mkp-demo-banner-link" href="/modules/egenkontrol/onboarding.html">Aktiver løsning</a>
			<button id="mkpDemoBannerDismiss" class="mkp-demo-banner-dismiss" type="button">Skjul</button>
		</div>
	`;

	document.body.appendChild(wrapper);

	const dismissBtn = wrapper.querySelector("#mkpDemoBannerDismiss");
	dismissBtn?.addEventListener("click", () => {
		wrapper.hidden = true;
	});

	demoBannerElements = {
		wrapper,
		titleEl: wrapper.querySelector("#mkpDemoBannerTitle"),
		textEl: wrapper.querySelector("#mkpDemoBannerText"),
		metaEl: wrapper.querySelector("#mkpDemoBannerMeta"),
		linkEl: wrapper.querySelector("#mkpDemoBannerLink")
	};

	return demoBannerElements;
}

function stopDemoBannerTimer() {
	if (demoBannerIntervalId) {
		window.clearInterval(demoBannerIntervalId);
		demoBannerIntervalId = null;
	}
}

function hideDemoBanner() {
	stopDemoBannerTimer();
	if (demoBannerElements?.wrapper) {
		demoBannerElements.wrapper.hidden = true;
	}
}

function parseDemoDateValue(value) {
	if (!value) return null;
	if (value instanceof Date) return value;
	if (typeof value?.toDate === "function") return value.toDate();
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDemoCountdownLabel(expiresAt) {
	if (!(expiresAt instanceof Date)) return "";
	const diffMs = expiresAt.getTime() - Date.now();
	if (diffMs <= 0) return "udløbet";
	const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
	if (totalMinutes >= 60) {
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return minutes > 0 ? `${hours} t ${minutes} min` : `${hours} t`;
	}
	return `${totalMinutes} min`;
}

function syncDemoBanner(profile = {}) {
	const companyId = String(profile.companyId || profile.organizationId || "").trim();
	const locationId = String(profile.primaryLocationId || profile.locationId || "").trim();
	const demoExpiresAt = parseDemoDateValue(profile.demoExpiresAt);
	const isDemoProfile = Boolean(
		profile.isDemo === true ||
		demoExpiresAt ||
		isDemoLocationId(locationId) ||
		String(companyId || "").toLowerCase().includes("demo")
	);

	if (!isDemoProfile) {
		hideDemoBanner();
		return;
	}

	const banner = ensureDemoBanner();
	const countdown = getDemoCountdownLabel(demoExpiresAt);
	const upgradeHref = companyId && locationId
		? `/modules/egenkontrol/onboarding.html?mode=convert-demo&companyId=${encodeURIComponent(companyId)}&locationId=${encodeURIComponent(locationId)}`
		: "/modules/egenkontrol/onboarding.html?mode=convert-demo";

	if (banner.titleEl) {
		banner.titleEl.textContent = "Demo aktiv";
	}
	if (banner.textEl) {
		banner.textEl.textContent = countdown && countdown !== "udløbet"
			? `Din demo er aktiv i ${countdown}. Du kan aktivere løsningen når som helst og beholde dine data.`
			: "Din demo er stadig åben for konvertering. Aktiver løsningen for at beholde dine data.";
	}
	if (banner.metaEl) {
		banner.metaEl.textContent = demoExpiresAt
			? `Udløber ${demoExpiresAt.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}`
			: "Demo-konto";
	}
	if (banner.linkEl) {
		banner.linkEl.href = upgradeHref;
	}

	banner.wrapper.hidden = false;

	stopDemoBannerTimer();
	if (demoExpiresAt) {
		demoBannerIntervalId = window.setInterval(() => {
			syncDemoBanner(profile);
		}, 30000);
	}
}

async function getUserRoleProfile(user) {
	const fallback = {
		role: "employee",
		displayName: user.displayName || user.email || user.uid,
		userId: user.uid,
		email: user.email || ""
	};

	try {
		const userDoc = await getDoc(doc(db, "users", user.uid));
		if (userDoc.exists()) {
			const data = userDoc.data() || {};
			const locationIds = normalizeProfileLocationIds(data);
			const preferredLocationId = getPreferredLocationId(data, locationIds);
			return {
				...fallback,
				...data,
				role: String(data.role || fallback.role).trim().toLowerCase(),
				locationIds,
				primaryLocationId: preferredLocationId || data.primaryLocationId || data.locationId || "",
				locationId: preferredLocationId || data.locationId || data.primaryLocationId || ""
			};
		}

		if (user.email) {
			const byEmailQuery = query(
				collection(db, "users"),
				where("email", "==", user.email),
				limit(1)
			);
			const byEmailSnap = await getDocs(byEmailQuery);
			if (!byEmailSnap.empty) {
				const data = byEmailSnap.docs[0].data() || {};
				const locationIds = normalizeProfileLocationIds(data);
				const preferredLocationId = getPreferredLocationId(data, locationIds);
				return {
					...fallback,
					...data,
					role: String(data.role || fallback.role).trim().toLowerCase(),
					locationIds,
					primaryLocationId: preferredLocationId || data.primaryLocationId || data.locationId || "",
					locationId: preferredLocationId || data.locationId || data.primaryLocationId || ""
				};
			}
		}
	} catch (error) {
		console.warn("Kunne ikke hente brugerrolle:", error);
	}

	return fallback;
}

export async function setupAuthGate(options = {}) {
	const {
		appName = "Madkontrollen Pro",
		onAuthenticated,
		onSignedOut
	} = options;

	const { gate, logoutBtn } = ensureAuthUi(appName);

	const form = document.getElementById("mkpLoginForm");
	const emailInput = document.getElementById("mkpEmailInput");
	const passwordInput = document.getElementById("mkpPasswordInput");
	const submitBtn = document.getElementById("mkpLoginSubmit");
	const errorEl = document.getElementById("mkpLoginError");

	if (logoutBtn && !logoutBtn.dataset.bound) {
		logoutBtn.dataset.bound = "true";
		logoutBtn.addEventListener("click", async () => {
			try {
				await signOut(auth);
				window.location.replace("/");
			} catch (error) {
				console.error("Kunne ikke logge ud:", error);
			}
		});
	}

	if (form && !form.dataset.bound) {
		form.dataset.bound = "true";
		form.addEventListener("submit", async (event) => {
			event.preventDefault();

			if (!emailInput || !passwordInput || !submitBtn || !errorEl) return;

			const email = emailInput.value.trim();
			const password = passwordInput.value;

			if (!email || !password) {
				errorEl.textContent = "Indtast både email og password.";
				return;
			}

			submitBtn.disabled = true;
			submitBtn.textContent = "Logger ind...";
			errorEl.textContent = "";

			try {
				const credential = await signInWithEmailAndPassword(auth, email, password);
				const user = credential.user;
				console.log("[login] sign in success", user.uid);

				submitBtn.textContent = "Indlæser profil...";
				console.log("[login] loading profile");

				const userSnap = await getDoc(doc(db, "users", user.uid));
				console.log("[login] user profile exists:", userSnap.exists());

				if (!userSnap.exists()) {
					errorEl.textContent = "Din brugerprofil mangler. Kontakt support.";
					console.log("[login] profile invalid", "missing user doc");
					submitBtn.disabled = false;
					submitBtn.textContent = "Log ind";
					return;
				}

				const profile = userSnap.data();
				console.log("[login] profile", profile);

				const orgId = profile.organizationId || profile.companyId;
				const locationId = profile.primaryLocationId || profile.locationId || 
					(Array.isArray(profile.locationIds) && profile.locationIds.length > 0 ? profile.locationIds[0] : null);

				if (!profile.role || !orgId || !locationId) {
					errorEl.textContent = "Din brugerprofil mangler rolle eller virksomhed. Kontakt support.";
					console.log("[login] profile invalid", {
						reason: "missing required fields",
						role: profile.role,
						orgId: orgId,
						locationId: locationId
					});
					submitBtn.disabled = false;
					submitBtn.textContent = "Log ind";
					return;
				}

				console.log("[login] redirecting /dashboard");
				submitBtn.textContent = "Åbner dashboard...";
				
				// Set flag to prevent onAuthStateChanged from also redirecting
				window.__loginRedirectInProgress = true;
				
				// Use assign for immediate redirect
				window.location.assign("/dashboard");
			} catch (error) {
				console.error("Login fejl:", error);
				errorEl.textContent = String(error?.message || "Login mislykkedes.");
				submitBtn.disabled = false;
				submitBtn.textContent = "Log ind";
			}
		});
	}

	const facebookBtn = document.getElementById("mkpFacebookLogin");
	if (facebookBtn && !facebookBtn.dataset.bound) {
		facebookBtn.dataset.bound = "true";
		facebookBtn.addEventListener("click", async () => {
			if (!errorEl) return;
			errorEl.textContent = "";
			facebookBtn.disabled = true;
			facebookBtn.textContent = "Venter på Facebook...";

			const provider = new FacebookAuthProvider();
			provider.addScope("email");

			try {
				await signInWithPopup(auth, provider);
				// onAuthStateChanged handles redirect/profile loading
			} catch (error) {
				console.error("Facebook login fejl:", error);
				const code = error?.code || "";
				let msg = "Facebook login mislykkedes. Prøv igen.";
				if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
					msg = "Login-vinduet blev lukket. Prøv igen.";
				} else if (code === "auth/unauthorized-domain") {
					msg = "Dette domæne er ikke godkendt til Facebook login. Kontakt support.";
				} else if (code === "auth/operation-not-allowed") {
					msg = "Facebook login er ikke aktiveret. Kontakt support.";
				} else if (code === "auth/account-exists-with-different-credential") {
					const existing = error?.customData?.email || "";
					console.warn("auth/account-exists-with-different-credential for:", existing);
					msg = "Der findes allerede en konto med denne email. Log ind med email og password i stedet.";
				}
				errorEl.textContent = msg;
			} finally {
				facebookBtn.disabled = false;
				facebookBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg> Log ind med Facebook`;
			}
		});
	}

	return onAuthStateChanged(auth, async (user) => {
		console.log("[auth] onAuthStateChanged triggered, user:", user?.uid);
		
		if (!user) {
			clearSessionScope();
			hideDemoBanner();
			console.log("[auth] No user - showing login gate");
			gate.hidden = false;
			if (logoutBtn) logoutBtn.hidden = true;
			if (typeof onSignedOut === "function") {
				await onSignedOut();
			}
			return;
		}

		// Wait for user profile to be loaded
		console.log("[auth] Fetching user profile for:", user.uid);
		const profile = await getUserRoleProfile(user);
		console.log("[auth] Profile loaded:", {
			role: profile?.role,
			companyId: profile?.companyId,
			organizationId: profile?.organizationId,
			locationIds: profile?.locationIds,
			primaryLocationId: profile?.primaryLocationId
		});

		// Validate profile has MINIMAL required fields
		// CRITICAL: If Firebase Auth user exists AND users/{uid} exists, accept the user
		// Do NOT require onboarding/owner fields - only log warnings
		const role = String(profile?.role || "employee").trim().toLowerCase();
		const hasCompanyId = Boolean(profile?.companyId || profile?.organizationId);
		const hasLocationId = Boolean(
			profile?.primaryLocationId || 
			profile?.locationId || 
			(Array.isArray(profile?.locationIds) && profile.locationIds.length > 0)
		);
		const hasActiveStatus = profile?.status ? profile.status === "active" : true; // Default to active if not set

		// Check if user has minimal access (company + location)
		const hasAccess = profile && hasCompanyId && hasLocationId;

		console.log("[auth] Profile validation:", {
			hasValidRole: Boolean(profile?.role),
			hasCompanyId,
			hasLocationId,
			hasActiveStatus,
			hasAccess,
			willProceed: true // Always proceed if Firebase Auth user exists
		});

		// Log warnings but DO NOT block login
		if (!hasCompanyId || !hasLocationId) {
			console.warn("[auth] Missing company/location, but NOT blocking login");
			console.warn("[auth] Profile data:", {
				companyId: profile?.companyId,
				organizationId: profile?.organizationId,
				locationId: profile?.locationId,
				primaryLocationId: profile?.primaryLocationId,
				locationIds: profile?.locationIds
			});
		}

		if (!hasActiveStatus) {
			console.warn("[auth] User status is not active, but NOT blocking login:", profile?.status);
		}

		// REMOVED: No more login gate redirect
		// If user is logged in via Firebase Auth and has users/{uid} doc, let them proceed
		// Onboarding gate will handle incomplete profiles if needed

		persistSessionScope(user, profile);
		syncDemoBanner(profile);

		// Onboarding gate: redirect users who haven't completed onboarding/provisioning
		// Employees bypass onboarding gate
		if (!shouldBypassOnboardingGate() && role !== "employee" && role !== "medarbejder") {
			const redirectTo = resolveOnboardingRedirect(profile);
			if (redirectTo) {
				console.info("[auth] Onboarding gate redirect → ", redirectTo, " (companyId:", profile.companyId, " locationIds:", profile.locationIds, ")");
				window.location.replace(redirectTo);
				return;
			}
		}

		gate.hidden = true;
		if (logoutBtn) logoutBtn.hidden = false;

		// If on index page and profile is valid, redirect to dashboard
		// But only if index.html login modal hasn't already started the redirect
		const currentPath = window.location.pathname;
		if ((currentPath === "/" || currentPath === "/index.html") && !onAuthenticated) {
			if (window.__loginRedirectInProgress) {
				console.log("[auth] Redirect already in progress from login modal");
				return;
			}
			console.log("[auth] Valid profile on index - redirecting to dashboard");
			window.location.replace("/dashboard");
			return;
		}

		console.log("[auth] Calling onAuthenticated callback");
		if (typeof onAuthenticated === "function") {
			await onAuthenticated({ user, profile });
		}
	});
}

export function showProfileErrorState(message, linkText = "Ret profil", linkHref = "/debug-profile.html") {
	const errorHtml = `
		<div style="max-width:600px;margin:100px auto;padding:40px;text-align:center;background:#fff3cd;border:2px solid #ffc107;border-radius:16px;">
			<h2 style="color:#856404;margin:0 0 16px;">⚠️ Profil-fejl</h2>
			<p style="color:#856404;font-size:16px;margin:0 0 24px;">${message}</p>
			<a href="${linkHref}" style="display:inline-block;padding:12px 24px;background:#ffc107;color:#000;text-decoration:none;border-radius:8px;font-weight:700;">${linkText}</a>
		</div>
	`;
	
	const mainContent = document.querySelector('main') || document.body;
	const errorContainer = document.createElement('div');
	errorContainer.id = 'mkp-profile-error';
	errorContainer.innerHTML = errorHtml;
	
	if (mainContent.firstChild) {
		mainContent.insertBefore(errorContainer, mainContent.firstChild);
	} else {
		mainContent.appendChild(errorContainer);
	}
	
	const existingContent = Array.from(mainContent.children).filter(el => el.id !== 'mkp-profile-error');
	existingContent.forEach(el => el.style.display = 'none');
}
