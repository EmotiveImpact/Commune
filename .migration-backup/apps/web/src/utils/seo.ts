export function setPageTitle(title: string) {
  document.title = title
    ? `${title} \u00b7 Commune`
    : 'Commune \u2014 Shared Expense Management';
}
