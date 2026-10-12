// Input limits keep the redesigned cards and rows readable. The local API
// enforces the same or tighter bounds before storing shared content.
export const LIMITS = {
  communeName: 48,
  address: 160,
  destination: 80,
  stayName: 80,
  expenseTitle: 80,
  fundName: 80,
  noteTitle: 80,
  noteDetail: 120,
  noteBody: 2000,
  operationTitle: 80,
  operationNotes: 1000,
  announcementTitle: 80,
  announcementBody: 1000,
  userName: 80,
  email: 254,
  search: 100,
  // Long enough for the largest amount the database accepts: 10,000,000,000.00.
  money: 17,
} as const;
