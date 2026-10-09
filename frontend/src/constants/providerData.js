// ---------------------------------------------------------------------------
// Mock data for the service provider screens.
// Replace with real API data (providerService) once the backend is ready.
// ---------------------------------------------------------------------------

export const PROVIDER = {
  category: "Plumbing",
  area: "Nugegoda, Colombo",
  experience: "11 yrs experience",
  jobsDone: 412,
  acceptance: 94,
  rating: 4.9,
  reviews: 128,
  verified: true,
};

export const EARNINGS = {
  week: 46200,
  weekGrowth: 18,
  pendingPayout: 12700,
  month: 184500,
  weeks: [
    { label: "W1", amount: 41200 },
    { label: "W2", amount: 47800 },
    { label: "W3", amount: 49300 },
    { label: "W4", amount: 46200 },
  ],
};

export const TODAY_SCHEDULE = [
  {
    id: "s1",
    time: "9:00",
    period: "AM",
    title: "Water pump installation",
    customer: "Ishara Rathnayake",
    jobId: "JB-7736",
    status: "In Progress",
  },
  {
    id: "s2",
    time: "11:00",
    period: "AM",
    title: "Leak & tap repair",
    customer: "Nadeesha Wijesinghe",
    jobId: "JB-7741",
    status: "Upcoming",
  },
  {
    id: "s3",
    time: "2:30",
    period: "PM",
    title: "Bathroom fitting",
    customer: "Mohamed Rizwan",
    jobId: "JB-7744",
    status: "Upcoming",
  },
  {
    id: "s4",
    time: "4:30",
    period: "PM",
    title: "Pipe replacement",
    customer: "Kasun Perera",
    jobId: "JB-7749",
    status: "Upcoming",
  },
];

export const INITIAL_REQUESTS = [
  {
    id: "r1",
    customer: "Thilini Abeysekara",
    service: "Burst pipe repair",
    urgent: true,
    description:
      "Water is leaking heavily from the pipe behind the washing machine. We have shut the main valve, so there is no water in the house right now. Please come as soon as possible.",
    date: "Today, 15 Sep",
    time: "6:30 PM onwards",
    location: "Pagoda Road, Nugegoda · 1.8 km",
    price: 4500,
    photos: 2,
  },
  {
    id: "r2",
    customer: "Mohamed Rizwan",
    service: "Bathroom fitting replacement",
    urgent: false,
    description:
      "Need the shower mixer and two taps replaced in the upstairs bathroom. Fittings already purchased.",
    date: "Wed, 17 Sep",
    time: "10:00 AM – 12:00 PM",
    location: "Kirulapone, Colombo 06 · 4.3 km",
    price: 6000,
    photos: 1,
  },
  {
    id: "r3",
    customer: "Dilani Jayawardena",
    service: "Water heater servicing",
    urgent: false,
    description:
      "The electric water heater takes very long to warm up and trips the breaker sometimes. Needs a check and a service.",
    date: "Thu, 18 Sep",
    time: "2:00 PM – 4:00 PM",
    location: "Havelock Town, Colombo 05 · 5.6 km",
    price: 3500,
    photos: 0,
  },
];

export const CONVERSATIONS = [
  {
    id: "c1",
    name: "Nadeesha Wijesinghe",
    context: "Leak & tap repair · JB-7741",
    preview: "The gate will be open, just ring the bell when you arrive.",
    time: "10:52",
    unread: 1,
  },
  {
    id: "c2",
    name: "Ishara Rathnayake",
    context: "Water pump installation · JB-7736",
    preview: "Thank you for coming early today.",
    time: "09:15",
    unread: 0,
  },
  {
    id: "c3",
    name: "ServiHome Provider Care",
    context: "Platform support",
    preview: "Your weekly payout of LKR 38,400 was settled to your bank account.",
    time: "Mon",
    unread: 0,
  },
];

export const SERVICES = [
  { id: "sv1", name: "Leak & tap repair", unit: "per fitting", price: 1800 },
  { id: "sv2", name: "Pipe replacement", unit: "per metre", price: 4500 },
  { id: "sv3", name: "Water pump installation", unit: "per job", price: 6500 },
  { id: "sv4", name: "Bathroom fitting", unit: "per job", price: 8000 },
  { id: "sv5", name: "Drain unblocking", unit: "per visit", price: 2500 },
];

// Weekly availability template. Keys are weekday numbers (0 = Sunday).
// Times are minutes from midnight.
const t = (h, m = 0) => h * 60 + m;

