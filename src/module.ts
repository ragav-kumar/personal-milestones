import { getTopMatterMarkdown, registerMilestoneSettings } from "./checklist/settings";
import {
  addActorSpecificMilestone,
  getChecklistState,
  getProgress,
  removeActorSpecificMilestone,
  resetProgressCounter,
  toggleMilestone,
  type ChecklistItem
} from "./checklist/store";

const MODULE_ID = "personal-milestones";
const TAB_ID = "personal-milestones";

type ActorSheetLike = {
  actor?: Actor | null;
  render?: (force?: boolean) => Promise<unknown>;
};

// Foundry render hooks may provide an HTMLElement, jQuery-like object, or wrapper.
function resolveSheetRoot(html: unknown): HTMLElement | null {
  if (html instanceof HTMLElement) return html;

  if (!html || typeof html !== "object") return null;

  const candidate = html as {
    0?: unknown;
    get?: (index: number) => unknown;
  };

  if (candidate[0] instanceof HTMLElement) return candidate[0];
  if (typeof candidate.get === "function") {
    const first = candidate.get(0);
    if (first instanceof HTMLElement) return first;
  }

  return null;
}

function getActorFromApp(app: unknown): Actor | null {
  if (!app || typeof app !== "object") return null;
  const candidate = app as ActorSheetLike;
  return candidate.actor ?? null;
}

function isCharacterActor(actor: Actor): boolean {
  return (actor as { type?: string }).type === "character";
}

function groupBySection(items: ChecklistItem[]): Array<{ section: string; items: ChecklistItem[] }> {
  const order: string[] = [];
  const bySection = new Map<string, ChecklistItem[]>();

  for (const item of items) {
    if (!bySection.has(item.section)) {
      bySection.set(item.section, []);
      order.push(item.section);
    }
    bySection.get(item.section)?.push(item);
  }

  return order.map((section) => ({ section, items: bySection.get(section) ?? [] }));
}

/**
 * Render (or re-render) the milestones tab inside an actor sheet.
 *
 * This function is intentionally idempotent so it can be safely called from multiple render hooks
 * and after each user action (toggle/add/remove/reset).
 */
