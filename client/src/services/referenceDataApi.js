import { api } from "./api";

const CACHE_TTL_MS = 30_000;
const cache = new Map();

async function getReferenceData(key, path, { force = false } = {}) {
  if (force) cache.delete(key);

  const cached = cache.get(key);
  if (cached?.promise) return cached.promise;
  if (cached?.data && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const promise = api
    .get(path)
    .then((response) => {
      cache.set(key, { data: response.data, cachedAt: Date.now() });
      return response.data;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise });
  return promise;
}

export const getStations = (options) =>
  getReferenceData("stations", "/stations", options);
export const getTrains = (options) =>
  getReferenceData("trains", "/trains", options);
export const getRoutes = (options) =>
  getReferenceData("routes", "/routes", options);
export const getSchedules = (options) =>
  getReferenceData("schedules", "/schedules", options);
