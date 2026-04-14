import type { Artifact } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  artifacts: Artifact[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function ArtifactTabs({ artifacts, activeId, onSelect }: Props) {
  const { t } = useLanguage();

  return (
    <div className="flex overflow-x-auto bg-black border-b border-gray-800">
      {artifacts.map(artifact => (
        <button
          key={artifact.id}
          onClick={() => onSelect(artifact.id)}
          className={`flex-shrink-0 px-4 py-3 text-sm min-h-[44px] transition-colors ${
            artifact.id === activeId
              ? 'text-gold border-b-2 border-gold'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {t(artifact.name)}
        </button>
      ))}
    </div>
  );
}
