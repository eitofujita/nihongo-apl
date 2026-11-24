// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import type {ReactNode} from 'react';
import en from '../messages/en.json';
import {AccountPanel} from '@/components/account-panel';
import {ProgressProvider, useProgress} from '@/components/progress-provider';
import {Practice} from '@/components/learning';
import {getLesson} from '@/content/lessons';
import {initialProgress, STORAGE_KEY, type Progress} from '@/lib/progress';
import type {AccountState} from '@/lib/auth-state';

const navigation = vi.hoisted(() => ({replace: vi.fn(), home: vi.fn()}));
vi.mock('@/lib/auth-navigation', () => ({goToLearning: navigation.home}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({href, children}: {href: string; children: ReactNode}) => <a href={href}>{children}</a>,
  usePathname: () => '/', useRouter: () => ({replace: navigation.replace})
}));
const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';
const configuredGuest: AccountState = {configured: true, user: null, progress: null, loadError: false};
const accountA: AccountState = {...configuredGuest, user: {id: USER_A, email: 'a@example.test'}, progress: initialProgress};
const network = vi.fn<typeof fetch>();
function wrap(children: ReactNode, account: AccountState = configuredGuest) {
  return <NextIntlClientProvider locale="en" messages={en} timeZone="UTC"><ProgressProvider key={account.user?.id ?? 'guest'} account={account}>{children}</ProgressProvider></NextIntlClientProvider>;
}
function Snapshot() {
  const {progress, ready, syncError} = useProgress();
  return <output data-testid="snapshot">{JSON.stringify({ready, syncError, goal: progress.dailyGoal, sessions: progress.sessions.length})}</output>;
}
beforeEach(() => {localStorage.clear(); network.mockReset(); navigation.replace.mockReset(); navigation.home.mockReset(); vi.stubGlobal('fetch', network);});
afterEach(() => {cleanup(); vi.useRealTimers(); vi.unstubAllGlobals();});

