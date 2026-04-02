import { ChecklistApp } from "./checklist/ChecklistApp";

const MODULE_ID = "personal-milestones";
const openApps = new Map<string, ChecklistApp>();

type ActorSheetLike = {
  actor?: Actor | null;
};

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

function injectMilestonesButton(actor: Actor, root: HTMLElement): void {
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

  console.warn(`${MODULE_ID} | Could not find a header target for milestones button injection.`);
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | ready`);
});

Hooks.on("renderActorSheet", (app: ActorSheet, html: unknown) => {
  const actor = getActorFromApp(app);
  if (!actor) return;

  const root = resolveSheetRoot(html);
  if (!root) {
    console.warn(`${MODULE_ID} | Could not resolve Actor sheet root for button injection.`);
    return;
  }

  injectMilestonesButton(actor, root);
});

Hooks.on("renderApplicationV2", (app: unknown, element: HTMLElement) => {
  const actor = getActorFromApp(app);
  if (!actor) return;

  injectMilestonesButton(actor, element);
});
