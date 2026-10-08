import { Wrench } from 'lucide-react';
import { motion } from 'motion/react';

interface MaintenanceModeProps {
  message?: string;
  estimatedCompletion?: string;
}

export function MaintenanceMode({
  message = "Wir führen gerade wichtige Wartungsarbeiten durch, um Klar für dich zu verbessern.",
  estimatedCompletion
}: MaintenanceModeProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 p-6 text-center" role="alert" aria-live="polite">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full flex flex-col items-center"
      >
        <div className="w-16 h-16 bg-stone-200 dark:bg-stone-800 rounded-full flex items-center justify-center mb-6">
          <Wrench className="w-8 h-8 text-stone-500 dark:text-stone-400" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold mb-4 font-serif">Klar macht eine kurze Pause</h1>
        <p className="text-stone-600 dark:text-stone-400 mb-8 leading-relaxed">
          {message}
        </p>

        {estimatedCompletion && (
          <div className="bg-stone-100 dark:bg-stone-800 rounded-2xl px-6 py-4 w-full">
            <span className="text-sm text-stone-500 dark:text-stone-400 block mb-1">Voraussichtlich wieder verfügbar um:</span>
            <span className="font-medium text-stone-900 dark:text-stone-100">{estimatedCompletion}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
