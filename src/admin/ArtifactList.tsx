import { useState } from 'react';
import type { ExhibitData, Artifact } from '../types';
import ArtifactForm from './ArtifactForm';
import CreationList from './CreationList';
import { deleteFile } from './api';

interface Props {
  data: ExhibitData;
  onSave: (data: ExhibitData) => void;
}

export default function ArtifactList({ data, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = () => {
    const id = `artifact-${Date.now()}`;
    const newArtifact: Artifact = {
      id,
      name: { zh: '', en: '' },
      period: { zh: '', en: '' },
      description: { zh: '', en: '' },
      originalPhoto: '',
      creations: [],
    };
    onSave({ artifacts: [...data.artifacts, newArtifact] });
    setEditingId(id);
  };

  const handleUpdate = (updated: Artifact) => {
    onSave({ artifacts: data.artifacts.map(a => (a.id === updated.id ? updated : a)) });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteFile(id);
    onSave({ artifacts: data.artifacts.filter(a => a.id !== id) });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const arr = [...data.artifacts];
    const target = index + direction;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onSave({ artifacts: arr });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Artifacts</h2>
        <button onClick={handleAdd} className="px-4 py-2 bg-gold text-black rounded font-medium">
          + Add Artifact
        </button>
      </div>

      {data.artifacts.map((artifact, index) => (
        <div key={artifact.id} className="bg-gray-900 rounded-lg p-4 mb-3">
          {editingId === artifact.id ? (
            <ArtifactForm artifact={artifact} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gold font-medium">{artifact.name.zh || '(unnamed)'}</span>
                  <span className="text-gray-500 ml-2">{artifact.name.en}</span>
                  <span className="text-gray-600 ml-3 text-sm">{artifact.creations.length} creations</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleMove(index, -1)} className="text-gray-500 hover:text-white">&#8593;</button>
                  <button onClick={() => handleMove(index, 1)} className="text-gray-500 hover:text-white">&#8595;</button>
                  <button onClick={() => setEditingId(artifact.id)} className="text-blue-400 hover:text-blue-300">Edit</button>
                  <button onClick={() => setExpandedId(expandedId === artifact.id ? null : artifact.id)} className="text-gray-400 hover:text-white">
                    {expandedId === artifact.id ? 'Collapse' : 'Creations'}
                  </button>
                  <button onClick={() => handleDelete(artifact.id)} className="text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
              {expandedId === artifact.id && (
                <CreationList artifact={artifact} onUpdate={handleUpdate} />
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
