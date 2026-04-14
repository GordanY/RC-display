import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext';
import type { BilingualText } from '../src/types';

function TestConsumer() {
  const { language, toggleLanguage, t } = useLanguage();
  const text: BilingualText = { zh: '你好', en: 'Hello' };
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="text">{t(text)}</span>
      <button onClick={toggleLanguage}>Toggle</button>
    </div>
  );
}

describe('LanguageContext', () => {
  it('defaults to Chinese', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('zh');
    expect(screen.getByTestId('text')).toHaveTextContent('你好');
  });

  it('toggles to English', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(screen.getByTestId('text')).toHaveTextContent('Hello');
  });
});
