import { BrowserRouter, Routes, Route } from 'react-router-dom';
import KioskLayout from './kiosk/KioskLayout';
import AdminLayout from './admin/AdminLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<KioskLayout />} />
        <Route path="/admin/*" element={<AdminLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
