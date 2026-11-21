// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cloudKanjiSnapshot, ensureCloudKanji, saveCloudKanjiAttempt, subscribeKanji} from '../src/lib/kanji-progress';

const USER = '00000000-0000-4000-8000-000000000001';
const at = '2026-11-22T00:00:00.000Z';
function reply(body: unknown, status = 200) {return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});}
afterEach(() => vi.unstubAllGlobals());

describe('kanji progress for a signed-in account', () => {
  it('loads the account store, shows a new attempt at once and keeps the server result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply({userId: USER, store: {'水': {passed: 'trace', attempts: 1, at}}}))
      .mockResolvedValueOnce(reply({userId: USER, store: {'水': {passed: 'guide', attempts: 2, at}}}));
    vi.stubGlobal('fetch', fetchMock);
    const changes = vi.fn();
    const unsubscribe = subscribeKanji(changes);
    await ensureCloudKanji(USER);
    expect(cloudKanjiSnapshot(USER)['水'].passed).toBe('trace');
    const saving = saveCloudKanjiAttempt(USER, '水', 'guide', 0);
    expect(cloudKanjiSnapshot(USER)['水'].attempts).toBe(2); // Optimistic update before the reply.
    await expect(saving).resolves.toBe(true);
    expect(cloudKanjiSnapshot(USER)['水']).toMatchObject({passed: 'guide', attempts: 2});
    expect(fetchMock.mock.calls[1][1]).toMatchObject({method: 'POST', body: JSON.stringify({kanji: '水', mode: 'guide', mistakes: 0})});
    expect(fetchMock.mock.calls[1][1].headers['X-Nihongo-Account']).toBe(USER);
    expect(changes).toHaveBeenCalled();
    unsubscribe();
  });
  it('reports a failed save and ignores replies for another account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({error: 'storage_unavailable'}, 503)));
    await expect(saveCloudKanjiAttempt(USER, '火', 'trace', 0)).resolves.toBe(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({userId: 'other', store: {}})));
    await expect(saveCloudKanjiAttempt(USER, '火', 'trace', 0)).resolves.toBe(false);
    expect(cloudKanjiSnapshot('someone-else')).toEqual({});
  });
});
