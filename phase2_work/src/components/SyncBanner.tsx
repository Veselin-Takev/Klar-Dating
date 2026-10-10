import React, { useEffect, useState } from "react";
import { flushOfflineQueue } from "../lib/offlineQueue";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export const SyncBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [deadLettered, setDeadLettered] = useState<number>(0);
  const [syncError, setSyncError] = useState<boolean>(false);

  useEffect(() => {
    let disposed = false;
    let active: { uid: string; controller: AbortController } | null = null;
    const syncForUser = async (user: typeof auth.currentUser) => {
      if (!user || disposed) return;
      // Auth listener and initial online event may fire together. Never
      // concurrently replay the same queue, and cancel old-account work.
      if (active?.uid === user.uid) return;
      active?.controller.abort();
      const controller = new AbortController();
      const running = { uid: user.uid, controller };
      active = running;
      const isCurrent = () => !disposed && !controller.signal.aborted && auth.currentUser?.uid === user.uid;
      setIsSyncing(true);
      setSyncError(false);
      try {
        const token = await user.getIdToken();
        if (!isCurrent()) return;
        const result = await flushOfflineQueue({
          ownerUid: user.uid,
          token,
          signal: controller.signal,
          isCurrentUser: isCurrent,
        });
        if (isCurrent()) setDeadLettered(result.deadLettered);
      } catch {
        // An IDB rejection, expired token or network failure must not become
        // an unhandled promise rejection in an event listener.
        if (isCurrent()) setSyncError(true);
      } finally {
        if (active === running) {
          active = null;
          if (!disposed) setIsSyncing(false);
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      void syncForUser(auth.currentUser);
    };

    const handleOffline = () => {
      setIsOnline(false);
      active?.controller.abort();
    };

    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      if (active && active.uid !== user?.uid) {
        active.controller.abort();
        active = null;
        if (!disposed) setIsSyncing(false);
      }
      if (!user) {
        setDeadLettered(0);
        setSyncError(false);
      } else if (navigator.onLine) {
        void syncForUser(user);
      }
    });
    // The auth listener initiates the first sync. Avoid a duplicate kick-off.
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      disposed = true;
      active?.controller.abort();
      unsubscribeAuth();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !isSyncing && deadLettered === 0 && !syncError) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg sm:left-auto sm:right-4 sm:w-80 ${
        !isOnline ? "bg-amber-600 text-white" : "bg-neutral-800 text-neutral-200 border border-neutral-700"
      }`}
    >
      <span>
        {!isOnline ? "Offline: Aktionen werden zwischengespeichert." : isSyncing ? "Verbindung wiederhergestellt. Synchronisiere..." : syncError ? "Offline-Synchronisierung fehlgeschlagen. Bitte erneut verbinden." : `${deadLettered} Offline-Nachricht${deadLettered === 1 ? "" : "en"} konnte nicht automatisch gesendet werden. Bitte erneut senden.`}
      </span>
      {isSyncing && <span className="animate-spin text-sm">⟳</span>}
    </div>
  );
};
