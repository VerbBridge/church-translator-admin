import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapBackendSession, type BackendSession } from '@/lib/store';

describe('mapBackendSession', () => {
  const fullBackendSession: BackendSession = {
    id: 'sess-abc',
    church_id: 1,
    name: 'Sunday Service',
    status: 'active',
    qr_code_data: 'https://example.com/qr',
    started_at: '2025-06-15T10:00:00Z',
    ended_at: '2025-06-15T12:00:00Z',
    source_language: 'en',
    target_language: 'es',
  };

  it('maps all fields correctly', () => {
    const result = mapBackendSession(fullBackendSession);
    expect(result).toEqual({
      id: 'sess-abc',
      name: 'Sunday Service',
      status: 'active',
      startedAt: '2025-06-15T10:00:00Z',
      endedAt: '2025-06-15T12:00:00Z',
      connectedUsers: 0,
      translationCount: 0,
      sourceLanguage: 'en',
      targetLanguage: 'es',
      qrCodeData: 'https://example.com/qr',
      deviceId: undefined,
    });
  });

  it('passes through deviceId argument', () => {
    const result = mapBackendSession(fullBackendSession, 'mic-123');
    expect(result.deviceId).toBe('mic-123');
  });

  it('handles missing optional fields with defaults', () => {
    const minimal: BackendSession = {
      id: 'sess-min',
      church_id: 1,
      name: 'Minimal',
      status: 'active',
      qr_code_data: '',
      started_at: '2025-01-01T00:00:00Z',
    };

    const result = mapBackendSession(minimal);
    expect(result.sourceLanguage).toBe('es');
    expect(result.targetLanguage).toBe('en');
    expect(result.endedAt).toBeUndefined();
  });
});

describe('apiRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs correct URL and sends request', async () => {
    const mockResponse = { id: 'sess-1', name: 'Test' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    // Dynamic import to use after fetch is mocked
    const { apiRequest } = await import('@/lib/api');
    const result = await apiRequest('/api/sessions', { method: 'GET' }, false);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sessions'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Not found' }),
    } as Response);

    const { apiRequest } = await import('@/lib/api');
    await expect(apiRequest('/api/sessions/999', { method: 'GET' }, false)).rejects.toThrow('Not found');
  });

  it('returns undefined for 204 No Content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    } as Response);

    const { apiRequest } = await import('@/lib/api');
    const result = await apiRequest('/api/sessions/1', { method: 'DELETE' }, false);
    expect(result).toBeUndefined();
  });
});
