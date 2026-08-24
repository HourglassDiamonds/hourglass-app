export function formatMatchCode(code: string): string {
  if (!/^\d{6}$/.test(code)) return code;
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
