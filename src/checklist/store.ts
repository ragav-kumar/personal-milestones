const MODULE_ID = "personal-milestones";
const CHECKLIST_FLAG_KEY = "checklist";

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  order: number;
}

export interface ChecklistState {
  items: ChecklistItem[];
}

function asChecklistItem(item: unknown, index: number): ChecklistItem | null {
  if (!item || typeof item !== "object") return null;
  const candidate = item as Partial<ChecklistItem>;

  if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;
  if (typeof candidate.label !== "string") return null;

  return {
    id: candidate.id,
    label: candidate.label,
    completed: Boolean(candidate.completed),
    order: Number.isFinite(candidate.order) ? Number(candidate.order) : index
  };
}

function normalize(state: unknown): ChecklistState {
  if (!state || typeof state !== "object") return { items: [] };
  const rawItems = (state as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) return { items: [] };

  const items = rawItems
    .map((item, index) => asChecklistItem(item, index))
    .filter((item): item is ChecklistItem => item !== null)
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));

  return { items };
}

export async function getChecklistState(actor: Actor): Promise<ChecklistState> {
  const flag = actor.getFlag(MODULE_ID, CHECKLIST_FLAG_KEY);
  return normalize(flag);
}

export async function setChecklistState(actor: Actor, state: ChecklistState): Promise<void> {
  const normalized = normalize(state);
  await actor.setFlag(MODULE_ID, CHECKLIST_FLAG_KEY, normalized);
}

export function makeChecklistItem(label: string, order: number): ChecklistItem {
  return {
    id: foundry.utils.randomID(),
    label,
    completed: false,
    order
  };
}
