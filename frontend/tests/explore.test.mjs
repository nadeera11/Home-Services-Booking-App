import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/utils/exploreProviders.js", import.meta.url), "utf8");
const { filterProviders, distanceKm, EMPTY_FILTERS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const now = new Date(2026, 9, 6, 10);
const providers = [
  { id: "1", name: "Arjun", category: "Plumbing", serviceArea: "Colombo", price: 2500, rating: 4.9, latitude: 6.93, longitude: 79.85, nextAvailableAt: new Date(2026, 9, 6, 14).toISOString() },
  { id: "2", name: "Dilani", category: "Cleaning", serviceArea: "Kandy", price: 4500, rating: 4.7, latitude: 7.29, longitude: 80.63, nextAvailableAt: new Date(2026, 9, 5, 14).toISOString() },
  { id: "3", name: "Amal", category: "Plumbing", serviceArea: "", price: null, rating: null, latitude: null, longitude: null, nextAvailableAt: null },
];
test("search is case insensitive and combines with category", () => {
  assert.deepEqual(filterProviders(providers, { query: " ARJUN ", category: "Plumbing" }).map(p => p.id), ["1"]);
  assert.equal(filterProviders(providers, { query: "arjun", category: "Cleaning" }).length, 0);
  assert.equal(filterProviders(providers, { query: "plumbing" }).length, 2);
});
test("filters exclude unknown prices and ratings; today excludes past availability", () => {
  assert.deepEqual(filterProviders(providers, { filters: { ...EMPTY_FILTERS, maxPrice: "3000", minRating: 4.5, availableToday: true }, now }).map(p => p.id), ["1"]);
  assert.equal(filterProviders(providers, { filters: { ...EMPTY_FILTERS, area: "kandy" } })[0].id, "2");
  assert.equal(filterProviders(providers, { filters: { ...EMPTY_FILTERS, maxPrice: "0" } }).length, 0);
});
test("nearest uses real coordinates and unknowns sort last", () => {
  const location = { latitude: 6.93, longitude: 79.85 };
  assert.equal(distanceKm(providers[0], location), 0);
  assert.equal(distanceKm(providers[2], location), null);
  assert.deepEqual(filterProviders(providers, { sort: "nearest", location }).map(p => p.id), ["1", "2", "3"]);
});
test("sorting handles missing data and never changes the source array", () => {
  assert.deepEqual(filterProviders(providers, { sort: "price" }).map(p => p.id), ["1", "2", "3"]);
  assert.deepEqual(filterProviders(providers, { sort: "rating" }).map(p => p.id), ["1", "2", "3"]);
  assert.deepEqual(filterProviders(providers).map(p => p.id), ["3", "1", "2"]);
  assert.deepEqual(providers.map(p => p.id), ["1", "2", "3"]);
});
