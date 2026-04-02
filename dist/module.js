// src/checklist/settings.ts
var MODULE_ID = "personal-milestones";
var SETTINGS_KEYS = {
  topMatter: "topMatterMarkdown",
  milestonesJson: "globalMilestonesJson",
  requirementsJson: "levelRequirementsJson"
};
var DEFAULT_TOP_MATTER = [
  "Track personal milestones for your character.",
  "",
  "- Check milestones as they are achieved.",
  "- Progress shown here is milestones claimed since your last level-up reset.",
  "- Ask your GM to add character-specific milestones when needed."
].join("\n");
var DEFAULT_SECTIONS = [
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
function defaultRequirementsJson() {
  const table = {};
  for (let level = 1; level <= 20; level += 1) {
    table[String(level)] = level + 1;
  }
  return JSON.stringify(table, null, 2);
}
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
function safeParseJson(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
}
function getSettingsAdapter() {
  const settings = game.settings;
  if (!settings) return null;
  return settings;
}
function registerMilestoneSettings() {
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
    hint: 'Milestones required by current level. Example: { "2": 3, "3": 4 }',
    scope: "world",
    config: true,
    type: String,
    default: defaultRequirementsJson()
  });
}
function getTopMatterMarkdown() {
  const settings = getSettingsAdapter();
  if (!settings) return DEFAULT_TOP_MATTER;
  const value = settings.get(MODULE_ID, SETTINGS_KEYS.topMatter);
  return typeof value === "string" ? value : DEFAULT_TOP_MATTER;
}
function getGlobalMilestoneTemplates() {
  const settings = getSettingsAdapter();
  if (!settings) return [];
  const raw = settings.get(MODULE_ID, SETTINGS_KEYS.milestonesJson);
  const parsed = safeParseJson(
    typeof raw === "string" ? raw : "",
    DEFAULT_SECTIONS
  );
  const templates = [];
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
function getLevelRequirementTable() {
  const settings = getSettingsAdapter();
  if (!settings) {
    const fallback = {};
    for (let level = 1; level <= 20; level += 1) {
      fallback[level] = level + 1;
    }
    return fallback;
  }
  const raw = settings.get(MODULE_ID, SETTINGS_KEYS.requirementsJson);
  const parsed = safeParseJson(typeof raw === "string" ? raw : "", {});
  const table = {};
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

// src/checklist/store.ts
var MODULE_ID2 = "personal-milestones";
var CHECKLIST_FLAG_KEY = "checklist";
function asChecklistItem(item, index) {
  if (!item || typeof item !== "object") return null;
  const candidate = item;
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
    createdAt: Number.isFinite(candidate.createdAt) ? Number(candidate.createdAt) : void 0,
    firstClaimedAt: Number.isFinite(candidate.firstClaimedAt) ? Number(candidate.firstClaimedAt) : void 0
  };
}
function getCurrentLevel(actor) {
  const actorLike = actor;
  const details = actorLike.system?.details;
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
function normalizeBaseState(state, level) {
  if (!state || typeof state !== "object") {
    return {
      version: 2,
      items: [],
      progress: { level, claimedIds: [] }
    };
  }
  const raw = state;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.map((item, index) => asChecklistItem(item, index)).filter((item) => item !== null).sort((a, b) => a.sourceOrder - b.sourceOrder).map((item, index) => ({ ...item, sourceOrder: index }));
  const progressLevel = Number(raw.progress?.level);
  const claimedIdsRaw = Array.isArray(raw.progress?.claimedIds) ? raw.progress?.claimedIds : [];
  const claimedIds = claimedIdsRaw.filter((id) => typeof id === "string");
  return {
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 2,
    items,
    progress: {
      level: Number.isFinite(progressLevel) && progressLevel > 0 ? Math.trunc(progressLevel) : level,
      claimedIds
    }
  };
}
function applyGlobalTemplates(items, templates) {
  const existingById = new Map(items.map((item) => [item.id, item]));
  const actorSpecific = items.filter((item) => item.source === "actor");
  const globals = templates.map((template) => {
    const existing = existingById.get(template.id);
    return {
      id: template.id,
      section: template.section,
      label: template.label,
      source: "global",
      completed: existing?.completed ?? false,
      sourceOrder: template.sourceOrder,
      firstClaimedAt: existing?.firstClaimedAt
    };
  });
  const merged = [...globals, ...actorSpecific].sort((a, b) => a.sourceOrder - b.sourceOrder).map((item, index) => ({ ...item, sourceOrder: index }));
  return merged;
}
function ensureProgressLevel(state, level) {
  if (state.progress.level === level) return state;
  return {
    ...state,
    progress: {
      level,
      claimedIds: []
    }
  };
}
function dedupeClaimedIds(claimedIds, validIds) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const id of claimedIds) {
    if (!validIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
async function writeState(actor, state) {
  await actor.setFlag(MODULE_ID2, CHECKLIST_FLAG_KEY, state);
}
async function getChecklistState(actor) {
  const level = getCurrentLevel(actor);
  const rawFlag = actor.getFlag(MODULE_ID2, CHECKLIST_FLAG_KEY);
  let state = normalizeBaseState(rawFlag, level);
  state.items = applyGlobalTemplates(state.items, getGlobalMilestoneTemplates());
  state = ensureProgressLevel(state, level);
  const validIds = new Set(state.items.map((item) => item.id));
  state.progress.claimedIds = dedupeClaimedIds(state.progress.claimedIds, validIds);
  await writeState(actor, state);
  return state;
}
async function setChecklistState(actor, state) {
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
function makeActorMilestone(section, label, sourceOrder) {
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
function getProgress(actor, state) {
  const currentLevel = getCurrentLevel(actor);
  const requiredTable = getLevelRequirementTable();
  const required = requiredTable[currentLevel] ?? currentLevel + 1;
  return {
    currentLevel,
    required,
    claimed: state.progress.claimedIds.length
  };
}
function actorHasInspiration(actor) {
  const system = actor.system;
  const attributes = system?.attributes;
  const inspiration = attributes?.inspiration;
  if (typeof inspiration === "boolean") return inspiration;
  if (typeof inspiration === "number") return inspiration > 0;
  return Boolean(inspiration);
}
async function grantInspiration(actor) {
  const actorLike = actor;
  const current = actorLike.system?.attributes?.inspiration;
  if (typeof current === "number") {
    await actorLike.update({ "system.attributes.inspiration": 1 });
    return;
  }
  await actorLike.update({ "system.attributes.inspiration": true });
}
async function toggleMilestone(actor, milestoneId, checked) {
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
async function addActorSpecificMilestone(actor, section, label) {
  const state = await getChecklistState(actor);
  const nextOrder = state.items.length;
  state.items.push(makeActorMilestone(section, label, nextOrder));
  await setChecklistState(actor, state);
  return state;
}
async function removeActorSpecificMilestone(actor, milestoneId) {
  const state = await getChecklistState(actor);
  const target = state.items.find((item) => item.id === milestoneId);
  if (!target || target.source !== "actor") return state;
  state.items = state.items.filter((item) => item.id !== milestoneId).map((item, index) => ({ ...item, sourceOrder: index }));
  state.progress.claimedIds = state.progress.claimedIds.filter((id) => id !== milestoneId);
  await setChecklistState(actor, state);
  return state;
}
async function resetProgressCounter(actor) {
  const state = await getChecklistState(actor);
  state.progress.claimedIds = [];
  state.progress.level = getCurrentLevel(actor);
  await setChecklistState(actor, state);
  return state;
}

// src/module.ts
var MODULE_ID3 = "personal-milestones";
var TAB_ID = "personal-milestones";
function resolveSheetRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (!html || typeof html !== "object") return null;
  const candidate = html;
  if (candidate[0] instanceof HTMLElement) return candidate[0];
  if (typeof candidate.get === "function") {
    const first = candidate.get(0);
    if (first instanceof HTMLElement) return first;
  }
  return null;
}
function getActorFromApp(app) {
  if (!app || typeof app !== "object") return null;
  const candidate = app;
  return candidate.actor ?? null;
}
function isCharacterActor(actor) {
  return actor.type === "character";
}
function groupBySection(items) {
  const order = [];
  const bySection = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (!bySection.has(item.section)) {
      bySection.set(item.section, []);
      order.push(item.section);
    }
    bySection.get(item.section)?.push(item);
  }
  return order.map((section) => ({ section, items: bySection.get(section) ?? [] }));
}
async function renderMilestonePane(actor, app, root) {
  if (!isCharacterActor(actor)) return;
  const nav = root.querySelector(".sheet-navigation.tabs, nav.tabs");
  const body = root.querySelector(".sheet-body");
  if (!nav || !body) return;
  let navItem = nav.querySelector(`.item[data-tab='${TAB_ID}']`);
  if (!navItem) {
    navItem = document.createElement("a");
    navItem.className = "item personal-milestones-tab-button";
    navItem.setAttribute("data-tab", TAB_ID);
    navItem.setAttribute("data-group", "primary");
    navItem.innerHTML = `<i class="fas fa-list-check"></i> Milestones`;
    nav.appendChild(navItem);
  }
  let pane = body.querySelector(`.tab[data-tab='${TAB_ID}']`);
  if (!pane) {
    pane = document.createElement("section");
    pane.className = "tab personal-milestones-tab";
    pane.dataset.group = "primary";
    pane.dataset.tab = TAB_ID;
    body.appendChild(pane);
  }
  const state = await getChecklistState(actor);
  const progress = getProgress(actor, state);
  const sections = groupBySection(state.items);
  const canToggle = Boolean(actor.isOwner || game.user?.isGM);
  const isGM = Boolean(game.user?.isGM);
  const topMatterMarkdown = getTopMatterMarkdown();
  const topMatter = await TextEditor.enrichHTML(topMatterMarkdown, { async: true });
  const sectionHtml = sections.map(({ section, items }) => {
    const itemRows = items.map((item) => {
      const checked = item.completed ? "checked" : "";
      const disabled = canToggle ? "" : "disabled";
      const completeClass = item.completed ? "is-complete" : "";
      const removeButton = isGM && item.source === "actor" ? `<button type="button" class="pm-remove" data-item-id="${item.id}" title="Remove milestone"><i class="fas fa-trash"></i></button>` : "";
      const sourceBadge = item.source === "global" ? `<span class="pm-source pm-source-global">Global</span>` : `<span class="pm-source pm-source-actor">Actor</span>`;
      return `
            <li class="pm-item" data-item-id="${item.id}">
              <label class="pm-item-label">
                <input type="checkbox" class="pm-toggle" ${checked} ${disabled}>
                <span class="pm-item-text ${completeClass}">${item.label}</span>
              </label>
              <div class="pm-item-meta">${sourceBadge}${removeButton}</div>
            </li>
          `;
    }).join("");
    return `
        <section class="pm-section">
          <h3>${section}</h3>
          <ul class="pm-list">${itemRows}</ul>
        </section>
      `;
  }).join("");
  const gmControls = isGM ? `
      <section class="pm-gm-controls">
        <h3>GM: Add Character-Specific Milestone</h3>
        <div class="pm-add-row">
          <input type="text" class="pm-new-section" placeholder="Section (e.g. Personal Quest)">
          <input type="text" class="pm-new-label" placeholder="Milestone text">
          <button type="button" class="pm-add">Add</button>
        </div>
        <button type="button" class="pm-reset-progress">Reset Claimed Counter For Current Level</button>
      </section>
    ` : "";
  pane.innerHTML = `
    <div class="personal-milestones">
      <div class="pm-top-matter">${topMatter}</div>
      <div class="pm-progress">
        <strong>Progress to next level:</strong>
        <span>${progress.claimed} / ${progress.required} milestones claimed (Level ${progress.currentLevel})</span>
      </div>
      ${sectionHtml}
      ${gmControls}
    </div>
  `;
  navItem.addEventListener("click", (event) => {
    event.preventDefault();
    const activeNavItems = nav.querySelectorAll(".item.active");
    activeNavItems.forEach((item) => item.classList.remove("active"));
    navItem?.classList.add("active");
    const tabs = body.querySelectorAll(".tab.active");
    tabs.forEach((tab) => tab.classList.remove("active"));
    pane?.classList.add("active");
  });
  pane.querySelectorAll(".pm-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const input = event.currentTarget;
      const row = input.closest("[data-item-id]");
      const itemId = row?.dataset.itemId;
      if (!itemId) return;
      void (async () => {
        await toggleMilestone(actor, itemId, input.checked);
        await renderMilestonePane(actor, app, root);
      })();
    });
  });
  pane.querySelectorAll(".pm-remove").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const target = event.currentTarget;
      const itemId = target.dataset.itemId;
      if (!itemId) return;
      void (async () => {
        await removeActorSpecificMilestone(actor, itemId);
        await renderMilestonePane(actor, app, root);
      })();
    });
  });
  const addButton = pane.querySelector(".pm-add");
  const sectionInput = pane.querySelector(".pm-new-section");
  const labelInput = pane.querySelector(".pm-new-label");
  addButton?.addEventListener("click", (event) => {
    event.preventDefault();
    const section = sectionInput?.value.trim() ?? "";
    const label = labelInput?.value.trim() ?? "";
    if (!section || !label) {
      ui.notifications?.warn("Enter both section and milestone text.");
      return;
    }
    void (async () => {
      await addActorSpecificMilestone(actor, section, label);
      if (sectionInput) sectionInput.value = "";
      if (labelInput) labelInput.value = "";
      await renderMilestonePane(actor, app, root);
    })();
  });
  const resetButton = pane.querySelector(".pm-reset-progress");
  resetButton?.addEventListener("click", (event) => {
    event.preventDefault();
    void (async () => {
      await resetProgressCounter(actor);
      ui.notifications?.info("Claimed milestone counter reset for current level.");
      await renderMilestonePane(actor, app, root);
    })();
  });
}
async function renderActorMilestones(app, html) {
  const actor = getActorFromApp(app);
  if (!actor || !isCharacterActor(actor)) return;
  const root = resolveSheetRoot(html);
  if (!root) return;
  await renderMilestonePane(actor, app, root);
}
Hooks.once("init", () => {
  registerMilestoneSettings();
  console.log(`${MODULE_ID3} | init`);
});
Hooks.on("renderActorSheet", (app, html) => {
  void renderActorMilestones(app, html);
});
Hooks.on("renderApplicationV2", (app, element) => {
  void renderActorMilestones(app, element);
});
