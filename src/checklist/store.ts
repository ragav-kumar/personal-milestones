import {
  getGlobalMilestoneTemplates,
  getLevelRequirementTable,
  type GlobalMilestoneTemplate
} from "./settings";

const MODULE_ID = "personal-milestones";
const CHECKLIST_FLAG_KEY = "checklist";

export type MilestoneSource = "global" | "actor";

export interface ChecklistItem {
  id: string;
  section: string;
  label: string;
  source: MilestoneSource;
  completed: boolean;
  sourceOrder: number;
  createdAt?: number;
  firstClaimedAt?: number;
}

export interface ChecklistState {
  version: number;
  items: ChecklistItem[];
  progress: {
    level: number;
    claimedIds: string[];
  };
}

export interface MilestoneProgress {
  currentLevel: number;
  required: number;
  claimed: number;
}

type ActorFlagAdapter = {
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
};

type ActorUpdateAdapter = {
  update(data: Record<string, unknown>): Promise<unknown>;
  system?: Record<string, unknown>;
  classes?: Record<string, { system?: { levels?: number } }>;
};

// Defensive normalization of persisted Actor flag data.
function asChecklistItem(item: unknown, index: number): ChecklistItem | null {
  if (!item || typeof item !== "object") return null;
  const candidate = item as Partial<ChecklistItem>;

  if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;
  if (typeof candidate.section !== "string" || candidate.section.length === 0) return null;
  if (typeof candidate.label !== "string" || candidate.label.length === 0) return null;
  if (candidate.source !== "global" && candidate.source !== "actor") return null;

  return {
    id: candidate.id,
    section: candidate.section,
    label: candidate.label,
    source: candidate.source,
    completed: Boolean(candidate.completed),
    sourceOrder: Number.isFinite(candidate.sourceOrder) ? Number(candidate.sourceOrder) : index,
    createdAt: Number.isFinite(candidate.createdAt) ? Number(candidate.createdAt) : undefined,
    firstClaimedAt: Number.isFinite(candidate.firstClaimedAt) ? Number(candidate.firstClaimedAt) : undefined
  };
}

// dnd5e can represent level as details.level or by summing class levels for multiclass actors.
function getCurrentLevel(actor: Actor): number {
  const actorLike = actor as ActorUpdateAdapter;
  const details = actorLike.system?.details as { level?: unknown } | undefined;
  const directLevel = Number(details?.level);
  if (Number.isFinite(directLevel) && directLevel > 0) return Math.trunc(directLevel);

  const classes = actorLike.classes;
  if (classes && typeof classes === "object") {
    const total = Object.values(classes).reduce((sum, cls) => {
      const levels = Number(cls?.system?.levels ?? 0);
      return sum + (Number.isFinite(levels) ? levels : 0);
    }, 0);
    if (total > 0) return Math.trunc(total);
  }

  return 1;
}

// Build a stable in-memory shape regardless of legacy/partial flag payloads.
function normalizeBaseState(state: unknown, level: number): ChecklistState {
  if (!state || typeof state !== "object") {
    return {
      version: 2,
      items: [],
      progress: { level, claimedIds: [] }
    };
  }

  const raw = state as {
    version?: unknown;
    items?: unknown;
    progress?: { level?: unknown; claimedIds?: unknown };
  };

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems
    .map((item, index) => asChecklistItem(item, index))
    .filter((item): item is ChecklistItem => item !== null)
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .map((item, index) => ({ ...item, sourceOrder: index }));

  const progressLevel = Number(raw.progress?.level);
  const claimedIdsRaw = Array.isArray(raw.progress?.claimedIds) ? raw.progress?.claimedIds : [];
  const claimedIds = claimedIdsRaw.filter((id): id is string => typeof id === "string");

  return {
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 2,
    items,
    progress: {
      level: Number.isFinite(progressLevel) && progressLevel > 0 ? Math.trunc(progressLevel) : level,
      claimedIds
    }
  };
}

// Merge global templates into actor state while preserving completion and first-claim timestamps.
function applyGlobalTemplates(items: ChecklistItem[], templates: GlobalMilestoneTemplate[]): ChecklistItem[] {
  const existingById = new Map(items.map((item) => [item.id, item]));
  const actorSpecific = items.filter((item) => item.source === "actor");

  const globals = templates.map((template) => {
    const existing = existingById.get(template.id);
    return {
      id: template.id,
      section: template.section,
      label: template.label,
      source: "global" as const,
      completed: existing?.completed ?? false,
      sourceOrder: template.sourceOrder,
      firstClaimedAt: existing?.firstClaimedAt
    };
  });

  const merged = [...globals, ...actorSpecific]
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .map((item, index) => ({ ...item, sourceOrder: index }));

  return merged;
}

// When level changes, clear only the claimed counter (not completion history).
function ensureProgressLevel(state: ChecklistState, level: number): ChecklistState {
  if (state.progress.level === level) return state;

  return {
    ...state,
    progress: {
      level,
      claimedIds: []
    }
  };
}

