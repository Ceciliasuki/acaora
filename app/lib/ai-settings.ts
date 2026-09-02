export const aiKeyStorageKey = "statlab-deepseek-key";
const aiKeyChangeEvent = "acaora:ai-key-change";

export function readAiKey() {
  try {
    return sessionStorage.getItem(aiKeyStorageKey) ?? "";
  } catch {
    return "";
  }
}

export function saveAiKey(value: string) {
  const normalized = value.trim();
  if (normalized) sessionStorage.setItem(aiKeyStorageKey, normalized);
  else sessionStorage.removeItem(aiKeyStorageKey);
  window.dispatchEvent(new Event(aiKeyChangeEvent));
}

export function clearAiKey() {
  try {
    sessionStorage.removeItem(aiKeyStorageKey);
    window.dispatchEvent(new Event(aiKeyChangeEvent));
  } catch {
    // Storage may be unavailable in hardened/private browsing contexts.
  }
}

export function subscribeAiKey(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(aiKeyChangeEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(aiKeyChangeEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function getServerAiKeySnapshot() {
  return "";
}
