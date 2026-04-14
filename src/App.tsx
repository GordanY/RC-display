import { BrowserRouter, Routes, Route } from 'react-router-dom';

function KioskPlaceholder() {
  return <div className="bg-black text-gold text-2xl flex items-center justify-center h-screen">Kiosk Display</div>;
}

function AdminPlaceholder() {
  return <div className="bg-gray-900 text-white text-2xl flex items-center justify-center h-screen">Admin Panel</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<KioskPlaceholder />} />
        <Route path="/admin/*" element={<AdminPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}
