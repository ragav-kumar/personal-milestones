import { ChecklistApp } from "./checklist/ChecklistApp";

const MODULE_ID = "personal-milestones";
const openApps = new Map<string, ChecklistApp>();

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | ready`);
});

Hooks.on("renderActorSheet", (app: ActorSheet, html: JQuery) => {
  const actor = app.actor;
  if (!actor) return;
  if (html.find(".personal-milestones-open").length > 0) return;

  const openButton = $(
    `<button type="button" class="personal-milestones-open"><i class="fas fa-list-check"></i> Milestones</button>`
  );

  openButton.on("click", () => {
    const existing = openApps.get(actor.id);
    if (existing) {
      existing.render(true);
      return;
    }

    const app = new ChecklistApp(actor);
    openApps.set(actor.id, app);

    void app.render(true);
    app.once("close", () => {
      openApps.delete(actor.id);
    });
  });

  const headerActions = html.find(".window-header .header-control").first();
  if (headerActions.length > 0) {
    headerActions.before(openButton);
    return;
  }

  const fallback = html.find(".window-header .window-title").first();
  fallback.after(openButton);
});
