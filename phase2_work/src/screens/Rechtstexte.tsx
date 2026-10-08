import { Link, useParams } from "react-router";
import { ArrowLeft, ShieldCheck, Scale, Building2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Rechtstexte: Datenschutzerklärung (DSGVO), AGB (§§ 312k, 356a BGB), Impressum (§ 5 DDG, DSA Art. 11/12)
// ═══════════════════════════════════════════════════════════════════════════

type TabKey = "datenschutz" | "agb" | "impressum";

export default function Rechtstexte() {
  const { art } = useParams<{ art?: string }>();
  const activeTab: TabKey = art === "agb" ? "agb" : art === "impressum" ? "impressum" : "datenschutz";

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink px-4 sm:px-6 py-8 mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted hover:text-ink text-sm font-medium mb-4 focus:outline-none focus:ring-2 focus:ring-brand rounded-lg p-1"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Zurück zur App
        </Link>
        <div className="flex flex-wrap gap-2 border-b border-line-ui pb-3 mb-6" role="tablist">
          <Link
            to="/rechtstexte/datenschutz"
            role="tab"
            aria-selected={activeTab === "datenschutz"}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "datenschutz"
                ? "bg-brand text-white shadow-sm"
                : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            Datenschutz (DSGVO)
          </Link>
          <Link
            to="/rechtstexte/agb"
            role="tab"
            aria-selected={activeTab === "agb"}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "agb"
                ? "bg-brand text-white shadow-sm"
                : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            <Scale size={16} aria-hidden="true" />
            AGB & Widerruf
          </Link>
          <Link
            to="/rechtstexte/impressum"
            role="tab"
            aria-selected={activeTab === "impressum"}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "impressum"
                ? "bg-brand text-white shadow-sm"
                : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            <Building2 size={16} aria-hidden="true" />
            Impressum (§ 5 DDG & DSA)
          </Link>
        </div>
      </header>

      <main>
        {activeTab === "datenschutz" && <DatenschutzContent />}
        {activeTab === "agb" && <AgbContent />}
        {activeTab === "impressum" && <ImpressumContent />}
      </main>
    </div>
  );
}

