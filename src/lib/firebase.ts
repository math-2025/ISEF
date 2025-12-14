// This file is no longer used for direct db export.
// It can be removed or kept for other utility functions if needed.
// For now, we will leave it empty to prevent any further errors.
// All Firestore access should go through the `useFirebase` hook.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// The db export is removed to prevent direct server-side usage.
// const db = getFirestore(app);

export { app };
