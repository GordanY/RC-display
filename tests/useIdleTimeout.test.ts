import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleTimeout } from '../src/hooks/useIdleTimeout';

describe('useIdleTimeout', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls onIdle after timeout', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle, 60000));
    expect(onIdle).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(60000); });
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('resets timer on touch events', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle, 60000));
    act(() => { vi.advanceTimersByTime(50000); });
    act(() => { window.dispatchEvent(new Event('touchstart')); });
    act(() => { vi.advanceTimersByTime(50000); });
    expect(onIdle).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onIdle).toHaveBeenCalledOnce();
  });
});
