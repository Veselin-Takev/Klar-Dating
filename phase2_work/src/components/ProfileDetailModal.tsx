import { useEffect, useRef } from 'react';
import { X, MapPin, Briefcase, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ProfileDetailModal({ profile, onClose }: { profile: unknown, onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!profile) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-stone-800 w-full sm:max-w-md sm:rounded-[24px] rounded-t-[24px] max-h-[90vh] overflow-y-auto"
        >
          <div className="relative">
            <img
              src={profile.photos?.[0] || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=60'}
              alt={profile.name}
              className="w-full aspect-[4/5] object-cover"
            />
            <button
              aria-label="Schließen"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-stone-900/80 p-6 pt-20">
              <h2 className="text-3xl font-serif text-white">
                {profile.name}, {profile.age || 28}
              </h2>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300 text-sm">
                <MapPin size={16} /> <span>{profile.city || 'Berlin'}</span>
              </div>
              {profile.job && (
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300 text-sm">
                  <Briefcase size={16} /> <span>{profile.job}</span>
                </div>
              )}
              {profile.education && (
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300 text-sm">
                  <GraduationCap size={16} /> <span>{profile.education}</span>
                </div>
              )}
            </div>

            {profile.bio && (
              <div>
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider mb-2">Über mich</h3>
                <p className="text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}

            {profile.interests && profile.interests.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider mb-2">Interessen</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest: string) => (
                    <span key={interest} className="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-sm">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4">
              <button onClick={onClose} className="w-full py-3 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white rounded-full font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">
                Schließen
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
