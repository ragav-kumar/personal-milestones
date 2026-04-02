import { getChecklistState, makeChecklistItem, setChecklistState, type ChecklistItem } from "./store";

const BaseChecklistApp = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
);

interface ChecklistRenderContext {
  tabs?: Record<string, foundry.applications.api.ApplicationV2.Tab>;
  actorName: string;
  items: ChecklistItem[];
}

export class ChecklistApp extends BaseChecklistApp {
  readonly actor: Actor;

  static override DEFAULT_OPTIONS = {
    id: "personal-milestones-checklist",
    classes: ["personal-milestones", "sheet"],
    window: {
      title: "Milestones"
    },
    position: {
      width: 420,
      height: "auto" as const
    }
  };

  static override PARTS = {
    checklist: {
      template: "templates/checklist.hbs",
      root: true
    }
  };

  constructor(actor: Actor) {
    super({});
    this.actor = actor;
  }

  protected async _prepareContext(_options: Record<string, unknown>): Promise<ChecklistRenderContext> {
    const state = await getChecklistState(this.actor);
    return {
      actorName: this.actor.name ?? "Actor",
      items: state.items
    };
  }

  protected async _onRender(_context: Record<string, unknown>, _options: Record<string, unknown>): Promise<void> {
    await super._onRender(_context, _options);

    const root = this.element;
    const canEdit = this.actor.isOwner || game.user?.isGM;
    if (!canEdit) {
      ui.notifications?.warn("You do not have permission to edit this actor's milestones.");
      await this.close();
      return;
    }

    const addButton = root.querySelector<HTMLButtonElement>(".pm-add");
    const labelInput = root.querySelector<HTMLInputElement>(".pm-new-label");
    addButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      const label = labelInput?.value.trim() ?? "";
      if (!label) return;

      const state = await getChecklistState(this.actor);
      state.items.push(makeChecklistItem(label, state.items.length));
      await setChecklistState(this.actor, state);
      await this.render();
    });

    root.querySelectorAll<HTMLInputElement>(".pm-toggle").forEach((checkbox) => {
      checkbox.addEventListener("change", async (event) => {
        const target = event.currentTarget as HTMLInputElement;
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

    root.querySelectorAll<HTMLButtonElement>(".pm-remove").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const target = event.currentTarget as HTMLElement;
        const row = target.closest("[data-item-id]");
        const itemId = row?.getAttribute("data-item-id");
        if (!itemId) return;

        const state = await getChecklistState(this.actor);
        state.items = state.items
          .filter((entry) => entry.id !== itemId)
          .map((entry, index) => ({ ...entry, order: index }));

        await setChecklistState(this.actor, state);
        await this.render();
      });
    });
  }
}
