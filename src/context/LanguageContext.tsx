import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { BilingualText, Language } from '../types';

interface LanguageContextValue {
  language: Language;
  toggleLanguage: () => void;
  t: (text: BilingualText) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh');

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => (prev === 'zh' ? 'en' : 'zh'));
  }, []);

  const t = useCallback(
    (text: BilingualText) => text[language],
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
