import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { DiditVerification } from "../components/DiditVerification";

export default function Verifizierung() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="p-6 h-full overflow-y-auto pb-24">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-stone-600 dark:text-stone-300 mb-6 min-h-11">
        <ArrowLeft size={20} aria-hidden="true" />
        <span className="text-sm font-medium">{t("kyc.back")}</span>
      </button>
      <h1 className="text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2">{t("kyc.screenTitle")}</h1>
      <p className="text-base text-stone-600 dark:text-stone-300 mb-8">{t("kyc.screenIntro")}</p>
      <DiditVerification />
    </div>
  );
}