function dedupeClaimedIds(claimedIds: string[], validIds: Set<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of claimedIds) {
    if (!validIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

async function writeState(actor: Actor, state: ChecklistState): Promise<void> {
  await (actor as ActorFlagAdapter).setFlag(MODULE_ID, CHECKLIST_FLAG_KEY, state);
}

/**
 * Read and normalize actor milestone state from Actor flags.
 *
 * Foundry-ism: Actor flags are the easiest per-actor persistence layer for custom module data.
 */
export async function getChecklistState(actor: Actor): Promise<ChecklistState> {
  const level = getCurrentLevel(actor);
  const rawFlag = (actor as ActorFlagAdapter).getFlag(MODULE_ID, CHECKLIST_FLAG_KEY);
  let state = normalizeBaseState(rawFlag, level);

  state.items = applyGlobalTemplates(state.items, getGlobalMilestoneTemplates());
  state = ensureProgressLevel(state, level);

  const validIds = new Set(state.items.map((item) => item.id));
  state.progress.claimedIds = dedupeClaimedIds(state.progress.claimedIds, validIds);

  await writeState(actor, state);
  return state;
}

/**
 * Write actor milestone state with global sync and progress guardrails applied.
 */
export async function setChecklistState(actor: Actor, state: ChecklistState): Promise<void> {
  const level = getCurrentLevel(actor);
  const normalized = ensureProgressLevel(
    {
      ...normalizeBaseState(state, level),
      items: applyGlobalTemplates(state.items, getGlobalMilestoneTemplates())
    },
    level
  );

  const validIds = new Set(normalized.items.map((item) => item.id));
  normalized.progress.claimedIds = dedupeClaimedIds(normalized.progress.claimedIds, validIds);
  await writeState(actor, normalized);
}

export function makeActorMilestone(section: string, label: string, sourceOrder: number): ChecklistItem {
  return {
    id: foundry.utils.randomID(),
    section,
    label,
    source: "actor",
    completed: false,
    sourceOrder,
    createdAt: Date.now()
  };
}

export function getProgress(actor: Actor, state: ChecklistState): MilestoneProgress {
  const currentLevel = getCurrentLevel(actor);
  const requiredTable = getLevelRequirementTable();
  const required = requiredTable[currentLevel] ?? currentLevel + 1;

  return {
    currentLevel,
    required,
    claimed: state.progress.claimedIds.length
  };
}

function actorHasInspiration(actor: Actor): boolean {
  const system = (actor as ActorUpdateAdapter).system;
  const attributes = system?.attributes as { inspiration?: unknown } | undefined;
  const inspiration = attributes?.inspiration;

  if (typeof inspiration === "boolean") return inspiration;
  if (typeof inspiration === "number") return inspiration > 0;
  return Boolean(inspiration);
}

async function grantInspiration(actor: Actor): Promise<void> {
  const actorLike = actor as ActorUpdateAdapter;
  const current = (actorLike.system?.attributes as { inspiration?: unknown } | undefined)?.inspiration;

  if (typeof current === "number") {
    await actorLike.update({ "system.attributes.inspiration": 1 });
    return;
  }

  await actorLike.update({ "system.attributes.inspiration": true });
}

/**
 * Toggle one milestone and apply side effects:
 * - claimed counter updates
 * - chat message
 * - first-claim inspiration grant if actor currently lacks inspiration
 */
export async function toggleMilestone(actor: Actor, milestoneId: string, checked: boolean): Promise<ChecklistState> {
  const state = await getChecklistState(actor);
  const item = state.items.find((entry) => entry.id === milestoneId);
  if (!item) return state;

  const wasCompleted = item.completed;
  item.completed = checked;

  const claimed = new Set(state.progress.claimedIds);
  if (checked) claimed.add(milestoneId);
  else claimed.delete(milestoneId);
  state.progress.claimedIds = [...claimed];

  const firstCheck = !item.firstClaimedAt && checked;
  if (firstCheck) item.firstClaimedAt = Date.now();

  await setChecklistState(actor, state);

  const progress = getProgress(actor, state);
  const action = checked ? "claimed" : "unchecked";
  const content = `${actor.name} ${action} milestone: <strong>${item.label}</strong> (${item.section}) - Progress ${progress.claimed}/${progress.required}`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });

  if (firstCheck && !actorHasInspiration(actor)) {
    await grantInspiration(actor);
  }

  if (wasCompleted !== checked) {
    ui.notifications?.info(`Milestone ${checked ? "claimed" : "unchecked"}: ${item.label}`);
  }

  return state;
}

export async function addActorSpecificMilestone(actor: Actor, section: string, label: string): Promise<ChecklistState> {
  const state = await getChecklistState(actor);
  const nextOrder = state.items.length;
  state.items.push(makeActorMilestone(section, label, nextOrder));
  await setChecklistState(actor, state);
  return state;
}

export async function removeActorSpecificMilestone(actor: Actor, milestoneId: string): Promise<ChecklistState> {
  const state = await getChecklistState(actor);
  const target = state.items.find((item) => item.id === milestoneId);
  if (!target || target.source !== "actor") return state;

  state.items = state.items
    .filter((item) => item.id !== milestoneId)
    .map((item, index) => ({ ...item, sourceOrder: index }));
  state.progress.claimedIds = state.progress.claimedIds.filter((id) => id !== milestoneId);

  await setChecklistState(actor, state);
  return state;
}

export async function resetProgressCounter(actor: Actor): Promise<ChecklistState> {
  const state = await getChecklistState(actor);
  state.progress.claimedIds = [];
  state.progress.level = getCurrentLevel(actor);
  await setChecklistState(actor, state);
  return state;
}
