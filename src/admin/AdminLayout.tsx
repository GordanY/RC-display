import { useState, useEffect } from 'react';
import type { ExhibitData } from '../types';
import { fetchData, saveData } from './api';
import ArtifactList from './ArtifactList';

export default function AdminLayout() {
  const [data, setData] = useState<ExhibitData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData().then(setData);
  }, []);

  const handleSave = async (updated: ExhibitData) => {
    setSaving(true);
    await saveData(updated);
    setData(updated);
    setSaving(false);
  };

  if (!data) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gold">Museum Display — Admin</h1>
          <div className="flex gap-3">
            <a href="/" target="_blank" className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700">
              Preview Kiosk
            </a>
            {saving && <span className="text-gold py-2">Saving...</span>}
          </div>
        </div>
        <ArtifactList data={data} onSave={handleSave} />
      </div>
    </div>
  );
}
