import React, { useEffect, useState } from "react";
import { flushOfflineQueue } from "../lib/offlineQueue";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export const SyncBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [deadLettered, setDeadLettered] = useState<number>(0);

  useEffect(() => {
    let disposed = false;
    const syncForUser = async (user: typeof auth.currentUser) => {
      if (!user || disposed) return;
      setIsSyncing(true);
      try {
        const token = await user.getIdToken();
        if (!disposed && auth.currentUser?.uid === user.uid) {
          const result = await flushOfflineQueue({ ownerUid: user.uid, token });
          if (!disposed) setDeadLettered(result.deadLettered);
        }
      } finally {
        if (!disposed) setIsSyncing(false);
      }
    };

    const handleOnline = async () => {
      setIsOnline(true);
      await syncForUser(auth.currentUser);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      if (user && navigator.onLine) void syncForUser(user);
    });
    if (navigator.onLine && auth.currentUser) void syncForUser(auth.currentUser);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      disposed = true;
      unsubscribeAuth();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !isSyncing && deadLettered === 0) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg sm:left-auto sm:right-4 sm:w-80 ${
        !isOnline ? "bg-amber-600 text-white" : "bg-neutral-800 text-neutral-200 border border-neutral-700"
      }`}
    >
      <span>
        {!isOnline ? "Offline: Aktionen werden zwischengespeichert." : isSyncing ? "Verbindung wiederhergestellt. Synchronisiere..." : `${deadLettered} Offline-Nachricht${deadLettered === 1 ? "" : "en"} konnte nicht automatisch gesendet werden. Bitte erneut senden.`}
      </span>
      {isSyncing && <span className="animate-spin text-sm">⟳</span>}
    </div>
  );
};
