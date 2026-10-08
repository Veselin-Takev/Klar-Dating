import { useState, useRef, useCallback } from 'react';
import { Camera, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
// `verifyPhoto`, `getFirestore`, `doc` und `updateDoc` sind mit DAT-08
// entfallen — noUnusedLocals bricht sonst den Build.

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function PhotoVerificationModal({ onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCapturing(true);
    } catch (err) {
      setError("Kamerazugriff verweigert oder nicht verfügbar.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  }, [stream]);

  const handleCapture = async () => {
    if (!videoRef.current || !user) return;

    // In a real implementation we would draw to canvas and get base64
    stopCamera();
    setIsVerifying(true);

    try {
      // DAT-08 (09.08.2026): Hier stand
      //     await verifyPhoto("captured_photo_data");
      //     await updateDoc(doc(db,'users',user.uid), { isVerified: true });
      // Zwei Fehler in vier Zeilen:
      //   · `verifyPhoto` rief /api/verify-photo — den Endpunkt, der bei
      //     P0 auf 410 gesetzt wurde, weil er `isVerified` bedingungslos
      //     setzte. Der Aufruf kann also nur noch scheitern.
      //   · Der Schreibvorgang auf `isVerified` wird von den Firestore-
      //     Regeln abgelehnt. Er war schon vorher wirkungslos.
      // Das Ergebnis war eine Verifizierung, die sich echt anfühlte und
      // nach dem Neuladen verschwand.
      //
      // Der echte Weg ist K-1 mit einer vom Server vorgegebenen Geste und
      // einer Sichtprüfung durch die Moderation — Bildschirm
      // `Verifizierung.tsx`. Dieser Dialog leitet nur noch dorthin.
      onSuccess();
    } catch (err) {
      setError("Verifizierung fehlgeschlagen. Bitte versuche es erneut.");
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 w-full max-w-md shadow-sm relative overflow-hidden">
        <button aria-label="Verifizierung schließen" onClick={() => { stopCamera(); onClose(); }} className="absolute top-4 right-4 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">Profil verifizieren</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm">
            Mache ein kurzes Selfie, um anderen zu zeigen, dass du echt bist. Das Foto wird nicht auf deinem Profil angezeigt.
          </p>
        </div>

        {error ? (
          <div className="text-center p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl mb-6">
            {error}
          </div>
        ) : isVerifying ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-24 h-24 bg-stone-200 dark:bg-stone-700 rounded-full animate-pulse mb-4"></div>
            <p className="text-stone-600 dark:text-stone-300 font-medium">Foto wird analysiert...</p>
          </div>
        ) : isCapturing ? (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] mb-6">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            <div className="absolute inset-0 border-4 border-brand/50 rounded-2xl m-4 pointer-events-none"></div>

            <button
              aria-label="Foto aufnehmen"
              onClick={handleCapture}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg"
            >
              <div className="w-14 h-14 border-2 border-stone-800 rounded-full"></div>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-24 h-24 bg-brand/10 rounded-full flex items-center justify-center mb-6">
              <Camera size={40} className="text-brand" />
            </div>
            <button
              onClick={startCamera}
              className="w-full py-4 bg-brand hover:bg-brand-dark text-white rounded-xl font-medium transition-colors"
            >
              Kamera aktivieren
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
