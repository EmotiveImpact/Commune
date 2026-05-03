export function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function getRecentMonthKeys(count: number) {
  const today = new Date();
  const months: string[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    months.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  }

  return months;
}

export function formatMonthLabel(monthKey: string) {
  return new Date(`${monthKey}-01`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}
