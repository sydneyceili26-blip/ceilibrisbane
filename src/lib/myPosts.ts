// Tracks IDs of questions/answers created on this device, so we can show a
// delete option for the original poster (anonymous community is keyed locally).

const KEYS = {
  question: "ceili.myQuestions",
  answer: "ceili.myAnswers",
} as const;

type Kind = keyof typeof KEYS;

const read = (kind: Kind): string[] => {
  try {
    const raw = localStorage.getItem(KEYS[kind]);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const write = (kind: Kind, ids: string[]) => {
  try { localStorage.setItem(KEYS[kind], JSON.stringify(ids.slice(-500))); } catch { /* ignore */ }
};

export const rememberMyPost = (kind: Kind, id: string) => {
  const ids = read(kind);
  if (!ids.includes(id)) write(kind, [...ids, id]);
};

export const forgetMyPost = (kind: Kind, id: string) => {
  write(kind, read(kind).filter((x) => x !== id));
};

export const isMyPost = (kind: Kind, id: string) => read(kind).includes(id);
