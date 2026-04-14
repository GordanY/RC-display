import { useState } from 'react';
import type { Artifact, Creation } from '../types';
import CreationForm from './CreationForm';
import { deleteFile } from './api';

interface Props {
  artifact: Artifact;
  onUpdate: (artifact: Artifact) => void;
}

export default function CreationList({ artifact, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    const id = `creation-${Date.now()}`;
    const newCreation: Creation = {
      id, title: { zh: '', en: '' }, artist: { zh: '', en: '' },
      description: { zh: '', en: '' }, photos: [],
    };
    onUpdate({ ...artifact, creations: [...artifact.creations, newCreation] });
    setEditingId(id);
  };

  const handleSave = (updated: Creation) => {
    onUpdate({ ...artifact, creations: artifact.creations.map(c => (c.id === updated.id ? updated : c)) });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteFile(`${artifact.id}/creations/${id}`);
    onUpdate({ ...artifact, creations: artifact.creations.filter(c => c.id !== id) });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const arr = [...artifact.creations];
    const target = index + direction;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onUpdate({ ...artifact, creations: arr });
  };

  return (
    <div className="mt-4 pl-4 border-l-2 border-gray-800">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-300">Student Creations</h3>
        <button onClick={handleAdd} className="px-3 py-1 bg-gold/20 text-gold rounded text-sm">+ Add Creation</button>
      </div>
      {artifact.creations.map((creation, index) => (
        <div key={creation.id} className="bg-gray-800/50 rounded p-3 mb-2">
          {editingId === creation.id ? (
            <CreationForm creation={creation} artifactId={artifact.id} onSave={handleSave} onCancel={() => setEditingId(null)} />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gold text-sm">{creation.title.zh || '(unnamed)'}</span>
                <span className="text-gray-500 text-sm ml-2">{creation.artist.zh}</span>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => handleMove(index, -1)} className="text-gray-500 hover:text-white">&#8593;</button>
                <button onClick={() => handleMove(index, 1)} className="text-gray-500 hover:text-white">&#8595;</button>
                <button onClick={() => setEditingId(creation.id)} className="text-blue-400">Edit</button>
                <button onClick={() => handleDelete(creation.id)} className="text-red-400">Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
