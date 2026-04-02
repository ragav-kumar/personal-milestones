const MODULE_ID = "personal-milestones";

export const SETTINGS_KEYS = {
  topMatter: "topMatterMarkdown",
  milestonesJson: "globalMilestonesJson",
  requirementsJson: "levelRequirementsJson"
} as const;

export interface MilestoneSectionInput {
  section: string;
  items: string[];
}

export interface GlobalMilestoneTemplate {
  id: string;
  section: string;
  label: string;
  sourceOrder: number;
}

type FoundrySettingsRegisterData = {
  name: string;
  hint: string;
  scope: "world" | "client";
  config: boolean;
  type: StringConstructor;
  default: string;
};

type FoundrySettingsAdapter = {
  register(namespace: string, key: string, data: FoundrySettingsRegisterData): void;
  get(namespace: string, key: string): unknown;
};

const DEFAULT_TOP_MATTER = [
  "Track personal milestones for your character.",
  "",
  "- Check milestones as they are achieved.",
  "- Progress shown here is milestones claimed since your last level-up reset.",
  "- Ask your GM to add character-specific milestones when needed."
].join("\n");

const DEFAULT_SECTIONS: MilestoneSectionInput[] = [
  {
    section: "Combat",
    items: [
      "Contribute significantly to a combat objective using your primary skillset.",
      "Coordinate with an ally in combat to accomplish a goal.",
      "Achieve victory in combat despite being injured, disadvantaged, or out of resources."
    ]
  },
  {
    section: "Social",
    items: [
      "Address a truth, secret, or personal belief in conversation.",
      "Commit to or reject a cause, faction, or principle, with public consequences.",
      "Leverage your background to accomplish a goal."
    ]
  },
  {
    section: "Exploration",
    items: [
      "Discover new lore, history, or a hidden truth that changes your perspective.",
      "Overcome an environmental hazard through planning or ingenuity.",
      "Make progress toward a personal objective outside direct combat."
    ]
  }
];

function defaultRequirementsJson(): string {
  const table: Record<string, number> = {};
  for (let level = 1; level <= 20; level += 1) {
    table[String(level)] = level + 1;
  }
  return JSON.stringify(table, null, 2);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function getSettingsAdapter(): FoundrySettingsAdapter | null {
  const settings = game.settings;
  if (!settings) return null;
  return settings as unknown as FoundrySettingsAdapter;
}

/**
 * Register world-scoped module settings in Foundry.
 *
 * Foundry's v13 community typings are stricter than runtime behavior for custom setting keys,
 * so registration/get calls use narrow casts where necessary.
 */
export function registerMilestoneSettings(): void {
  const settings = getSettingsAdapter();
  if (!settings) return;

  settings.register(MODULE_ID, SETTINGS_KEYS.topMatter, {
    name: "Milestones Top Matter",
    hint: "Markdown text shown at the top of the Milestones tab.",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_TOP_MATTER
  });

  settings.register(MODULE_ID, SETTINGS_KEYS.milestonesJson, {
    name: "Global Milestones (JSON)",
    hint: "Sectioned default milestones. Structure: [{ section: string, items: string[] }].",
    scope: "world",
    config: true,
    type: String,
    default: JSON.stringify(DEFAULT_SECTIONS, null, 2)
  });

  settings.register(MODULE_ID, SETTINGS_KEYS.requirementsJson, {
    name: "Level Requirements (JSON)",
    hint: "Milestones required by current level. Example: { \"2\": 3, \"3\": 4 }",
    scope: "world",
    config: true,
    type: String,
    default: defaultRequirementsJson()
  });
}

export function getTopMatterMarkdown(): string {
  const settings = getSettingsAdapter();
  if (!settings) return DEFAULT_TOP_MATTER;

  const value = settings.get(MODULE_ID, SETTINGS_KEYS.topMatter);
  return typeof value === "string" ? value : DEFAULT_TOP_MATTER;
}

/**
 * Convert settings JSON into normalized global templates.
 *
 * Global template IDs are deterministic (section+label slug), which lets us preserve completion
 * state for existing actors when the world-level settings are edited.
 */
export function getGlobalMilestoneTemplates(): GlobalMilestoneTemplate[] {
  const settings = getSettingsAdapter();
  if (!settings) return [];

  const raw = settings.get(MODULE_ID, SETTINGS_KEYS.milestonesJson);
  const parsed = safeParseJson<MilestoneSectionInput[]>(
    typeof raw === "string" ? raw : "",
    DEFAULT_SECTIONS
  );

  const templates: GlobalMilestoneTemplate[] = [];
  let sourceOrder = 0;

  for (const sectionEntry of parsed) {
    if (!sectionEntry || typeof sectionEntry.section !== "string" || !Array.isArray(sectionEntry.items)) continue;
    const section = sectionEntry.section.trim();
    if (!section) continue;

    for (const item of sectionEntry.items) {
      if (typeof item !== "string") continue;
      const label = item.trim();
      if (!label) continue;

      templates.push({
        id: `global-${slugify(section)}-${slugify(label)}`,
        section,
        label,
        sourceOrder
      });
      sourceOrder += 1;
    }
  }

  return templates;
}

/**
 * Return milestones required per level.
 *
 * If settings are invalid or absent we fall back to the seed table (level + 1) for stability.
 */
export function getLevelRequirementTable(): Record<number, number> {
  const settings = getSettingsAdapter();
  if (!settings) {
    const fallback: Record<number, number> = {};
    for (let level = 1; level <= 20; level += 1) {
      fallback[level] = level + 1;
    }
    return fallback;
  }

  const raw = settings.get(MODULE_ID, SETTINGS_KEYS.requirementsJson);
  const parsed = safeParseJson<Record<string, number>>(typeof raw === "string" ? raw : "", {});

  const table: Record<number, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const level = Number(key);
    const required = Number(value);
    if (!Number.isFinite(level) || !Number.isFinite(required)) continue;
    if (level < 1 || required < 0) continue;
    table[Math.trunc(level)] = Math.trunc(required);
  }

  if (Object.keys(table).length === 0) {
    for (let level = 1; level <= 20; level += 1) {
      table[level] = level + 1;
    }
  }

  return table;
}
