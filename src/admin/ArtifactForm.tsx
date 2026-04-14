import { useState } from 'react';
import type { Artifact } from '../types';
import { uploadFile } from './api';

interface Props {
  artifact: Artifact;
  onSave: (artifact: Artifact) => void;
  onCancel: () => void;
}

export default function ArtifactForm({ artifact, onSave, onCancel }: Props) {
  const [form, setForm] = useState(artifact);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file, form.id);
    setForm(f => ({ ...f, originalPhoto: path }));
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file, form.id);
    setForm(f => ({ ...f, model: path }));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Name (中文)" value={form.name.zh}
          onChange={e => setForm(f => ({ ...f, name: { ...f.name, zh: e.target.value } }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
        <input placeholder="Name (English)" value={form.name.en}
          onChange={e => setForm(f => ({ ...f, name: { ...f.name, en: e.target.value } }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Period (中文)" value={form.period.zh}
          onChange={e => setForm(f => ({ ...f, period: { ...f.period, zh: e.target.value } }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
        <input placeholder="Period (English)" value={form.period.en}
          onChange={e => setForm(f => ({ ...f, period: { ...f.period, en: e.target.value } }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
      </div>
      <textarea placeholder="Description (中文)" value={form.description.zh}
        onChange={e => setForm(f => ({ ...f, description: { ...f.description, zh: e.target.value } }))}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" rows={3} />
      <textarea placeholder="Description (English)" value={form.description.en}
        onChange={e => setForm(f => ({ ...f, description: { ...f.description, en: e.target.value } }))}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" rows={3} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-400 block mb-1">Original Photo</label>
          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="text-gray-400 text-sm" />
          {form.originalPhoto && <div className="text-gray-500 text-xs mt-1">{form.originalPhoto}</div>}
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">3D Model (.obj)</label>
          <input type="file" accept=".obj,.mtl" onChange={handleModelUpload} className="text-gray-400 text-sm" />
          {form.model && <div className="text-gray-500 text-xs mt-1">{form.model}</div>}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave(form)} className="px-4 py-2 bg-gold text-black rounded">Save</button>
        <button onClick={onCancel} className="px-4 py-2 bg-gray-700 text-gray-300 rounded">Cancel</button>
      </div>
    </div>
  );
}