export const SLOT_TEMPLATES = {
  0: [],
  1: [
    { start: t(9), end: t(11), type: "booked", title: "Water pump installation", customer: "Ishara Rathnayake" },
    { start: t(13), end: t(15), type: "available", title: "Open for bookings" },
    { start: t(15, 30), end: t(17, 30), type: "booked", title: "Pipe replacement", customer: "Kasun Perera" },
  ],
  2: [
    { start: t(8), end: t(10), type: "available", title: "Open for bookings" },
    { start: t(10, 30), end: t(12, 30), type: "booked", title: "Bathroom fitting", customer: "Mohamed Rizwan" },
    { start: t(14), end: t(16), type: "available", title: "Open for bookings" },
  ],
  3: [
    { start: t(8), end: t(10), type: "available", title: "Open for bookings" },
    { start: t(10, 30), end: t(12, 30), type: "available", title: "Open for bookings" },
    { start: t(14), end: t(16), type: "available", title: "Open for bookings" },
  ],
  4: [
    { start: t(9), end: t(11), type: "available", title: "Open for bookings" },
    { start: t(13), end: t(15), type: "available", title: "Open for bookings" },
  ],
  5: [
    { start: t(8), end: t(10), type: "booked", title: "Leak & tap repair", customer: "Nadeesha Wijesinghe" },
    { start: t(11), end: t(13), type: "available", title: "Open for bookings" },
  ],
  6: [
    { start: t(9), end: t(11), type: "available", title: "Open for bookings" },
    { start: t(12), end: t(14), type: "available", title: "Open for bookings" },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export const formatMoney = (n) => `LKR ${Number(n).toLocaleString("en-US")}`;

export const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

// Totals use provider-confirmed receipts, never accepted quotes or unpaid work.
export const sriLankaDay = value => new Date(new Date(value).getTime() + 19800000).toISOString().slice(0, 10);
export function providerMetrics(bookings, now = new Date()) {
  const today = sriLankaDay(now), local = new Date(today + 'T00:00:00Z');
  const monday = new Date(local); monday.setUTCDate(local.getUTCDate() - (local.getUTCDay() + 6) % 7);
  const weekStart = monday.toISOString().slice(0, 10), month = today.slice(0, 7);
  const amount = b => Number.isSafeInteger(b.invoice?.totalMinor) ? b.invoice.totalMinor : 0;
  const receipts = bookings.filter(b => b.invoice && b.payment?.status === 'paid' && b.payment?.paidAt && Number.isFinite(Date.parse(b.payment.paidAt)) && new Date(b.payment.paidAt) <= now);
  const inMonth = receipts.filter(b => sriLankaDay(b.payment.paidAt).startsWith(month));
  const active = bookings.filter(b => ['awaiting_quote', 'confirmed', 'inspection_confirmed', 'inspecting', 'quote_pending', 'ongoing'].includes(b.status));
  const weeks = Array.from({ length: 5 }, (_, i) => ({ label: `${i * 7 + 1}–${Math.min(i * 7 + 7, new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate())}`, amount: inMonth.filter(b => Math.floor((Number(sriLankaDay(b.payment.paidAt).slice(8)) - 1) / 7) === i).reduce((n, b) => n + amount(b), 0) })).filter((_, i) => i < 4 || new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate() > 28);
  return {
    today: bookings.filter(b => b.scheduleConfirmed && !['pending', 'time_proposed', 'cancelled', 'rejected'].includes(b.status) && sriLankaDay(b.startsAt) === today).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
    active, completed: bookings.filter(b => b.status === 'completed').length,
    weekReceived: receipts.filter(b => sriLankaDay(b.payment.paidAt) >= weekStart).reduce((n, b) => n + amount(b), 0),
    monthReceived: inMonth.reduce((n, b) => n + amount(b), 0), weeks,
    awaiting: bookings.filter(b => b.invoice && b.payment?.status === 'awaiting_confirmation').reduce((n, b) => n + amount(b), 0),
    unpaid: bookings.filter(b => b.invoice && (!b.payment || b.payment.status === 'unpaid')).reduce((n, b) => n + amount(b), 0),
    invoices: bookings.filter(b => b.invoice).sort((a, b) => new Date(b.payment?.paidAt || b.invoice.issuedAt) - new Date(a.payment?.paidAt || a.invoice.issuedAt)),
  };
}