function DatenschutzContent() {
  return (
    <article className="space-y-6 text-sm leading-relaxed text-stone-800 dark:text-stone-200">
      <h1 className="text-2xl sm:text-3xl font-serif text-ink mb-2">Datenschutzerklärung</h1>
      <p className="text-xs text-muted">Stand: September 2026 | Version 2.4.0 (DSGVO-konform)</p>

      <section className="rounded-2xl border border-line-ui p-5 bg-card/40 space-y-3">
        <h2 className="text-base font-semibold text-ink">1. Verantwortliche Stelle (Art. 4 Nr. 7 DSGVO)</h2>
        <p>
          Verantwortlicher für die Datenverarbeitung auf dieser Plattform ist die:
          <br />
          <strong>Klar Technologies GmbH i.Gr.</strong>
          <br />
          Unter den Linden 21, 10117 Berlin, Deutschland
          <br />
          E-Mail: <a href="mailto:datenschutz@klar-app.de" className="text-brand underline">datenschutz@klar-app.de</a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-serif text-ink">2. Verarbeitungszwecke & Rechtsgrundlagen</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Bereitstellung des Dienstes & Verbindungsfindung:</strong> Zur Erstellung deines Kontos, Profils und
            Vermittlung von Kontakten (Art. 6 Abs. 1 lit. b DSGVO – Vertragserfüllung).
          </li>
          <li>
            <strong>Altersprüfung (Hard Age-Gate 18+):</strong> Gemäß Jugendschutzgesetz (JuSchG) und Digital Services
            Act (DSA Art. 28) prüfen wir dein Alter. Personen unter 18 Jahren ist die Nutzung untersagt (Art. 6 Abs. 1 lit. c DSGVO).
          </li>
          <li>
            <strong>Besondere Datenkategorien (Art. 9 DSGVO):</strong> Angaben zu sexueller Orientierung, Religion,
            Weltanschauung oder sensiblen Vorlieben werden ausschließlich mit deiner ausdrücklichen, jederzeit
            widerruflichen Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO verarbeitet.
          </li>
          <li>
            <strong>Sicherheit, Integrität & Moderation:</strong> Zur Betrugserkennung, Bot-Abwehr und Bearbeitung von
            Meldungen nach DSA Art. 16 (Art. 6 Abs. 1 lit. c und f DSGVO).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-serif text-ink">3. Deine Rechte als betroffene Person</h2>
        <p>Du hast jederzeit folgende gesetzliche Rechte gegenüber dem Verantwortlichen:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Recht auf Auskunft über deine verarbeiteten Daten (Art. 15 DSGVO).</li>
          <li>Recht auf Berichtigung unrichtiger Daten (Art. 16 DSGVO).</li>
          <li>
            Recht auf Löschung („Recht auf Vergessenwerden“, Art. 17 DSGVO) mit kaskadierender Bereinigung aus
            öffentlichen Profilen und Backups.
          </li>
          <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO).</li>
          <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO – Exportfunktion im Profil verfügbar).</li>
          <li>Recht auf Widerspruch gegen die Verarbeitung (Art. 21 DSGVO).</li>
          <li>
            Recht auf jederzeitigen Widerruf einer erteilten Einwilligung (Art. 7 Abs. 3 DSGVO) mit sofortiger
            Wirkung für die Zukunft.
          </li>
        </ul>
        <p className="mt-2">
          <strong>Beschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO):</strong>
          <br />
          Zuständig ist die Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59–61, 10555
          Berlin (oder jede andere Aufsichtsbehörde deines gewöhnlichen Aufenthaltsorts).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-serif text-ink">4. Auftragsverarbeiter & Datentransfers</h2>
        <p>
          Zur Bereitstellung der Applikation setzen wir zertifizierte Dienstleister im Rahmen strenger
          Auftragsverarbeitungsverträge (Art. 28 DSGVO) und mit EU-Standardvertragsklauseln (SCC) ein:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Google Cloud Ireland Ltd. / Firebase (Hosting, Firestore-Datenbank in Region Frankfurt, Cloud Storage).</li>
          <li>KI-Inferenz: Server-seitige EU-Verarbeitung über Google Gemini Inferenzpunkte ohne Modell-Training mit Nutzerdaten.</li>
        </ul>
      </section>
    </article>
  );
}

