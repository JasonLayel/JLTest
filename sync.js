/* Cloud sync adapter (Firebase behind a small interface).
 * app.js only talks to window.CLOUD — if we ever swap backends, this file
 * is the only thing that changes.
 *
 * Data model: one private document per user at kingdoms/{uid}:
 *   { state: "<full app state as JSON>", modifiedAt: "<ISO timestamp>" }
 * Conflict strategy is last-write-wins on modifiedAt (fine for one person
 * on two devices; documented limitation for simultaneous offline edits).
 */
window.CLOUD = (() => {
  "use strict";

  const CONFIG = {
    apiKey: "AIzaSyCS2bIE2PxH-FAcRKBeqL2iUCc90oxhNFA",
    authDomain: "petulent-princess-productivity.firebaseapp.com",
    projectId: "petulent-princess-productivity",
    storageBucket: "petulent-princess-productivity.firebasestorage.app",
    messagingSenderId: "517259291038",
    appId: "1:517259291038:web:4c2d171c2301c5dad68e8f",
  };

  let auth = null;
  let db = null;
  let user = null;
  let unsubDoc = null;
  const userListeners = [];
  const remoteListeners = [];

  // The SDK files are committed to lib/, but stay defensive: if they somehow
  // didn't load (or init throws), the app runs local-only with sync hidden.
  function available() {
    return typeof firebase !== "undefined" && !!firebase.firestore;
  }

  function init() {
    if (!available()) return false;
    try {
      firebase.initializeApp(CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      // Local cache so reads/writes work offline and sync on reconnect.
      db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      auth.onAuthStateChanged((u) => {
        user = u;
        watchDoc();
        userListeners.forEach((f) => f(u));
      });
      // Completes a signInWithRedirect round-trip (mobile fallback).
      auth.getRedirectResult().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function docRef() {
    return db.collection("kingdoms").doc(user.uid);
  }

  function watchDoc() {
    if (unsubDoc) {
      unsubDoc();
      unsubDoc = null;
    }
    if (!user) return;
    unsubDoc = docRef().onSnapshot(
      (snap) => {
        if (snap.exists) remoteListeners.forEach((f) => f(snap.data()));
      },
      () => {} /* permission/network hiccups: stay quiet, retry on next write */
    );
  }

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      // Some mobile browsers block popups — fall back to a full redirect.
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
        await auth.signInWithRedirect(provider);
      } else if (e && e.code === "auth/popup-closed-by-user") {
        /* user changed their mind — not an error */
      } else {
        throw e;
      }
    }
  }

  function signOut() {
    return auth.signOut();
  }

  async function push(stateJson, modifiedAt) {
    if (!user) return;
    await docRef().set({ state: stateJson, modifiedAt });
  }

  async function pull() {
    if (!user) return null;
    const snap = await docRef().get();
    return snap.exists ? snap.data() : null;
  }

  return {
    init,
    available,
    signIn,
    signOut,
    push,
    pull,
    user: () => user,
    onUser: (f) => userListeners.push(f),
    onRemote: (f) => remoteListeners.push(f),
  };
})();
