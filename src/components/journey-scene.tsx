export function JourneyScene({className = ''}: {className?: string}) {
  return <svg className={className} viewBox="0 0 450 320" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="mountain" x1="240" y1="95" x2="240" y2="290" gradientUnits="userSpaceOnUse"><stop stopColor="#8caaa0"/><stop offset="1" stopColor="#c4d7c7"/></linearGradient>
      <linearGradient id="path" x1="265" y1="240" x2="255" y2="330" gradientUnits="userSpaceOnUse"><stop stopColor="#f0e6cc"/><stop offset="1" stopColor="#fbf6e9"/></linearGradient>
    </defs>
    <circle cx="293" cy="85" r="48" fill="#e6bd7b" opacity=".75"/>
    <path d="M50 239 218 63 392 244" fill="url(#mountain)"/>
    <path d="m218 63-54 57 33-8 20 12 20-11 40 14z" fill="#f9faf0"/>
    <path d="M0 248q99-59 206-10t244-17v99H0z" fill="#b5cbb7"/>
    <path d="M0 278q111-58 232-9t218-21v72H0z" fill="#8eaf95"/>
    <path d="M244 252q-12 18 15 30t-10 38h96q32-20-23-38t-53-30" fill="url(#path)"/>
    <g fill="#3d6656"><path d="m369 158-30 55h16l-26 39h78l-28-39h18z"/><rect x="367" y="235" width="6" height="42" rx="3"/><path d="m89 187-23 40h13l-23 30h65l-24-30h13z"/><rect x="86" y="249" width="5" height="28" rx="2"/></g>
    <g fill="#b37453"><path d="m228 161 9 4-6 94h-7zm64 4 9-4 4 98h-7z"/><path d="M216 147q48 11 99 0l-3 13q-48 8-92 0z"/><path d="M226 180h77v8h-77z"/><path d="M259 160h10v24h-10z"/></g>
    <path d="M203 261q54-17 116 0" stroke="#f5f0df" strokeWidth="3" strokeLinecap="round"/>
    <g stroke="#627c6d" strokeWidth="2.5" strokeLinecap="round"><path d="m331 83 7-3 7 3m-202 39 6-3 6 3m160-13 6-3 6 3"/></g>
    <g fill="#e4ead6"><circle cx="37" cy="250" r="4"/><circle cx="47" cy="243" r="3"/><circle cx="403" cy="284" r="3"/><circle cx="413" cy="290" r="4"/></g>
    <path d="M18 309h63m-50-9h17m293 11h45" stroke="#638b71" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}