function AgbContent() {
  return (
    <article className="space-y-6 text-sm leading-relaxed text-stone-800 dark:text-stone-200">
      <h1 className="text-2xl sm:text-3xl font-serif text-ink mb-2">Allgemeine Geschäftsbedingungen (AGB)</h1>
      <p className="text-xs text-muted">Inklusive gesetzlicher Widerrufsbelehrung & Kündigungsbutton (§§ 312k, 356a BGB)</p>

      <section className="space-y-3">
        <h2 className="text-lg font-serif text-ink">§ 1 Geltungsbereich & Mindestalter</h2>
        <p>
          (1) Diese Bedingungen gelten für sämtliche Verträge und Nutzungshandlungen auf der Plattform Klar.
          <br />
          (2) Die Registrierung und Nutzung ist ausschließlich volljährigen Personen (vollendetes 18. Lebensjahr)
          gestattet. Wir führen eine verbindliche Altersverifikation durch.
        </p>
      </section>

      <section className="rounded-2xl border border-brand/30 bg-brand/5 p-5 space-y-3">
        <h2 className="text-base font-semibold text-ink">§ 2 Gesetzliche Widerrufsbelehrung (§ 356a BGB)</h2>
        <p>
          <strong>Widerrufsrecht:</strong> Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen
          Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.
        </p>
        <p>
          Um dein Widerrufsrecht auszuüben, kannst du uns mittels einer eindeutigen Erklärung (z. B. per E-Mail an{" "}
          <a href="mailto:support@klar-app.de" className="text-brand underline">support@klar-app.de</a> oder direkt
          über die Schaltfläche „Vertrag widerrufen“ im Profilbereich) über deinen Entschluss informieren.
        </p>
        <p>
          <strong>Folgen des Widerrufs:</strong> Im Falle eines wirksamen Widerrufs erstatten wir alle geleisteten
          Zahlungen unverzüglich und spätestens binnen 14 Tagen zurück.
        </p>
      </section>

      <section className="rounded-2xl border border-line-ui p-5 bg-card/40 space-y-3">
        <h2 className="text-base font-semibold text-ink">§ 3 Kündigungsbutton & Beendigung (§ 312k BGB)</h2>
        <p>
          (1) Kostenpflichtige Abonnements oder die dauerhafte Mitgliedschaft können jederzeit über die gesetzliche
          Kündigungsschaltfläche im Benutzerprofil („Vertrag kündigen“) mit sofortiger Wirkung oder zum Ende der
          jeweiligen Laufzeit beendet werden.
          <br />
          (2) Die Kündigungserklärung wird dir unmittelbar in Textform mit Eingangsbestätigung quittiert.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-serif text-ink">§ 4 Verhaltensregeln & DSA-Meldewege</h2>
        <p>
          (1) Belästigung, Hassrede, Betrugsversuche oder die Weitergabe nicht-einvernehmlicher Inhalte sind streng
          untersagt.
          <br />
          (2) Jeder Nutzer kann rechtswidrige oder anstößige Profile über das integrierte Meldesystem (DSA Art. 16)
          melden. Gegen verhängte Moderationsmaßnahmen steht das interne Beschwerdeverfahren nach DSA Art. 20 zur
          Verfügung.
        </p>
      </section>
    </article>
  );
}

function ImpressumContent() {
  return (
    <article className="space-y-6 text-sm leading-relaxed text-stone-800 dark:text-stone-200">
      <h1 className="text-2xl sm:text-3xl font-serif text-ink mb-2">Impressum</h1>
      <p className="text-xs text-muted">Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG) & DSA (EU) 2022/2065</p>

      <section className="rounded-2xl border border-line-ui p-5 bg-card/40 space-y-3">
        <h2 className="text-base font-semibold text-ink">Dienstanbieter</h2>
        <p>
          <strong>Klar Technologies GmbH i.Gr.</strong>
          <br />
          Unter den Linden 21
          <br />
          10117 Berlin, Deutschland
        </p>
        <p>
          <strong>Vertreten durch:</strong> Die Geschäftsführung
          <br />
          <strong>Registergericht:</strong> Amtsgericht Charlottenburg (Berlin)
          <br />
          <strong>Kontakt:</strong> <a href="mailto:kontakt@klar-app.de" className="text-brand underline">kontakt@klar-app.de</a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-serif text-ink">Zentrale Kontaktstelle nach dem Digital Services Act (DSA)</h2>
        <p>
          Gemäß Art. 11 und 12 des Digital Services Act erreichen Behörden der Mitgliedstaaten, die Europäische
          Kommission und der Europäische Ausschuss für digitale Dienste unsere zentrale elektronische Anlaufstelle unter:
          <br />
          <strong>E-Mail (Behörden):</strong> <a href="mailto:dsa-legal@klar-app.de" className="text-brand underline">dsa-legal@klar-app.de</a>
          <br />
          <strong>E-Mail (Nutzer):</strong> <a href="mailto:dsa-support@klar-app.de" className="text-brand underline">dsa-support@klar-app.de</a>
          <br />
          Verfügbare Sprachen: Deutsch, Englisch.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-serif text-ink">Jugendschutzbeauftragter (§ 7 JMStV)</h2>
        <p>
          Jugendschutzbeauftragter der Klar Technologies GmbH:
          <br />
          E-Mail: <a href="mailto:jugendschutz@klar-app.de" className="text-brand underline">jugendschutz@klar-app.de</a>
        </p>
      </section>
    </article>
  );
}
