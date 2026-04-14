import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExhibitData } from '../src/hooks/useExhibitData';

const mockData = {
  artifacts: [
    {
      id: 'a1',
      name: { zh: '器', en: 'Vessel' },
      period: { zh: '朝', en: 'Dynasty' },
      description: { zh: '描述', en: 'Desc' },
      originalPhoto: 'a1/photo.jpg',
      creations: [
        {
          id: 'c1',
          title: { zh: '作品', en: 'Work' },
          artist: { zh: '人', en: 'Person' },
          description: { zh: '描述', en: 'Desc' },
          photos: [],
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(mockData) })
  ));
});

describe('useExhibitData', () => {
  it('fetches and returns exhibit data', async () => {
    const { result } = renderHook(() => useExhibitData());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.artifacts).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));
    const { result } = renderHook(() => useExhibitData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });
});
