import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRun, finishRun, listRuns, type RunOut} from '../api/runs';
import {runActionError, runStatus, selectedRun, snapshotForRun} from './backendRuns';

const serviceId = '00000000-0000-4000-8000-000000000010';
const snapshotId = '00000000-0000-4000-8000-000000000020';
const otherSnapshotId = '00000000-0000-4000-8000-000000000021';
const running: RunOut = {
  id: '00000000-0000-4000-8000-000000000030',
  snapshotId, status: 'running', name: 'Regression',
  startedAt: '2026-11-16T00:00:00Z', finishedAt: null,
};
const completed = {...running, status: 'completed', finishedAt: '2026-11-16T01:00:00Z'};
afterEach(() => vi.unstubAllGlobals());

describe('backend run lifecycle', () => {
  it('creates the run for the chosen snapshot with CSRF and same-origin credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({...running, metadata: {}}, {status: 201}));
    vi.stubGlobal('fetch', fetch);
    await expect(createRun(snapshotId, 'Regression', 'csrf-test')).resolves.toEqual(running);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/runs', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify({snapshotId, name: 'Regression'}),
    }));
    const headers: Headers = fetch.mock.calls[0][1].headers;
    expect(headers.get('X-CSRF-Token')).toBe('csrf-test');
    expect(headers.has('X-Coverage-Api-Key')).toBe(false);
  });

  it('loads one page of service history without discarding legacy statuses', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json([{...completed, status: 'failed', metadata: {}}], {
      headers: {'X-Total-Count': '52'},
    }));
    vi.stubGlobal('fetch', fetch);
    const {signal} = new AbortController();
    const page = await listRuns({serviceId}, 50, signal);
    expect(page).toEqual({runs: [{...completed, status: 'failed'}], hasMore: true});
    expect(runStatus(page.runs[0].status)).toBe('Ошибка');
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/runs?limit=50&offset=50&serviceId=${serviceId}`, expect.objectContaining({signal}));
  });

  it('finishes exactly the selected run and takes the end date from the server', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(completed));
    vi.stubGlobal('fetch', fetch);
    await expect(finishRun(running, 'csrf-test')).resolves.toEqual(completed);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/runs/${running.id}/finish`, expect.objectContaining({method: 'POST', body: undefined}));
    expect(fetch.mock.calls[0][1].headers.get('X-CSRF-Token')).toBe('csrf-test');
  });

  it('checks snapshot ownership for creation, history and completion', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({...running, snapshotId: otherSnapshotId}, {status: 201}))
      .mockResolvedValueOnce(Response.json([{...running, snapshotId: otherSnapshotId}]))
      .mockResolvedValueOnce(Response.json({...completed, snapshotId: otherSnapshotId})));
    await expect(createRun(snapshotId, 'Regression', 'csrf-test')).rejects.toMatchObject({kind: 'invalid-response'});
    await expect(listRuns({snapshotId})).rejects.toMatchObject({kind: 'invalid-response'});
    await expect(finishRun(running, 'csrf-test')).rejects.toMatchObject({kind: 'invalid-response'});
  });

  it('selects a run on its own snapshot and drops selection after changing snapshot, service or session scope', () => {
    const snapshots = [{id: otherSnapshotId}, {id: snapshotId}];
    const scope = 'shop:auth1';
    expect(snapshotForRun(running, snapshots)).toEqual(snapshots[1]);
    expect(snapshotForRun(running, [snapshots[0]])).toBeUndefined();
    const selection = {scope, run: running};
    expect(selectedRun(selection, scope, snapshotId)).toBe(running);
    expect(selectedRun(selection, scope, otherSnapshotId)).toBeNull();
    expect(selectedRun(selection, 'another:auth1', snapshotId)).toBeNull();
    expect(selectedRun(selection, 'shop:auth2', snapshotId)).toBeNull();
  });

  it.each([[401, 'войдите'], [403, 'Недостаточно прав'], [404, 'недоступен'], [409, 'Статус прогона изменился']])(
    'exposes HTTP %s without repeating the finish request', async (status, message) => {
      const fetch = vi.fn().mockResolvedValue(new Response(null, {status}));
      vi.stubGlobal('fetch', fetch);
      const error = await finishRun(running, 'csrf-test').catch((error: unknown) => error);
      expect(error).toMatchObject({status});
      expect(runActionError(error, 'finish')).toContain(message);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
});
