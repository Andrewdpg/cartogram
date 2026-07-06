export interface TechIcon {
  label: string
  short: string
  fg: string
  bg: string
}

const TECH_ICONS: Record<string, TechIcon> = {
  go: { label: 'Go', short: 'Go', fg: '#00ADD8', bg: '#0b2b30' },
  react: { label: 'React', short: 'Re', fg: '#61DAFB', bg: '#0b2a30' },
  typescript: { label: 'TypeScript', short: 'TS', fg: '#3178C6', bg: '#0e1f33' },
  javascript: { label: 'JavaScript', short: 'JS', fg: '#F7DF1E', bg: '#332f0e' },
  postgresql: { label: 'PostgreSQL', short: 'Pg', fg: '#4169E1', bg: '#101a33' },
  mysql: { label: 'MySQL', short: 'My', fg: '#4479A1', bg: '#101c26' },
  aws: { label: 'AWS', short: 'AWS', fg: '#FF9900', bg: '#2e2109' },
  docker: { label: 'Docker', short: 'Do', fg: '#2496ED', bg: '#0c2436' },
  nodejs: { label: 'Node.js', short: 'Nd', fg: '#5FA04E', bg: '#132211' },
  python: { label: 'Python', short: 'Py', fg: '#3776AB', bg: '#0f1d2e' },
}

const FALLBACK_ICON: TechIcon = { label: 'Unknown tech', short: '?', fg: '#9096a8', bg: '#23252c' }

// ponytail: colored monogram badges instead of real vector brand logos —
// avoids a new dependency (e.g. simple-icons) whose exact export API
// changes across major versions, and avoids hand-transcribing SVG path
// data that can't be visually verified here. Swap this file's internals
// for real logos later if wanted; callers only ever see `getTechIcon`.
export function getTechIcon(id: string): TechIcon {
  return TECH_ICONS[id.toLowerCase()] ?? FALLBACK_ICON
}
