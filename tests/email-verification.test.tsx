// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NextIntlClientProvider} from 'next-intl';
import en from '../messages/en.json';
import ru from '../messages/ru.json';
import {EmailVerification} from '@/components/email-verification';
import type {AccountState} from '@/lib/auth-state';

const mocks = vi.hoisted(() => ({home: vi.fn(), progress: vi.fn()}));
vi.mock('@/lib/auth-navigation', () => ({goToLearning: mocks.home}));
vi.mock('@/components/progress-provider', () => ({useProgress: mocks.progress}));
vi.mock('@/i18n/navigation', () => ({Link: ({href, children}: {href: string; children: React.ReactNode}) => <a href={href}>{children}</a>}));
const account: AccountState = {configured: true, user: null, progress: null, loadError: false};
const network = vi.fn<typeof fetch>();
function show(locale: 'en' | 'ru' = 'en') {
  return render(<NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ru} timeZone="UTC"><EmailVerification/></NextIntlClientProvider>);
}
async function tick(ms = 0) {await act(async () => {await vi.advanceTimersByTimeAsync(ms);});}
beforeEach(() => {
  vi.useFakeTimers(); mocks.home.mockReset(); mocks.progress.mockReturnValue({account});
  network.mockReset().mockImplementation(async () => Response.json({authenticated: false}));
  vi.stubGlobal('fetch', network);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => {cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe('Email confirmation screen', () => {
  it('stays on the waiting screen until the server confirms authentication', async () => {
    show(); await tick();
    expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Check your email');
    expect(screen.getByRole('status').textContent).toContain('Waiting');
    expect(mocks.home).not.toHaveBeenCalled();
    network.mockResolvedValueOnce(Response.json({authenticated: true}));
    await tick(10000);
    expect(mocks.home).toHaveBeenCalledExactlyOnceWith('en');
    expect(network.mock.calls[0][0]).toBe('/api/auth/status');
    expect(network.mock.calls[0][1]).toMatchObject({cache: 'no-store', credentials: 'same-origin'});
  });
  it('checks again on return from the email tab and preserves Russian', async () => {
    show('ru'); await tick();
    network.mockResolvedValueOnce(Response.json({authenticated: true}));
    await act(async () => {window.dispatchEvent(new Event('focus'));});
    expect(mocks.home).toHaveBeenCalledExactlyOnceWith('ru');
  });
  it('provides a manual check and sign-in alternative without treating a click as confirmation', async () => {
    show(); await tick();
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'I’ve confirmed my email'}));});
    expect(screen.getByRole('status').textContent).toContain('not complete');
    expect(screen.getByRole('link', {name: 'Back to sign in'}).getAttribute('href')).toBe('/login');
    expect(mocks.home).not.toHaveBeenCalled();
    network.mockResolvedValueOnce(Response.json({authenticated: true}));
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'I’ve confirmed my email'}));});
    expect(mocks.home).toHaveBeenCalledExactlyOnceWith('en');
  });
  it('keeps errors retryable and rejects malformed or unsuccessful status responses', async () => {
    network.mockResolvedValueOnce(Response.json({authenticated: true}, {status: 503}));
    show(); await tick();
    expect(screen.getByRole('status').textContent).toContain('could not check');
    expect(mocks.home).not.toHaveBeenCalled();
    network.mockResolvedValueOnce(Response.json({authenticated: 'true'}));
    await tick(10000);
    expect(mocks.home).not.toHaveBeenCalled();
    network.mockResolvedValueOnce(Response.json({authenticated: true}));
    await tick(10000);
    expect(mocks.home).toHaveBeenCalledOnce();
  });
  it('does not poll while hidden and bounds automatic polling to 15 minutes', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    show(); await tick(10000);
    expect(network).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    await act(async () => {document.dispatchEvent(new Event('visibilitychange'));});
    expect(network).toHaveBeenCalledOnce();
    await tick(15 * 60 * 1000);
    expect(screen.getByRole('status').textContent).toContain('paused');
    const count = network.mock.calls.length;
    await tick(60000);
    expect(network).toHaveBeenCalledTimes(count);
    network.mockResolvedValueOnce(Response.json({authenticated: true}));
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'I’ve confirmed my email'}));});
    expect(mocks.home).toHaveBeenCalledOnce();
  });
  it('cancels an in-flight check when leaving without navigating after unmount', async () => {
    let resolve: (response: Response) => void = () => undefined;
    network.mockImplementationOnce(() => new Promise<Response>(done => {resolve = done;}));
    const view = show(); await tick();
    const signal = network.mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {resolve(Response.json({authenticated: true}));});
    expect(mocks.home).not.toHaveBeenCalled();
  });
  it('skips polling if already signed in or the service is unconfigured', async () => {
    mocks.progress.mockReturnValue({account: {...account, user: {id: 'user', email: 'student@example.test'}}});
    const view = show(); await tick();
    expect(mocks.home).toHaveBeenCalledOnce(); expect(network).not.toHaveBeenCalled();
    view.unmount(); mocks.home.mockClear();
    mocks.progress.mockReturnValue({account: {...account, configured: false}});
    show(); await tick();
    expect(network).not.toHaveBeenCalled(); expect(mocks.home).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
