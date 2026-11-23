// Shared button looks (prototype: #0E5E52 accent, 10px radius, 54px main buttons).
const base =
  'inline-flex items-center justify-center gap-2 rounded-[10px] px-5 font-bold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export const btn = {
  primary: `${base} min-h-14 bg-accent text-white text-lg hover:bg-[#09443B]`,
  secondary: `${base} min-h-12 border border-accent text-accent bg-white hover:bg-[#E6F1EE]`,
  ghost: `${base} min-h-11 text-accent hover:bg-[#E6F1EE]`,
}