describe('Account forms without external email delivery', () => {
  it('validates passwords before registering and navigates to the email confirmation page', async () => {
    render(wrap(<AccountPanel mode="register"/>));
    fireEvent.change(screen.getByLabelText('Email address'), {target: {value: 'student@example.test'}});
    fireEvent.change(screen.getByLabelText('Password', {exact: true}), {target: {value: 'a-strong-password'}});
    fireEvent.change(screen.getByLabelText('Confirm password'), {target: {value: 'different-password'}});
    fireEvent.submit(screen.getByRole('button', {name: 'Create account'}).closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('passwords do not match');
    expect(network).not.toHaveBeenCalled();
    network.mockResolvedValueOnce(Response.json({ok: true, confirmation: true}));
    fireEvent.change(screen.getByLabelText('Confirm password'), {target: {value: 'a-strong-password'}});
    fireEvent.submit(screen.getByRole('button', {name: 'Create account'}).closest('form')!);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/verify-email'));
    expect(navigation.home).not.toHaveBeenCalled();
    expect(network.mock.calls[0][0]).toBe('/api/auth/register');
  });
  it('opens learning directly when registration already establishes a session', async () => {
    network.mockResolvedValueOnce(Response.json({ok: true, confirmation: false}));
    render(wrap(<AccountPanel mode="register"/>));
    fireEvent.change(screen.getByLabelText('Email address'), {target: {value: 'student@example.test'}});
    for (const label of ['Password', 'Confirm password']) {
      fireEvent.change(screen.getByLabelText(label, {exact: true}), {target: {value: 'a-strong-password'}});
    }
    fireEvent.submit(screen.getByRole('button', {name: 'Create account'}).closest('form')!);
    await waitFor(() => expect(navigation.home).toHaveBeenCalledWith('en'));
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it('displays a generic credentials error without exposing provider details', async () => {
    network.mockResolvedValueOnce(Response.json({error: 'credentials'}, {status: 400}));
    render(wrap(<AccountPanel/>));
    fireEvent.change(screen.getByLabelText('Email address'), {target: {value: 'student@example.test'}});
    fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'incorrect'}});
    fireEvent.submit(screen.getByRole('button', {name: 'Sign in'}).closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('email or password is incorrect');
  });
  it('provides email/password recovery and rejects an unauthenticated reset form', async () => {
    network.mockResolvedValueOnce(Response.json({ok: true, confirmation: true}));
    const view = render(wrap(<AccountPanel mode="recover"/>));
    fireEvent.change(screen.getByLabelText('Email address'), {target: {value: 'student@example.test'}});
    fireEvent.submit(screen.getByRole('button', {name: 'Send reset link'}).closest('form')!);
    expect((await screen.findByRole('status')).textContent).toContain('Check your email');
    view.unmount(); render(wrap(<AccountPanel mode="password"/>));
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.getByText(/Your session has expired/)).toBeDefined();
  });
  it('blocks repeated recovery emails after success without automatically resending', async () => {
    vi.useFakeTimers();
    network.mockResolvedValueOnce(Response.json({ok: true, confirmation: true}));
    render(wrap(<AccountPanel mode="recover"/>));
    fireEvent.change(screen.getByLabelText('Email address'), {target: {value: 'student@example.test'}});
    const form = screen.getByRole('button', {name: 'Send reset link'}).closest('form')!;
    await act(async () => {fireEvent.submit(form);});
    expect(screen.getByRole('status').textContent).toContain('Check your email');
    expect((screen.getByRole('button', {name: 'Try again in 60s'}) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {fireEvent.submit(form);});
    expect(network).toHaveBeenCalledOnce();
    await act(async () => {vi.setSystemTime(Date.now() + 60000); await vi.advanceTimersByTimeAsync(1000);});
    expect((screen.getByRole('button', {name: 'Send reset link'}) as HTMLButtonElement).disabled).toBe(false);
    expect(network).toHaveBeenCalledOnce();
  });
  it('shows provider email limits without claiming success and respects a local Retry-After', async () => {
    vi.useFakeTimers();
    network.mockResolvedValueOnce(Response.json({error: 'email_rate_limit'}, {status: 429}));
    render(wrap(<AccountPanel mode="recover"/>));
    fireEvent.change(screen.getByLabelText('Email address'), {target: {value: 'student@example.test'}});
    const form = screen.getByRole('button', {name: 'Send reset link'}).closest('form')!;
    await act(async () => {fireEvent.submit(form);});
    expect(screen.getByRole('alert').textContent).toContain('Email sending is temporarily limited');
    expect(screen.queryByRole('status')).toBeNull();
    expect((screen.getByRole('button', {name: 'Try again in 60s'}) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {vi.setSystemTime(Date.now() + 60000); await vi.advanceTimersByTimeAsync(1000);});
    network.mockResolvedValueOnce(Response.json({error: 'rate_limit', retryAfterSeconds: 17}, {status: 429, headers: {'Retry-After': '17'}}));
    await act(async () => {fireEvent.submit(form);});
    expect((screen.getByRole('button', {name: 'Try again in 17s'}) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {vi.setSystemTime(Date.now() + 17000); await vi.advanceTimersByTimeAsync(1000);});
    expect((screen.getByRole('button', {name: 'Send reset link'}) as HTMLButtonElement).disabled).toBe(false);
    expect(network).toHaveBeenCalledTimes(2);
  });
});

describe('Cloud progress, retry and account isolation', () => {
  it('does not import guest history or leave one account’s state in another account', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({...initialProgress, dailyGoal: 5}));
    const view = render(wrap(<Snapshot/>, {...accountA, progress: {...initialProgress, dailyGoal: 10}}));
    expect(screen.getByTestId('snapshot').textContent).toContain('"goal":10');
    view.rerender(wrap(<Snapshot/>, {...accountA, user: {id: USER_B, email: 'b@example.test'}, progress: {...initialProgress, dailyGoal: 20}}));
    expect(screen.getByTestId('snapshot').textContent).toContain('"goal":20');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).dailyGoal).toBe(5);
  });
  it('does not report saved on failure, and retries the same id with raw answers', async () => {
    network.mockResolvedValueOnce(Response.json({error: 'storage_unavailable'}, {status: 503}));
    render(wrap(<><Practice lessonId="n5-no" questions={getLesson("n5-no")!.questions}/><Snapshot/></>, accountA));
    for (const answer of ['の', 'の']) {
      fireEvent.click(screen.getAllByRole('radio').find(input => (input as HTMLInputElement).value === answer)!);
      fireEvent.click(screen.getByRole('button', {name: 'Next question'}));
    }
    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'の'}});
    fireEvent.click(screen.getByRole('button', {name: 'Check answer'}));
    fireEvent.click(screen.getByRole('button', {name: 'Finish lesson'}));
    expect((await screen.findByRole('alert')).textContent).toContain('not been confirmed as saved');
    expect(screen.getByTestId('snapshot').textContent).toContain('"sessions":0');
    const first = JSON.parse(String(network.mock.calls[0][1]?.body)) as {id: string; answers: {questionId: string; answer: string}[]};
    expect(first.answers).toEqual([{questionId: 'no-1', answer: 'の'}, {questionId: 'no-2', answer: 'の'}, {questionId: 'no-3', answer: 'の'}]);
    const saved: Progress = {...initialProgress, sessions: [{id: first.id, lessonId: 'n5-no', at: new Date().toISOString(), durationSeconds: 0, answers: first.answers.map(a => ({questionId: a.questionId, correct: true}))}]};
    network.mockResolvedValueOnce(Response.json({userId: USER_A, progress: saved}));
    fireEvent.click(screen.getByRole('button', {name: 'Finish lesson'}));
    await waitFor(() => expect(screen.getByRole('heading', {level: 1}).textContent).toContain('complete'));
    expect(JSON.parse(String(network.mock.calls[1][1]?.body)).id).toBe(first.id);
    expect(screen.getByTestId('snapshot').textContent).toContain('"sessions":1');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('disables learning when the account database failed to load', () => {
    render(wrap(<><Practice lessonId="n5-no" questions={getLesson("n5-no")!.questions}/><Snapshot/></>, {...accountA, progress: null, loadError: true}));
    expect(screen.getByTestId('snapshot').textContent).toContain('"ready":false');
    expect((screen.getByRole('button', {name: 'Check answer'}) as HTMLButtonElement).disabled).toBe(true);
    expect(network).not.toHaveBeenCalled();
  });
});
