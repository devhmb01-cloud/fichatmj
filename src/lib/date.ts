export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function calculateAge(value: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day ||
    value > todayISO(now)
  )
    return null;
  return (
    now.getFullYear() -
    year -
    (now.getMonth() + 1 < month ||
    (now.getMonth() + 1 === month && now.getDate() < day)
      ? 1
      : 0)
  );
}
