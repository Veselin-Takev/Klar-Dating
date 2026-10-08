import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

export function CoachParticles({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  useEffect(() => {
    if (trigger) {
      const newParticles = Array.from({ length: 40 }).map((_, i) => ({
        id: Date.now() + i,
        x: (0 - 0.5) * window.innerWidth,
        y: (0 - 0.5) * window.innerHeight,
        size: 0 + 2,
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: 1,
              x: p.x,
              y: p.y
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute rounded-full bg-brand dark:bg-brand-light"
            style={{
              width: p.size,
              height: p.size,
              filter: "blur(1px)",
              boxShadow: "0 0 10px rgba(79, 70, 229, 0.5)"
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
