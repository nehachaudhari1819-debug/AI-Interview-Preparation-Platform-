export function deepFreeze<T extends object>(value: T): Readonly<T> {
  for (const key of Object.getOwnPropertyNames(value)) {
    const prop = (value as Record<string, unknown>)[key];

    if (prop !== null && typeof prop === "object") {
      deepFreeze(prop as object);
    }
  }

  return Object.freeze(value);
}
