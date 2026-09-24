// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { renderHook, act } from '@testing-library/react';

import { useLocalStorage } from '#hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('reads existing value from localStorage on mount', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('stored-value');
  });

  it('writes to localStorage on setState', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(localStorage.getItem('test-key') ?? '')).toBe('updated');
  });

  it('handles JSON parse error gracefully and returns initial value', () => {
    localStorage.setItem('test-key', 'not-valid-json{{{');
    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('supports null as a stored value', () => {
    const { result } = renderHook(() => useLocalStorage<string | null>('test-key', null));
    expect(result.current[0]).toBeNull();

    act(() => {
      result.current[1]('something');
    });
    expect(result.current[0]).toBe('something');

    act(() => {
      result.current[1](null);
    });
    expect(result.current[0]).toBeNull();
    expect(JSON.parse(localStorage.getItem('test-key') ?? '')).toBeNull();
  });

  it('supports objects as values', () => {
    const { result } = renderHook(() => useLocalStorage<Record<string, number>>('test-key', { a: 1 }));

    act(() => {
      result.current[1]({ a: 2, b: 3 });
    });

    expect(result.current[0]).toEqual({ a: 2, b: 3 });
    expect(JSON.parse(localStorage.getItem('test-key') ?? '')).toEqual({ a: 2, b: 3 });
  });
});
