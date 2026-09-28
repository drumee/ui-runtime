const Marionette = require("backbone.marionette");

const radio_channels = new Map();

function normalizeState(value) {
  if ([1, "1", "on", "in", "yes", "true", true].includes(value)) return 1;
  return 0;
}

function radioState(value) {
  return normalizeState(value) ? "on" : "off";
}

function setState(view, state, recursive = 0) {
  const normalized = normalizeState(state == null ? view.model.get("state") : state);
  view.model.set("state", normalized);
  if (view.el) {
    view.el.setAttribute("data-state", String(normalized));
    view.el.setAttribute("data-radio", radioState(normalized));
    if (view.el.getAttribute("data-radiotoggle") != null || view.model.get("radiotoggle") != null) {
      view.el.setAttribute("data-radiotoggle", radioState(normalized));
    }
  }
  if (typeof view._syncState === "function") view._syncState(normalized);
  const should_recurse = recursive || view.model.get("radioRecursive");
  if (should_recurse && view.children) view.children.each((child) => child.setState(normalized, should_recurse));
  return normalized;
}

function subscribe(channel, behavior) {
  if (!channel || channel === "on" || channel === "parent") return;
  if (!radio_channels.has(channel)) radio_channels.set(channel, new Set());
  radio_channels.get(channel).add(behavior);
  behavior._channel = channel;
}

function unsubscribe(behavior) {
  const listeners = radio_channels.get(behavior._channel);
  if (!listeners) return;
  listeners.delete(behavior);
  if (!listeners.size) radio_channels.delete(behavior._channel);
}

function broadcast(channel, origin, toggle = false) {
  const listeners = radio_channels.get(channel);
  if (!listeners) return;
  for (const behavior of [...listeners]) {
    const selected = behavior.view === origin || (behavior.view.el && origin.el && behavior.view.el.contains(origin.el));
    if (selected && toggle) behavior.view.setState(behavior.view.getState() ? 0 : 1);
    else behavior.view.setState(selected ? 1 : 0);
  }
}

class RadioBehavior extends Marionette.Behavior {
  onRender() {
    this.view.isRadio = 1;
    this.view.setState(this.view.mget("state") ?? this.view.mget("initialState") ?? 0);
    subscribe(this.view.mget("radio"), this);
  }

  onChangeRadio(origin = this.view) {
    const channel = this.view.mget("radio");
    if (!channel || channel === "on" || channel === "parent") this.view.setState(1);
    else broadcast(channel, origin);
  }

  onToggle(origin = this.view) {
    this.onChangeRadio(origin);
  }

  onAlsoClick() {
    this.onChangeRadio(this.view);
  }

  onDestroy() {
    unsubscribe(this);
  }
}

class ToggleBehavior extends Marionette.Behavior {
  onRender() {
    this.view.isToggle = 1;
    this.view.setState(this.view.mget("state") ?? this.view.mget("initialState") ?? 0);
  }

  onAlsoClick(source, event) {
    if (event && event === this.lastEvent) return;
    this.lastEvent = event;
    this.view.toggleState();
    if (typeof this.view.mould === "function") this.view.mould();
  }
}

class RadioToggleBehavior extends Marionette.Behavior {
  onRender() {
    this.view.isToggle = 1;
    this.view.setState(this.view.mget("state") ?? this.view.mget("initialState") ?? 0);
    subscribe(this.view.mget("radiotoggle"), this);
  }

  onRadioToggle(origin = this.view) {
    const channel = this.view.mget("radiotoggle");
    if (!channel || channel === "on" || channel === "parent") this.view.toggleState();
    else broadcast(channel, origin, true);
  }

  onAlsoClick() {
    this.onRadioToggle(this.view);
  }

  onDestroy() {
    unsubscribe(this);
  }
}

const preset_behaviors = Object.freeze({
  bhv_radio: RadioBehavior,
  bhv_radiotoggle: RadioToggleBehavior,
  bhv_toggle: ToggleBehavior
});

const configured_behaviors = Object.freeze({
  radio: RadioBehavior,
  radiotoggle: RadioToggleBehavior,
  state: ToggleBehavior,
  toggle: ToggleBehavior
});

function behaviorValue(view, name) {
  if (view.model && view.model.has(name)) return view.model.get(name);
  return view.options && view.options[name];
}

function resolveBehaviors(view) {
  const definitions = {};
  const behavior_set = typeof view.behaviorSet === "function" ? view.behaviorSet() : view.behaviorSet || {};
  for (const [name, value] of Object.entries(behavior_set || {})) {
    const Behavior = preset_behaviors[name];
    if (!Behavior) continue;
    definitions[Behavior.name] = { ...(typeof value === "object" ? value : { args: value }), behaviorClass: Behavior };
  }
  for (const [name, Behavior] of Object.entries(configured_behaviors)) {
    const value = behaviorValue(view, name);
    if (value == null) continue;
    definitions[Behavior.name] = {
      ...(definitions[Behavior.name] || {}),
      ...(typeof value === "object" ? value : { args: value }),
      behaviorClass: Behavior
    };
  }
  if (definitions.RadioBehavior || definitions.RadioToggleBehavior) delete definitions.ToggleBehavior;
  return Object.values(definitions);
}

module.exports = {
  RadioBehavior,
  RadioToggleBehavior,
  ToggleBehavior,
  normalizeState,
  radioState,
  resolveBehaviors,
  setState
};
