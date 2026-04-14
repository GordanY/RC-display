import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import KioskLayout from './kiosk/KioskLayout';

function AdminPlaceholder() {
  return <div className="bg-gray-900 text-white text-2xl flex items-center justify-center h-screen">Admin Panel</div>;
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<KioskLayout />} />
          <Route path="/admin/*" element={<AdminPlaceholder />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
