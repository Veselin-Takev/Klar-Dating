import { klarStorage } from '../lib/userScopedStorage';
import { useState, useRef } from 'react';
import { FileText, Sparkles, Download, CheckCircle2 } from 'lucide-react';
import { askAICoach } from '../lib/api';
// 12.08.2026: `html2canvas` -> `html2canvas-pro`. Der urspruengliche
// Paketstand versteht die Farbfunktion `oklch()` nicht, die Tailwind v4
// durchgehend verwendet — jeder PDF-Export brach mit „Attempting to
// parse an unsupported color function oklch" ab. Der Fork kann sie.
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

type PDFResumeGeneratorProps = {
  userBio: string;
  userInterests: string[];
};

export function PDFResumeGenerator({ userBio, userInterests }: PDFResumeGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resumeData, setResumeData] = useState<{
    tagline: string;
    personalityTraits: string[];
    funFacts: string[];
    milestoneSummary?: string;
  } | null>(null);

  const resumeRef = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    setIsGenerating(true);
    setSuccess(false);

    try {
      // Fetch milestones
      const conversations = klarStorage.getItem('stats_conversations_started') || '0';
      const datesPlanned = klarStorage.getItem('stats_dates_planned') || '0';
      const verbindungen = klarStorage.getItem('stats_matches_collected') || '0';
      const optimized = klarStorage.getItem('stats_profile_optimized') || '0';

      const milestoneText = `
Milestones erreicht:
- Konversationen gestartet: ${conversations}
- Dates geplant: ${datesPlanned}
- Verbindungen gesammelt: ${verbindungen}
- Profil optimiert: ${optimized === '0' ? 'Nein' : 'Ja'}
`;

      // 1. Get AI content
      const prompt = `Erstelle einen Dating-Lebenslauf für mich.
Meine Bio: "${userBio}"
Meine Interessen: ${userInterests.join(', ')}
${milestoneText}

Bitte gib die Antwort im folgenden JSON-Format zurück (ohne Markdown Codeblöcke, nur reines JSON):
{
  "tagline": "Ein witziger, kurzer Spruch (max 60 Zeichen)",
  "personalityTraits": ["Eigenschaft 1 mit kurzem, witzigen Kommentar", "Eigenschaft 2...", "Eigenschaft 3..."],
  "funFacts": ["Ein lustiger Fakt basierend auf meinen Interessen", "Noch ein Fakt"],
  "milestoneSummary": "Ein kurzer, anerkennender Satz über meine App-Milestones"
}`;

      let aiResponse = "";
      try {
        aiResponse = await askAICoach(prompt);
      } catch (e) {
        console.warn("AI coach rate limit or error", e);
        // Let it fall through to use the fallback data
      }

      // Try to parse JSON from response
      let parsedData;
      try {
        if (!aiResponse) throw new Error("No AI response");
        const jsonStr = aiResponse.trim();
        parsedData = JSON.parse(jsonStr);
      } catch (e) {
        console.warn("Failed to parse AI response as JSON or AI failed", e);
        // Fallback data
        parsedData = {
          tagline: "Bereit für großartige Dates und gute Gespräche!",
          personalityTraits: ["Spontan und abenteuerlustig", "Kaffee-Experte", "Zuhörer"],
          funFacts: ["Kann besser kochen als tanzen", "Immer für einen Roadtrip zu haben"]
        };
      }

      setResumeData(parsedData);

      // Wait for React to render the hidden DOM element
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Generate PDF using html2canvas and jsPDF
      if (resumeRef.current) {
        const canvas = await html2canvas(resumeRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');

        // A4 size: 210 x 297 mm
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('Mein_Dating_Lebenslauf.pdf');

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }

    } catch (e) {
      console.warn("PDF generation error:", e);
      alert("Es gab einen Fehler bei der PDF Generierung.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mt-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2 mb-1">
            <FileText size={18} className="text-brand dark:text-brand-light" />
            Dating Resume
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 pr-4">
            Lass den KI-Coach aus deinem Profil und deinen Milestones einen stylischen PDF-Lebenslauf generieren – perfekt zum Teilen mit Freunden!
          </p>
        </div>
      </div>

      <button
        onClick={generatePDF}
        disabled={isGenerating}
        className="w-full py-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
            Generiere Resume...
          </>
        ) : success ? (
          <>
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">PDF gespeichert!</span>
          </>
        ) : (
          <>
            <Download size={18} />
            Dating Resume als PDF exportieren
          </>
        )}
      </button>

      {/* Hidden DOM element to be converted to PDF */}
      <div className="overflow-hidden h-0 w-0 absolute opacity-0 pointer-events-none -z-50">
        <div
          ref={resumeRef}
          className="bg-white p-12 text-stone-900 relative"
          style={{ width: '800px', minHeight: '1131px', boxSizing: 'border-box' }}
        >
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-bl-full"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-stone-100 rounded-tr-full"></div>

          <div className="relative z-10">
            <div className="text-center mb-12 mt-8">
              <h1 className="text-5xl font-serif font-bold text-stone-900 mb-4 tracking-tight">Mein Dating Lebenslauf</h1>
              {resumeData && (
                <p className="text-xl text-brand font-medium italic">"{resumeData.tagline}"</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-8 mb-12">
              <div className="col-span-1">
                <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 h-full">
                  <h2 className="text-lg font-bold text-stone-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={18} className="text-brand" />
                    Interessen
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {userInterests.map((interest, i) => (
                      <span key={i} className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-700 shadow-sm">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <div className="mb-10">
                  <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4 border-b-2 border-brand inline-block pb-1">Über Mich</h2>
                  <p className="text-lg text-stone-700 leading-relaxed">{userBio}</p>
                </div>
              </div>
            </div>

            {resumeData && (
              <div className="space-y-10">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-stone-900 mb-6 border-b-2 border-stone-200 pb-2">Warum du mich daten solltest</h2>
                  <ul className="space-y-4">
                    {resumeData.personalityTraits.map((trait, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 size={14} className="text-brand" />
                        </div>
                        <span className="text-lg text-stone-800">{trait}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-brand/5 rounded-2xl p-8 border border-brand/10">
                  <h2 className="text-xl font-bold text-brand mb-4 flex items-center gap-2">
                    <Sparkles size={20} />
                    Fun Facts
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-stone-700 text-lg">
                    {resumeData.funFacts.map((fact, i) => (
                      <li key={i}>{fact}</li>
                    ))}
                  </ul>
                </div>

                {resumeData.milestoneSummary && (
                  <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                    <h2 className="text-lg font-bold text-emerald-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 size={18} />
                      Klar App Status
                    </h2>
                    <p className="text-emerald-700">{resumeData.milestoneSummary}</p>
                  </div>
                )}
              </div>
            )}

            <div className="absolute bottom-12 right-12 text-right">
              <p className="text-stone-400 font-medium text-sm">Generiert mit Klar Dating App</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
