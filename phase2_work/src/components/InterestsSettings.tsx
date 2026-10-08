
const AVAILABLE_INTERESTS = ['Vegan', 'Oktoberfest', 'Kochen', 'Sport', 'Kultur', 'Reisen'] as const;

interface InterestsSettingsProps {
  selectedInterests: string[];
  onChange: (interests: string[]) => void;
}

export function InterestsSettings({ selectedInterests, onChange }: InterestsSettingsProps) {
  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      onChange(selectedInterests.filter(i => i !== interest));
    } else {
      onChange([...selectedInterests, interest]);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800">Interessen & Präferenzen</h3>
      <p className="text-sm text-gray-500">Wähle deine Interessen aus, um passende Kontakte und saisonale Highlights zu finden.</p>
      
      <div className="flex flex-wrap gap-2 pt-2">
        {AVAILABLE_INTERESTS.map(interest => {
          const isSelected = selectedInterests.includes(interest);
          return (
            <button
              key={interest}
              type="button"
              onClick={() => toggleInterest(interest)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isSelected 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {interest === 'Oktoberfest' ? '🥨 Oktoberfest' : interest === 'Vegan' ? '🌱 Vegan' : interest}
            </button>
          );
        })}
      </div>
    </div>
  );
}
