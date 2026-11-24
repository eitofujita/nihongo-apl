// Nyantan, the site's cat. Decorative only: every use is aria-hidden, the meaning is in nearby text.

type Mood = 'happy' | 'calm' | 'wink';

/** Round cat face used as the logo mark, avatars and result badges. */
export function CatFace({size = 32, mood = 'calm', className = ''}: {size?: number; mood?: Mood; className?: string}) {
  return <svg className={`cat-face ${className}`} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M12 26 9 7q1-3 4-1l13 10M52 26l3-19q-1-3-4-1L38 16" fill="#f7e8d2" stroke="#5a4535" strokeWidth="2.6" strokeLinejoin="round"/>
    <path d="m13 11 2 10 6-4zm38 0-2 10-6-4z" fill="#f2a7ae"/>
    <ellipse cx="32" cy="37" rx="24" ry="20" fill="#f7e8d2" stroke="#5a4535" strokeWidth="2.6"/>
    <path d="M24 18q3 5 0 9m8-10v9m8-8q-3 5 0 9" stroke="#e2b98c" strokeWidth="2.4" strokeLinecap="round"/>
    {mood === 'happy'
      ? <path d="M18 36q4-5 8 0m12 0q4-5 8 0" stroke="#3b2c21" strokeWidth="2.8" strokeLinecap="round"/>
      : mood === 'wink'
        ? <><circle cx="22" cy="35" r="3.3" fill="#3b2c21"/><circle cx="23.2" cy="33.8" r="1" fill="#fff"/><path d="M38 36q4-5 8 0" stroke="#3b2c21" strokeWidth="2.8" strokeLinecap="round"/></>
        : <><circle cx="22" cy="35" r="3.3" fill="#3b2c21"/><circle cx="42" cy="35" r="3.3" fill="#3b2c21"/><circle cx="23.2" cy="33.8" r="1" fill="#fff"/><circle cx="43.2" cy="33.8" r="1" fill="#fff"/></>}
    <ellipse cx="15.5" cy="42" rx="4" ry="2.6" fill="#f4b3b6" opacity=".75"/><ellipse cx="48.5" cy="42" rx="4" ry="2.6" fill="#f4b3b6" opacity=".75"/>
    <path d="m30 40 2 2 2-2z" fill="#e98a93" stroke="#e98a93" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M27 44q2.5 2.5 5 0 2.5 2.5 5 0" stroke="#3b2c21" strokeWidth="2" strokeLinecap="round"/>
    <path d="M5 37h8M6 43l7-2m46-4h-8m7 6-7-2" stroke="#5a4535" strokeWidth="1.8" strokeLinecap="round" opacity=".55"/>
  </svg>;
}

/** A small paw print, used as a playful marker (progress bars, bullets). */
export function Paw({size = 14, className = ''}: {size?: number; className?: string}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <ellipse cx="12" cy="16" rx="6" ry="5"/><circle cx="5" cy="10" r="2.4"/><circle cx="9.3" cy="5.6" r="2.4"/><circle cx="14.7" cy="5.6" r="2.4"/><circle cx="19" cy="10" r="2.4"/>
  </svg>;
}

/** Nyantan sitting on a cushion with an open book, under falling sakura petals. */
export function CatScene({className = ''}: {className?: string}) {
  return <svg className={className} viewBox="0 0 260 220" fill="none" aria-hidden="true">
    <circle cx="190" cy="58" r="40" fill="#fbe3c4" opacity=".8"/>
    <g fill="#f6c3c7"><path d="M40 40q6-8 10 0-5 6-10 0z"/><path d="M214 124q7-5 9 3-7 4-9-3z"/><path d="M70 92q5-7 9 1-5 5-9-1z" opacity=".7"/><path d="M232 30q6-6 9 2-6 4-9-2z" opacity=".7"/></g>
    <ellipse cx="130" cy="196" rx="86" ry="14" fill="#e3ead8"/>
    <rect x="56" y="168" width="148" height="30" rx="15" fill="#e9a8ad"/>
    <rect x="62" y="166" width="136" height="12" rx="6" fill="#f2c2c5"/>
    <path d="M176 160q38 4 34-30-2-14-12-12-6 2-2 12 2 18-22 18z" fill="#f7e8d2" stroke="#5a4535" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M200 126q-4 3-2 8" stroke="#e2b98c" strokeWidth="3" strokeLinecap="round"/>
    <path d="M86 168q-6-52 44-58 50 6 44 58z" fill="#f7e8d2" stroke="#5a4535" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M106 120q4 6 0 12m48-12q-4 6 0 12" stroke="#e2b98c" strokeWidth="3" strokeLinecap="round"/>
    <g transform="translate(98 18)">
      <path d="M8 40 4 8q1-4 5-2l20 16M60 40l4-32q-1-4-5-2L39 22" fill="#f7e8d2" stroke="#5a4535" strokeWidth="3" strokeLinejoin="round"/>
      <path d="m9 13 3 15 9-6zm50 0-3 15-9-6z" fill="#f2a7ae"/>
      <ellipse cx="34" cy="56" rx="34" ry="29" fill="#f7e8d2" stroke="#5a4535" strokeWidth="3"/>
      <path d="M24 30q4 6 0 12m10-13v12m10-11q-4 6 0 12" stroke="#e2b98c" strokeWidth="3" strokeLinecap="round"/>
      <path d="M17 55q5-6 10 0m14 0q5-6 10 0" stroke="#3b2c21" strokeWidth="3.2" strokeLinecap="round"/>
      <ellipse cx="13" cy="64" rx="5.5" ry="3.5" fill="#f4b3b6" opacity=".8"/><ellipse cx="55" cy="64" rx="5.5" ry="3.5" fill="#f4b3b6" opacity=".8"/>
      <path d="m31 61 3 3 3-3z" fill="#e98a93" stroke="#e98a93" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M27 67q3.5 3.5 7 0 3.5 3.5 7 0" stroke="#3b2c21" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M-6 58h12m-11 9 11-3m62-6H62m11 9-11-3" stroke="#5a4535" strokeWidth="2" strokeLinecap="round" opacity=".5"/>
    </g>
    <path d="M94 152q36-14 36 6 0-20 36-6v20q-36-12-36 6 0-18-36-6z" fill="#fffdf8" stroke="#5a4535" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M130 158v20" stroke="#5a4535" strokeWidth="2.4"/>
    <path d="M104 160q10-3 18 0m-18 6q10-3 18 0m16-6q8-3 18 0m-18 6q8-3 18 0" stroke="#c8b9a5" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="100" cy="160" rx="10" ry="8" fill="#f7e8d2" stroke="#5a4535" strokeWidth="3"/>
    <ellipse cx="160" cy="160" rx="10" ry="8" fill="#f7e8d2" stroke="#5a4535" strokeWidth="3"/>
  </svg>;
}
