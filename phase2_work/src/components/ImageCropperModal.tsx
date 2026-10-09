import { useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { getCroppedImg } from '../lib/cropImage';
import { X, Check } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropperModal({ imageSrc, onCropComplete, onCancel }: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const onCropCompleteHandler = useCallback((_croppedArea: Area, nextCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (croppedAreaPixels) {
      try {
        const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
        if (croppedBlob) {
          onCropComplete(croppedBlob);
        }
      } catch (e) {
        console.error("Failed to crop image", e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-stone-50 dark:bg-stone-900 rounded-3xl overflow-hidden w-full max-w-md h-[80vh] flex flex-col relative shadow-2xl">
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-800 z-10 bg-stone-50 dark:bg-stone-900">
          <button aria-label="Abbrechen" onClick={onCancel} className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300">
            <X size={20} />
          </button>
          <h3 className="font-medium text-stone-900 dark:text-stone-100">Foto anpassen</h3>
          <button aria-label="Foto speichern" onClick={handleSave} className="p-2 rounded-full bg-brand text-white hover:bg-brand/90 transition-colors">
            <Check size={20} />
          </button>
        </div>

        <div className="flex-1 relative w-full h-full bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={4 / 5}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
            cropShape="rect"
            showGrid={false}
          />
        </div>

        <div className="flex-shrink-0 p-6 z-10 bg-stone-50 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800">
          <label className="text-sm text-stone-600 dark:text-stone-300 mb-2 block text-center">Zoom</label>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-brand"
          />
        </div>
      </div>
    </div>
  );
}
