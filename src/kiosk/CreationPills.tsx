import type { Creation } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  creations: Creation[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function CreationPills({ creations, activeId, onSelect }: Props) {
  const { t } = useLanguage();

  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-black">
      {creations.map(creation => (
        <button
          key={creation.id}
          onClick={() => onSelect(creation.id)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm min-h-[44px] transition-colors ${
            creation.id === activeId
              ? 'bg-gold text-black'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          {t(creation.title)}
        </button>
      ))}
    </div>
  );
}
