import React from 'react';
import { History, Heart, CheckCircle2, Download } from 'lucide-react';
import jsPDF from 'jspdf';

const checkins = [
  {
    date: 'Heute',
    feeling: 'Ich war sehr entspannt und wir haben viel gelacht.',
    needs: 'Ja, definitiv. Er war sehr aufmerksam.',
    score: 90
  },
  {
    date: 'Vor 3 Tagen',
    feeling: 'Etwas angespannt, das Gespräch lief schleppend.',
    needs: 'Nicht ganz, es blieb eher oberflächlich.',
    score: 40
  },
  {
    date: 'Letzte Woche',
    feeling: 'Super Date! Die Zeit verging wie im Flug.',
    needs: 'Absolut, wir teilen viele Interessen.',
    score: 95
  }
];

export const CheckinTimelineWidget: React.FC = () => {
  const downloadJournal = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Klar - Dating Journal", 20, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Deine anonymisierten Reflexionen", 20, 30);

    let yPos = 45;

    checkins.forEach((checkin) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.text(checkin.date, 20, yPos);
      yPos += 7;

      doc.setFont("helvetica", "italic");
      doc.text("Gefühl:", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(checkin.feeling, 40, yPos);
      yPos += 7;

      doc.setFont("helvetica", "italic");
      doc.text("Erwartungen:", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(checkin.needs, 45, yPos);
      yPos += 15;
    });

    doc.save("klar-dating-journal.pdf");
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm relative">
      <div className="flex items-center gap-2 mb-6">
        <History className="text-brand dark:text-brand-light" size={20} />
        <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Deine Reflexions-Reise</h3>
      </div>
      <button
        onClick={downloadJournal}
        className="absolute top-5 right-5 p-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        title="Journal als PDF herunterladen"
      >
        <Download size={16} />
      </button>

      <div className="relative pl-3 border-l-2 border-stone-100 dark:border-stone-700 space-y-6">
        {checkins.map((checkin, idx) => (
          <div key={idx} className="relative">
            {/* Timeline dot */}
            <div className={`absolute -left-[1.1rem] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-stone-900 ${
              checkin.score >= 80 ? 'bg-emerald-500' : checkin.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
            }`}></div>

            <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4 border border-stone-100 dark:border-stone-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2 block">
                {checkin.date}
              </span>

              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1">
                    <Heart size={12} className="text-rose-500" /> Gefühl
                  </h4>
                  <p className="text-sm text-stone-600 dark:text-stone-400 italic">"{checkin.feeling}"</p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" /> Erwartungen
                  </h4>
                  <p className="text-sm text-stone-600 dark:text-stone-400 italic">"{checkin.needs}"</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
