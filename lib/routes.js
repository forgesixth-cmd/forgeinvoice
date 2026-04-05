export const BASE_PATH = "/forgeinvoice";

export function withBasePath(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedPath === "/" ? BASE_PATH : `${BASE_PATH}${normalizedPath}`;
}

export function getAbsoluteAppUrl(path = "/") {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${withBasePath(path)}`;
}

