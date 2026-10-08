import { klarStorage } from '../lib/userScopedStorage';
import { useEffect, useState } from 'react';
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from './firebase';

export function useFirestoreSyncTime(): Date | null {
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    const saved = klarStorage.getItem('klar_last_firestore_sync');
    return saved ? new Date(parseInt(saved, 10)) : null;
  });

  useEffect(() => {
    const unsubscribe = onSnapshotsInSync(db, () => {
      if (navigator.onLine) {
        const now = new Date();
        setLastSync(now);
        klarStorage.setItem('klar_last_firestore_sync', now.getTime().toString());
      }
    });
    return () => unsubscribe();
  }, []);

  return lastSync;
}
