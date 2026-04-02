import { getChecklistState, makeChecklistItem, setChecklistState } from "./store";

const MODULE_ID = "personal-milestones";

export class ChecklistApp extends FormApplication {
  readonly actor: Actor;

  constructor(actor: Actor, options: Partial<FormApplicationOptions> = {}) {
    super({}, options);
    this.actor = actor;
  }

  static override get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "personal-milestones-checklist",
      classes: ["personal-milestones", "sheet"],
      title: "Milestones",
      template: "templates/checklist.hbs",
      width: 420,
      height: "auto",
      submitOnChange: false,
      closeOnSubmit: false,
      popOut: true
    });
  }

  override async getData(): Promise<Record<string, unknown>> {
    const state = await getChecklistState(this.actor);
    return {
      actorName: this.actor.name,
      items: state.items
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    html.find(".pm-add").on("click", async (event) => {
      event.preventDefault();
      const input = html.find(".pm-new-label").first() as JQuery<HTMLInputElement>;
      const label = String(input.val() ?? "").trim();
      if (!label) return;

      const state = await getChecklistState(this.actor);
      state.items.push(makeChecklistItem(label, state.items.length));
      await setChecklistState(this.actor, state);
      this.render(false);
    });

    html.find(".pm-toggle").on("change", async (event) => {
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

    html.find(".pm-remove").on("click", async (event) => {
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
      this.render(false);
    });
  }

  protected override async _updateObject(_event: Event, _formData: Record<string, unknown>): Promise<void> {
    // Form submission is handled by explicit UI actions.
  }

  override async _render(force?: boolean, options?: Application.RenderOptions): Promise<void> {
    const canEdit = this.actor.isOwner || game.user?.isGM;
    if (!canEdit) {
      ui.notifications?.warn("You do not have permission to edit this actor's milestones.");
      return;
    }

    await super._render(force, options);
  }
}
