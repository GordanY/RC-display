import { useState } from 'react';
import type { Creation } from '../types';
import { uploadFile } from './api';

interface Props {
  creation: Creation;
  artifactId: string;
  onSave: (creation: Creation) => void;
  onCancel: () => void;
}

export default function CreationForm({ creation, artifactId, onSave, onCancel }: Props) {
  const [form, setForm] = useState(creation);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const path = await uploadFile(file, `${artifactId}/creations/${form.id}/photos`);
      setForm(f => ({ ...f, photos: [...f.photos, path] }));
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file, `${artifactId}/creations/${form.id}`);
    setForm(f => ({ ...f, video: path }));
  };

  const [mtlUploaded, setMtlUploaded] = useState('');
  const [texturesUploaded, setTexturesUploaded] = useState(0);

  const modelDir = `${artifactId}/creations/${form.id}`;

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file, modelDir);
    setForm(f => ({ ...f, model: path }));
  };

  const handleMtlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file, modelDir);
    setMtlUploaded(file.name);
  };

  const handleTextureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadFile(file, modelDir);
    }
    setTexturesUploaded(prev => prev + files.length);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Title (中文)" value={form.title.zh}
          onChange={e => setForm(f => ({ ...f, title: { ...f.title, zh: e.target.value } }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
        <input placeholder="Title (English)" value={form.title.en}
          onChange={e => setForm(f => ({ ...f, title: { ...f.title, en: e.target.value } }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Artist (中文)" value={form.artist.zh}
          onChange={e => setForm(f => ({ ...f, artist: { ...f.artist, zh: e.target.value } }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
        <input placeholder="Artist (English)" value={form.artist.en}
          onChange={e => setForm(f => ({ ...f, artist: { ...f.artist, en: e.target.value } }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
      </div>
      <textarea placeholder="Description (中文)" value={form.description.zh}
        onChange={e => setForm(f => ({ ...f, description: { ...f.description, zh: e.target.value } }))}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" rows={2} />
      <textarea placeholder="Description (English)" value={form.description.en}
        onChange={e => setForm(f => ({ ...f, description: { ...f.description, en: e.target.value } }))}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Photos</label>
          <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="text-gray-400 text-xs" />
          <div className="text-xs text-gray-600 mt-1">{form.photos.length} photos</div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Video</label>
          <input type="file" accept="video/*" onChange={handleVideoUpload} className="text-gray-400 text-xs" />
          {form.video && <div className="text-xs text-gray-600 mt-1">uploaded</div>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">3D Model (.obj)</label>
          <input type="file" accept=".obj" onChange={handleModelUpload} className="text-gray-400 text-xs" />
          {form.model && <div className="text-xs text-gray-600 mt-1">uploaded</div>}
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Material (.mtl)</label>
          <input type="file" accept=".mtl" onChange={handleMtlUpload} className="text-gray-400 text-xs" />
          {mtlUploaded && <div className="text-xs text-gray-600 mt-1">{mtlUploaded}</div>}
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Textures</label>
          <input type="file" accept="image/*" multiple onChange={handleTextureUpload} className="text-gray-400 text-xs" />
          {texturesUploaded > 0 && <div className="text-xs text-gray-600 mt-1">{texturesUploaded} uploaded</div>}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave(form)} className="px-3 py-1 bg-gold text-black rounded text-sm">Save</button>
        <button onClick={onCancel} className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm">Cancel</button>
      </div>
    </div>
  );
}
