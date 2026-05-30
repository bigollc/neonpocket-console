function hasUnsafePathCharacter(value: string) {
  return Array.from(value).some(char => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 || char === "/" || char === "?" || char === "#" || char === "\\";
  });
}

export function neonPathSegment(value: string | number | boolean) {
  const segment = String(value).trim();

  if (!segment || segment === "." || segment === ".." || hasUnsafePathCharacter(segment)) {
    throw new Error("Invalid Neon API path segment");
  }

  return encodeURIComponent(segment);
}
