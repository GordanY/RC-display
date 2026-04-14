import { describe, it, expect } from 'vitest';
import type { Creation, ExhibitData } from '../src/types';

describe('ExhibitData types', () => {
  it('should accept valid exhibit data structure', () => {
    const data: ExhibitData = {
      artifacts: [
        {
          id: 'artifact-001',
          name: { zh: '龍紋青銅器', en: 'Dragon Bronze Vessel' },
          period: { zh: '商朝', en: 'Shang Dynasty' },
          description: { zh: '描述', en: 'Description' },
          originalPhoto: 'artifact-001/original-photo.jpg',
          model: 'artifact-001/model.obj',
          creations: [
            {
              id: 'creation-001',
              title: { zh: '彩繪龍紋', en: 'Painted Dragon' },
              artist: { zh: '王小明', en: 'Wang Xiaoming' },
              description: { zh: '學生描述', en: 'Student description' },
              photos: ['artifact-001/creations/creation-001/photos/1.jpg'],
              video: 'artifact-001/creations/creation-001/video.mp4',
              model: 'artifact-001/creations/creation-001/model.obj',
            },
          ],
        },
      ],
    };
    expect(data.artifacts).toHaveLength(1);
    expect(data.artifacts[0].creations).toHaveLength(1);
  });

  it('should allow creation without optional video and model', () => {
    const creation: Creation = {
      id: 'creation-002',
      title: { zh: '標題', en: 'Title' },
      artist: { zh: '藝術家', en: 'Artist' },
      description: { zh: '描述', en: 'Desc' },
      photos: [],
    };
    expect(creation.video).toBeUndefined();
    expect(creation.model).toBeUndefined();
  });
});
