export function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    const time = date.toLocaleString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `오늘 ${time}`;
  }
  if (diffDays === 1) return "어제";
  if (diffDays > 1 && diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}
