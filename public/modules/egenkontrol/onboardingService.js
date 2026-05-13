import app, { auth } from "/core/firebase-config.js";
import {
    getFunctions,
    httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const functions = getFunctions(app, "us-central1");
const createCheckoutSession = httpsCallable(functions, "createOnboardingCheckoutSession");

export async function saveOnboardingAndStartCheckout(payload) {
    try {
        console.log("[onboardingService] START CHECKOUT FLOW");
        console.log("[onboardingService] payload keys:", Object.keys(payload));

        // Clear old session data to prevent conflicts with new onboarding
        console.log("[onboardingService] clearing old session data...");
        try {
            sessionStorage.removeItem("mkp_user_uid");
            sessionStorage.removeItem("mkp_user_companyId");
            sessionStorage.removeItem("mkp_user_locationIds");
            sessionStorage.removeItem("mkp_selected_locationId");
            sessionStorage.removeItem("mkp_latest_onboarding_snapshotId");
        } catch (e) {
            console.warn("[onboardingService] could not clear sessionStorage:", e);
        }

        // Build backend payload with FULL onboarding data
        // Backend will save this to onboarding_checkout_drafts
        const backendPayload = {
            profile: {
                ...payload.profile,
                accountPassword: payload.company?.accountPassword || "",
                // Include additional onboarding data for backend to save
                cloudinaryAssets: payload.sections ? extractCloudinaryAssetsFromSections(payload.sections, payload.checks) : []
            },
            billingPlan: payload.billingPlan || "monthly",
            companyId: payload.companyId,
            locationId: payload.locationId,
            // Include full onboarding data for backend to save
            company: payload.company,
            business: payload.business,
            equipment: payload.equipment,
            sections: payload.sections,
            checks: payload.checks,
            price: payload.price,
            checkoutSummary: payload.checkoutSummary,
            // URLs
            origin: window.location.origin,
            successPath: "/tak?checkout=success&session_id={CHECKOUT_SESSION_ID}",
            cancelPath: "/modules/egenkontrol/onboarding.html?checkout=cancel"
        };

        console.log("[onboardingService] backend payload built");
        console.log("[onboardingService] calling createOnboardingCheckoutSession...");

        const result = await createCheckoutSession(backendPayload);

        console.log("[onboardingService] createCheckoutSession result:", result?.data ? "SUCCESS" : "FAILED");

        const url = result?.data?.url;

        if (!url) {
            throw new Error("Ingen checkout URL returneret fra createOnboardingCheckoutSession");
        }

        console.log("[onboardingService] checkout URL received, redirecting to Stripe...");
        
        // Only sign out AFTER successful checkout session creation
        // This prevents auth issues if checkout creation fails
        if (auth.currentUser) {
            console.log("[onboardingService] signing out current user before redirect...");
            try {
                await signOut(auth);
            } catch (e) {
                console.warn("[onboardingService] could not sign out:", e);
            }
        }

        console.log("[onboardingService] redirecting to:", url);
        window.location.href = url;
    } catch (error) {
        console.error("[onboardingService] CHECKOUT FAILED:", error);
        console.error("[onboardingService] error code:", error?.code);
        console.error("[onboardingService] error message:", error?.message);
        throw error;
    }
}

// Helper to extract Cloudinary assets from sections and checks
function extractCloudinaryAssetsFromSections(sections, checks) {
    const assets = [];
    
    if (sections) {
        Object.values(sections).forEach(section => {
            if (section.images && Array.isArray(section.images)) {
                assets.push(...section.images);
            }
        });
    }
    
    if (checks) {
        Object.values(checks).forEach(check => {
            if (check.images && Array.isArray(check.images)) {
                assets.push(...check.images);
            }
        });
    }
    
    return assets;
}