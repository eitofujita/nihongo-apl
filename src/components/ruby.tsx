'use client';

import {useSyncExternalStore, type ReactNode} from 'react';

const STORAGE_KEY = 'nihongo-furigana';
const EVENT = 'nihongo-furigana-change';

function read() {
  try {return localStorage.getItem(STORAGE_KEY) === 'on';} catch {return false;}
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {window.removeEventListener(EVENT, callback); window.removeEventListener('storage', callback);};
}

/** Furigana preference shared across components; off by default and on the server. */
export function useFurigana(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = (value: boolean) => {
    try {localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');} catch {/* storage unavailable */}
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}

/** Renders 漢字{かんじ} notation as <ruby>. Falls back to the plain text when there is no annotation. */
export function Ruby({text, ruby}: {text: string; ruby?: string}): ReactNode {
  const [on] = useFurigana();
  if (!on || !ruby) return text;
  const nodes: ReactNode[] = [];
  const pattern = /([^{}]+?)\{([^{}]+)\}/g;
  let last = 0;
  for (const match of ruby.matchAll(pattern)) {
    // The base is the trailing kanji run of the matched text; anything before it is plain.
    const [, chunk, reading] = match;
    const base = chunk.match(/[㐀-鿿豈-﫿々〆ヶ]+$/)?.[0] ?? chunk;
    const plain = chunk.slice(0, chunk.length - base.length);
    if (match.index > last) nodes.push(ruby.slice(last, match.index));
    if (plain) nodes.push(plain);
    nodes.push(<ruby key={match.index}>{base}<rt>{reading}</rt></ruby>);
    last = match.index + match[0].length;
  }
  if (last < ruby.length) nodes.push(ruby.slice(last));
  return <>{nodes}</>;
}

export function FuriganaToggle({label}: {label: string}) {
  const [on, set] = useFurigana();
  return <button type="button" className={`furigana-toggle ${on ? 'selected' : ''}`} aria-pressed={on} onClick={() => set(!on)}>
    <ruby aria-hidden="true" lang="ja">漢<rt>かん</rt></ruby><span>{label}</span>
  </button>;
}
