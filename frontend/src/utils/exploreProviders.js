export const CATEGORIES = ["All", "Plumbing", "Electrical", "Cleaning", "Painting", "Gardening", "Appliance Repair"];
export const SORT_OPTIONS = {
  name: "Name",
  nearest: "Nearest",
  rating: "Top rated",
  price: "Lowest price"
};
export const EMPTY_FILTERS = {
  maxPrice: "",
  minRating: 0,
  availableToday: false,
  area: ""
};
export function distanceKm(provider, location) {
  if (!location || ![provider.latitude, provider.longitude, location.latitude, location.longitude].every(Number.isFinite)) return null;
  const rad = value => value * Math.PI / 180;
  const a = Math.sin(rad(provider.latitude - location.latitude) / 2) ** 2 + Math.cos(rad(location.latitude)) * Math.cos(rad(provider.latitude)) * Math.sin(rad(provider.longitude - location.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
export function availableToday(value, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  return date >= now && date.toDateString() === now.toDateString();
}
export function filterProviders(providers, {
  query = "",
  category = "All",
  filters = EMPTY_FILTERS,
  sort = "name",
  location = null,
  now = new Date()
} = {}) {
  const needle = query.trim().toLowerCase();
  const area = filters.area.trim().toLowerCase();
  return providers.map(p => ({
    ...p,
    price: p.pricing ? (p.pricing.type === 'fixed' ? p.pricing.amountMinor / 100 : p.pricing.type === 'estimate' ? p.pricing.maxMinor / 100 : null) : p.price,
    distance: distanceKm(p, location)
  })).filter(p => (category === "All" || p.category.toLowerCase() === category.toLowerCase()) && (!needle || `${p.name} ${p.category} ${p.serviceArea}`.toLowerCase().includes(needle)) && (!area || p.serviceArea.toLowerCase().includes(area)) && (filters.maxPrice === "" || Number.isFinite(p.price) && p.price <= Number(filters.maxPrice)) && (!filters.minRating || Number.isFinite(p.rating) && p.rating >= filters.minRating) && (!filters.availableToday || availableToday(p.nextAvailableAt, now))).sort((a, b) => {
    const fallback = a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    if (sort === "nearest") return (a.distance ?? Infinity) - (b.distance ?? Infinity) || fallback;
    if (sort === "price") return (a.price ?? Infinity) - (b.price ?? Infinity) || fallback;
    if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1) || fallback;
    return fallback;
  });
}
export function availabilityLabel(value) {
  if (!value) return "Ask about availability";
  const date = new Date(value),
    now = new Date();
  if (!Number.isFinite(date.getTime()) || date < now) return "Ask about availability";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = date.toDateString() === now.toDateString() ? "Today" : date.toDateString() === tomorrow.toDateString() ? "Tomorrow" : date.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric"
  });
  return `${day}, ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  })}`;
}
