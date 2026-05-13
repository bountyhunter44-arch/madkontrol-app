import { auth, db } from "/core/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

class SessionManager {
    constructor() {
        this.user = null;
        this.company = null;
        this.location = null;
        this.role = null;
        this.listeners = [];
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notify() {
        this.listeners.forEach(cb => cb({
            user: this.user,
            company: this.company,
            location: this.location,
            role: this.role
        }));
    }

    async loadUserData(authUser) {
        if (!authUser) {
            this.user = null;
            this.company = null;
            this.location = null;
            this.role = null;
            this.notify();
            return;
        }

        this.user = {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            photoURL: authUser.photoURL
        };

        try {
            const userDoc = await getDoc(doc(db, "users", authUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.user = { ...this.user, ...userData };
                this.role = userData.role || null;

                if (userData.companyId) {
                    const companyDoc = await getDoc(doc(db, "companies", userData.companyId));
                    if (companyDoc.exists()) {
                        this.company = { id: companyDoc.id, ...companyDoc.data() };
                    }
                }

                const savedLocationId = localStorage.getItem("selectedLocationId");
                if (savedLocationId) {
                    const locationDoc = await getDoc(doc(db, "locations", savedLocationId));
                    if (locationDoc.exists()) {
                        this.location = { id: locationDoc.id, ...locationDoc.data() };
                    }
                } else if (userData.companyId) {
                    const locationsQuery = query(
                        collection(db, "locations"),
                        where("companyId", "==", userData.companyId),
                        limit(1)
                    );
                    const locationsSnap = await getDocs(locationsQuery);
                    if (!locationsSnap.empty) {
                        const firstLocation = locationsSnap.docs[0];
                        this.location = { id: firstLocation.id, ...firstLocation.data() };
                        localStorage.setItem("selectedLocationId", firstLocation.id);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading user data:", error);
        }

        this.notify();
    }

    async setLocation(locationId) {
        try {
            const locationDoc = await getDoc(doc(db, "locations", locationId));
            if (locationDoc.exists()) {
                this.location = { id: locationDoc.id, ...locationDoc.data() };
                localStorage.setItem("selectedLocationId", locationId);
                this.notify();
            }
        } catch (error) {
            console.error("Error setting location:", error);
        }
    }

    getInitials() {
        if (!this.user) return "?";
        if (this.user.displayName) {
            const parts = this.user.displayName.trim().split(/\s+/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return parts[0][0].toUpperCase();
        }
        if (this.user.email) {
            return this.user.email[0].toUpperCase();
        }
        return "?";
    }
}

export const session = new SessionManager();

onAuthStateChanged(auth, (authUser) => {
    session.loadUserData(authUser);
});
