// src/checklist/store.ts
var MODULE_ID = "personal-milestones";
var CHECKLIST_FLAG_KEY = "checklist";
function asChecklistItem(item, index) {
  if (!item || typeof item !== "object") return null;
  const candidate = item;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;
  if (typeof candidate.label !== "string") return null;
  return {
    id: candidate.id,
    label: candidate.label,
    completed: Boolean(candidate.completed),
    order: Number.isFinite(candidate.order) ? Number(candidate.order) : index
  };
}
function normalize(state) {
  if (!state || typeof state !== "object") return { items: [] };
  const rawItems = state.items;
  if (!Array.isArray(rawItems)) return { items: [] };
  const items = rawItems.map((item, index) => asChecklistItem(item, index)).filter((item) => item !== null).sort((a, b) => a.order - b.order).map((item, index) => ({ ...item, order: index }));
  return { items };
}
async function getChecklistState(actor) {
  const flag = actor.getFlag(MODULE_ID, CHECKLIST_FLAG_KEY);
  return normalize(flag);
}
async function setChecklistState(actor, state) {
  const normalized = normalize(state);
  await actor.setFlag(MODULE_ID, CHECKLIST_FLAG_KEY, normalized);
}
function makeChecklistItem(label, order) {
  return {
    id: foundry.utils.randomID(),
    label,
    completed: false,
    order
  };
}

// src/checklist/ChecklistApp.ts
var MODULE_ID2 = "personal-milestones";
var BaseChecklistApp = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
);
var ChecklistApp = class extends BaseChecklistApp {
  actor;
  static DEFAULT_OPTIONS = {
    id: "personal-milestones-checklist",
    classes: ["personal-milestones", "sheet"],
    window: {
      title: "Milestones"
    },
    position: {
      width: 420,
      height: "auto"
    }
  };
  static PARTS = {
    checklist: {
      template: `modules/${MODULE_ID2}/templates/checklist.hbs`,
      root: true
    }
  };
  constructor(actor) {
    super({});
    this.actor = actor;
  }
  async _prepareContext(_options) {
    const state = await getChecklistState(this.actor);
    return {
      actorName: this.actor.name ?? "Actor",
      items: state.items
    };
  }
  async _onRender(_context, _options) {
    await super._onRender(_context, _options);
    const root = this.element;
    const canEdit = this.actor.isOwner || game.user?.isGM;
    if (!canEdit) {
      ui.notifications?.warn("You do not have permission to edit this actor's milestones.");
      await this.close();
      return;
    }
    const addButton = root.querySelector(".pm-add");
    const labelInput = root.querySelector(".pm-new-label");
    addButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      const label = labelInput?.value.trim() ?? "";
      if (!label) return;
      const state = await getChecklistState(this.actor);
      state.items.push(makeChecklistItem(label, state.items.length));
      await setChecklistState(this.actor, state);
      await this.render();
    });
    root.querySelectorAll(".pm-toggle").forEach((checkbox) => {
      checkbox.addEventListener("change", async (event) => {
        const target = event.currentTarget;
        const row = target.closest("[data-item-id]");
        const itemId = row?.getAttribute("data-item-id");
        if (!itemId) return;
        const state = await getChecklistState(this.actor);
        const item = state.items.find((entry) => entry.id === itemId);
        if (!item) return;
        item.completed = target.checked;
        await setChecklistState(this.actor, state);
      });
    });
    root.querySelectorAll(".pm-remove").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const target = event.currentTarget;
        const row = target.closest("[data-item-id]");
        const itemId = row?.getAttribute("data-item-id");
        if (!itemId) return;
        const state = await getChecklistState(this.actor);
        state.items = state.items.filter((entry) => entry.id !== itemId).map((entry, index) => ({ ...entry, order: index }));
        await setChecklistState(this.actor, state);
        await this.render();
      });
    });
  }
};

// src/module.ts
var MODULE_ID3 = "personal-milestones";
var openApps = /* @__PURE__ */ new Map();
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
function injectMilestonesButton(actor, root) {
  if (root.querySelector(".personal-milestones-open")) return;
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "personal-milestones-open";
  openButton.innerHTML = `<i class="fas fa-list-check"></i> Milestones`;
  openButton.addEventListener("click", () => {
    const appKey = actor.uuid;
    const existing = openApps.get(appKey);
    if (existing?.rendered) {
      void existing.render(true);
      return;
    }
    openApps.delete(appKey);
    const app = new ChecklistApp(actor);
    openApps.set(appKey, app);
    void app.render(true);
  });
  const headerActions = root.querySelector(".window-header .header-control");
  if (headerActions?.parentElement) {
    headerActions.parentElement.insertBefore(openButton, headerActions);
    return;
  }
  const title = root.querySelector(".window-header .window-title");
  if (title) {
    title.insertAdjacentElement("afterend", openButton);
    return;
  }
  const sheetHeader = root.querySelector(".sheet-header");
  if (sheetHeader) {
    sheetHeader.appendChild(openButton);
    return;
  }
  const windowHeader = root.querySelector(".window-header");
  if (windowHeader) {
    windowHeader.appendChild(openButton);
    return;
  }
  console.warn(`${MODULE_ID3} | Could not find a header target for milestones button injection.`);
}
Hooks.once("init", () => {
  console.log(`${MODULE_ID3} | init`);
});
Hooks.once("ready", () => {
  console.log(`${MODULE_ID3} | ready`);
});
Hooks.on("renderActorSheet", (app, html) => {
  const actor = getActorFromApp(app);
  if (!actor) return;
  const root = resolveSheetRoot(html);
  if (!root) {
    console.warn(`${MODULE_ID3} | Could not resolve Actor sheet root for button injection.`);
    return;
  }
  injectMilestonesButton(actor, root);
});
Hooks.on("renderApplicationV2", (app, element) => {
  const actor = getActorFromApp(app);
  if (!actor) return;
  injectMilestonesButton(actor, element);
});
