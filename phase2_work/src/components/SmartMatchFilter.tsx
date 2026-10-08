import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";

export const LIFE_GOALS = ["Familie gründen", "Karriere aufbauen", "Auswandern", "Finanzielle Freiheit", "Eigene Firma", "Haus im Grünen", "Weltreise"];
export const COMMUNICATION_STYLES = ["Direkt & Offen", "Tiefgründig", "Humorvoll", "Zuhörer", "Texter", "Telefonierer", "Expressiv"];

interface SmartMatchFilterProps {
  filterSharedHobbies: boolean;
  onFilterSharedHobbiesChange: (val: boolean) => void;
  filterSharedGoals: boolean;
  onFilterSharedGoalsChange: (val: boolean) => void;
  filterSharedCommunication: boolean;
  onFilterSharedCommunicationChange: (val: boolean) => void;
}

export function SmartMatchFilter({
  filterSharedHobbies,
  onFilterSharedHobbiesChange,
  filterSharedGoals,
  onFilterSharedGoalsChange,
  filterSharedCommunication,
  onFilterSharedCommunicationChange
}: SmartMatchFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm flex flex-col mb-4 relative z-40">
      <div className="flex items-center gap-2 mb-3">
        <Filter size={16} className="text-brand dark:text-brand-light" />
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">{t("dashboard.filterTitle")}</h3>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              className="peer appearance-none w-5 h-5 border-2 border-stone-300 dark:border-stone-600 rounded-md checked:bg-brand dark:checked:bg-brand-light checked:border-brand dark:checked:border-brand-light transition-all cursor-pointer"
              checked={filterSharedHobbies}
              onChange={(e) => onFilterSharedHobbiesChange(e.target.checked)}
            />
            <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors">{t("dashboard.filterHobbies")}</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              className="peer appearance-none w-5 h-5 border-2 border-stone-300 dark:border-stone-600 rounded-md checked:bg-brand dark:checked:bg-brand-light checked:border-brand dark:checked:border-brand-light transition-all cursor-pointer"
              checked={filterSharedGoals}
              onChange={(e) => onFilterSharedGoalsChange(e.target.checked)}
            />
            <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors">{t("dashboard.filterGoals")}</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              className="peer appearance-none w-5 h-5 border-2 border-stone-300 dark:border-stone-600 rounded-md checked:bg-brand dark:checked:bg-brand-light checked:border-brand dark:checked:border-brand-light transition-all cursor-pointer"
              checked={filterSharedCommunication}
              onChange={(e) => onFilterSharedCommunicationChange(e.target.checked)}
            />
            <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors">{t("dashboard.filterCommunication")}</span>
        </label>
      </div>
    </div>
  );
}