async function renderMilestonePane(actor: Actor, app: unknown, root: HTMLElement): Promise<void> {
  if (!isCharacterActor(actor)) return;

  const nav = root.querySelector<HTMLElement>(".sheet-navigation.tabs, nav.tabs");
  const body = root.querySelector<HTMLElement>(".sheet-body");
  if (!nav || !body) return;

  let navItem = nav.querySelector<HTMLElement>(`.item[data-tab='${TAB_ID}']`);
  if (!navItem) {
    navItem = document.createElement("a");
    navItem.className = "item personal-milestones-tab-button";
    navItem.setAttribute("data-tab", TAB_ID);
    navItem.setAttribute("data-group", "primary");
    navItem.innerHTML = `<i class="fas fa-list-check"></i> Milestones`;
    nav.appendChild(navItem);
  }

  let pane = body.querySelector<HTMLElement>(`.tab[data-tab='${TAB_ID}']`);
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
  // Runtime accepts async enrichment; cast bridges strict typing mismatch in current declarations.
  const topMatter = await (TextEditor.enrichHTML as unknown as (
    content: string,
    options: Record<string, unknown>
  ) => Promise<string>)(topMatterMarkdown, { async: true });

  const sectionHtml = sections
    .map(({ section, items }) => {
      const itemRows = items
        .map((item) => {
          const checked = item.completed ? "checked" : "";
          const disabled = canToggle ? "" : "disabled";
          const completeClass = item.completed ? "is-complete" : "";
          const removeButton = isGM && item.source === "actor"
            ? `<button type="button" class="pm-remove" data-item-id="${item.id}" title="Remove milestone"><i class="fas fa-trash"></i></button>`
            : "";
          const sourceBadge = item.source === "global"
            ? `<span class="pm-source pm-source-global">Global</span>`
            : `<span class="pm-source pm-source-actor">Actor</span>`;

          return `
            <li class="pm-item" data-item-id="${item.id}">
              <label class="pm-item-label">
                <input type="checkbox" class="pm-toggle" ${checked} ${disabled}>
                <span class="pm-item-text ${completeClass}">${item.label}</span>
              </label>
              <div class="pm-item-meta">${sourceBadge}${removeButton}</div>
            </li>
          `;
        })
        .join("");

      return `
        <section class="pm-section">
          <h3>${section}</h3>
          <ul class="pm-list">${itemRows}</ul>
        </section>
      `;
    })
    .join("");

  const gmControls = isGM
    ? `
      <section class="pm-gm-controls">
        <h3>GM: Add Character-Specific Milestone</h3>
        <div class="pm-add-row">
          <input type="text" class="pm-new-section" placeholder="Section (e.g. Personal Quest)">
          <input type="text" class="pm-new-label" placeholder="Milestone text">
          <button type="button" class="pm-add">Add</button>
        </div>
        <button type="button" class="pm-reset-progress">Reset Claimed Counter For Current Level</button>
      </section>
    `
    : "";

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

  // Since this tab is injected post-render, we manage active tab classes explicitly.
  navItem.addEventListener("click", (event) => {
    event.preventDefault();
    const activeNavItems = nav.querySelectorAll<HTMLElement>(".item.active");
    activeNavItems.forEach((item) => item.classList.remove("active"));
    navItem?.classList.add("active");

    const tabs = body.querySelectorAll<HTMLElement>(".tab.active");
    tabs.forEach((tab) => tab.classList.remove("active"));
    pane?.classList.add("active");
  });

  pane.querySelectorAll<HTMLInputElement>(".pm-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const row = input.closest<HTMLElement>("[data-item-id]");
      const itemId = row?.dataset.itemId;
      if (!itemId) return;

      void (async () => {
        await toggleMilestone(actor, itemId, input.checked);
        await renderMilestonePane(actor, app, root);
      })();
    });
  });

  pane.querySelectorAll<HTMLButtonElement>(".pm-remove").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const target = event.currentTarget as HTMLButtonElement;
      const itemId = target.dataset.itemId;
      if (!itemId) return;

      void (async () => {
        await removeActorSpecificMilestone(actor, itemId);
        await renderMilestonePane(actor, app, root);
      })();
    });
  });

  const addButton = pane.querySelector<HTMLButtonElement>(".pm-add");
  const sectionInput = pane.querySelector<HTMLInputElement>(".pm-new-section");
  const labelInput = pane.querySelector<HTMLInputElement>(".pm-new-label");
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

  const resetButton = pane.querySelector<HTMLButtonElement>(".pm-reset-progress");
  resetButton?.addEventListener("click", (event) => {
    event.preventDefault();
    void (async () => {
      await resetProgressCounter(actor);
      ui.notifications?.info("Claimed milestone counter reset for current level.");
      await renderMilestonePane(actor, app, root);
    })();
  });
}

async function renderActorMilestones(app: unknown, html: unknown): Promise<void> {
  const actor = getActorFromApp(app);
  if (!actor || !isCharacterActor(actor)) return;

  const root = resolveSheetRoot(html);
  if (!root) return;

  await renderMilestonePane(actor, app, root);
}

Hooks.once("init", () => {
  // Register settings early so world configuration is available before first sheet render.
  registerMilestoneSettings();
  console.log(`${MODULE_ID} | init`);
});

// Legacy sheet render hook path.
Hooks.on("renderActorSheet", (app: ActorSheet, html: unknown) => {
  void renderActorMilestones(app, html);
});

// ApplicationV2 render hook path (v13+ systems increasingly use this).
Hooks.on("renderApplicationV2", (app: unknown, element: HTMLElement) => {
  void renderActorMilestones(app, element);
});
