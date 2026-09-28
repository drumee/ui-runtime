/*
 * Non-MFS LETC compatibility substrate.
 *
 * This is a selective CJS extraction from ui-core's `letc/addons/**` and
 * `widgets/box`.  It deliberately keeps Marionette's real View and
 * CollectionView lifecycle instead of providing a descriptor renderer.
 */
const Backbone = require("backbone");
const Marionette = require("backbone.marionette");
const jquery = require("jquery");
const _ = require("lodash");
const { normalizeState, resolveBehaviors, setState } = require("./behaviors");

Backbone.$ = jquery;

const ATTR = Object.freeze({
  active: "active",
  alt: "alt",
  bubble: "bubble",
  className: "className",
  content: "content",
  flow: "flow",
  kind: "kind",
  kids: "kids",
  name: "name",
  renderer: "renderer",
  style: "style",
  styleOpt: "styleOpt",
  sysPn: "sys_pn",
  value: "value",
  widgetId: "widgetId"
});

function normalizeOptions(options = {}) {
  if (options.model instanceof Backbone.Model) return { ...options };
  const attributes = { ...options };
  delete attributes.runtime;
  delete attributes.region;
  delete attributes.collection;
  return { ...options, model: new Backbone.Model(attributes) };
}

function initializeView(view, options = {}) {
  view.runtime = options.runtime || view.options.runtime;
  view._id = view._id || _.uniqueId("letc-");
  view.model.atLeast = view.model.atLeast || function atLeast(attributes = {}) {
    for (const [name, value] of Object.entries(attributes)) {
      if (this.get(name) == null) this.set(name, value);
    }
    return this;
  };
  view.model.set(ATTR.widgetId, view._id);
  const suppliedFig = view.model.get("fig");
  const figName = view.figName || view.constructor.figName || view.constructor.name || "letc_widget";
  const family = figName.replace(/^_+/, "").replace(/_/g, "-");
  const [group, ...rest] = family.split("-");
  view.fig = { group, family, name: rest.join("-") || family, ...(suppliedFig || {}) };
  view._branches = {};
}

function applyViewState(view) {
  const class_names = [view.nativeClassName, view.mget(ATTR.className)];
  if (view.fig) {
    class_names.push(view.fig.group, view.fig.family, `${view.fig.group}__item`, `${view.fig.group}__ui`, `${view.fig.family}__ui`);
    view.el.dataset.kind = view.mget(ATTR.kind) || "";
  }
  view.el.className = class_names.filter(Boolean).join(" ");
  const flow = view.mget(ATTR.flow);
  if (flow != null) view.el.dataset.flow = flow;
  const sysPn = view.mget(ATTR.sysPn);
  if (sysPn) view.el.dataset.sysPn = sysPn;
  const dataset = view.mget("dataset") || {};
  for (const [name, value] of Object.entries(dataset)) view.el.dataset[name] = String(value);
  const attributes = view.mget("attributes") || view.mget("attribute") || view.mget("attrOpt") || {};
  for (const [name, value] of Object.entries(attributes)) view.el.setAttribute(name, String(value));
  const style = view.mget(ATTR.styleOpt) || view.mget(ATTR.style) || {};
  if (style && typeof style === "object") view.$el.css(style);
  if (view.model.has("state")) view.setState(view.mget("state"));
}

function getHandlers(view, name) {
  let handlers = view.mget(name === "ui" ? "uiHandler" : "partHandler");
  if (!Array.isArray(handlers)) handlers = handlers && handlers.model ? [handlers] : [];
  else handlers = [...handlers];
  let parent = view.parent;
  while (parent) {
    const policy = parent._handledEvents && parent._handledEvents[name];
    if (policy === "single" || policy === "multiple") handlers.push(parent);
    if (policy === "single") break;
    parent = parent.parent;
  }
  return [...new Map(handlers.filter(Boolean).map((handler) => [handler.cid, handler])).values()];
}

function handleUiClick(view, event) {
  if (view.mget(ATTR.active) === 0) return;
  view.triggerMethod("also:click", view, event);
  const handlers = view.getHandlers("ui");
  const signal = view.mget("signal") || "ui:event";
  for (const handler of handlers) handler.triggerMethod(signal, view, event);
  if (handlers.length || view.mget("service")) {
    event.preventDefault();
    event.stopPropagation();
  }
}

const view_contract = {
  behaviors() { return resolveBehaviors(this); },
  events() { return { click: "_handleUiClick" }; },
  _handleUiClick(event) { return handleUiClick(this, event); },
  contains(other) { return Boolean(other && other.el && this.el.contains(other.el)); },
  getHandlers(name) { return getHandlers(this, name); },
  setState(state, recursive) { return setState(this, state, recursive); },
  getState() { return normalizeState(this.model.get("state")); },
  toggleState() { return this.setState(this.getState() ? 0 : 1); }
};

// Exact non-ESM adaptation of ui-essentials/utils/index.js::colorFromName.
// LETC's static Avatar/Profile presentation needs this generic helper, while
// ui-runtime deliberately does not import the Essentials ESM entry at boot.
function colorFromName(name, saturation = 40, lightness = 60) {
  let hash = 0;
  const text = String(name || "");
  for (let index = 0; index < text.length; index++) hash = text.charCodeAt(index) + (hash << 5) - hash;
  return `hsl(${hash % 360}, ${saturation}%, ${lightness}%)`;
}

class LetcView extends Marionette.View {
  constructor(options = {}) {
    super(normalizeOptions(options));
  }

  initialize(options = {}) {
    initializeView(this, options);
  }

  get template() {
    return () => "";
  }

  tagName() {
    return this.model && (this.model.get("tagName") || this.model.get("href")) ? (this.model.get("tagName") || "a") : "div";
  }

  behaviors() { return view_contract.behaviors.call(this); }
  events() { return view_contract.events.call(this); }
  _handleUiClick(event) { return view_contract._handleUiClick.call(this, event); }
  contains(other) { return view_contract.contains.call(this, other); }
  getHandlers(name) { return view_contract.getHandlers.call(this, name); }
  setState(state, recursive) { return view_contract.setState.call(this, state, recursive); }
  getState() { return view_contract.getState.call(this); }
  toggleState() { return view_contract.toggleState.call(this); }

  mget(name) {
    return this.model.get(name);
  }

  mset(name, value, options) {
    return this.model.set(name, value, options);
  }

  get(name) {
    return this.model.get(name) ?? this.getOption(name);
  }

  declareHandlers(options = {}) {
    this._handledEvents = { part: "single", ui: "single", ...options };
    return this._handledEvents;
  }

  fetchService(service, payload) {
    if (!this.runtime || !this.runtime.serviceClient) throw new Error("LETC service transport is not configured");
    return this.runtime.serviceClient.fetchService(service, payload);
  }

  postService(service, payload) {
    if (!this.runtime || !this.runtime.serviceClient) throw new Error("LETC service transport is not configured");
    return this.runtime.serviceClient.postService(service, payload);
  }

  onRender() {
    applyViewState(this);
    this.onDomRefresh();
  }

  onDomRefresh() {}

  waitElement(element, handler) {
    const target = typeof element === "string" ? this.el.ownerDocument.getElementById(element) : element;
    if (target) return Promise.resolve(handler(target));
    return Promise.resolve(null);
  }

  renderPseudo() {}

  registerPart(child, name) {
    this._branches[name] = child;
    child.el.dataset.partname = name;
    this[`__${_.camelCase(name)}`] = child;
    if (typeof this.onPartReady === "function") this.onPartReady(child, name);
    this.triggerMethod("part:ready", child, name);
    child.once("destroy", () => {
      if (this._branches[name] === child) delete this._branches[name];
      if (this[`__${_.camelCase(name)}`] === child) delete this[`__${_.camelCase(name)}`];
    });
    return child;
  }
}

class LetcBox extends Marionette.CollectionView {
  static figName = "drumee_box";

  constructor(options = {}) {
    const normalized = normalizeOptions(options);
    const kids = normalized.collection || new Backbone.Collection(normalizeKids(normalized.kids));
    super({ ...normalized, collection: kids });
  }

  initialize(options = {}) {
    initializeView(this, options);
    this.collection = this.collection || new Backbone.Collection();
    this.escapeContextmenu = Boolean(this.mget("escapeContextmenu"));
  }

  get template() {
    return false;
  }

  tagName() {
    return this.model && (this.model.get("tagName") || this.model.get("href")) ? (this.model.get("tagName") || "a") : "div";
  }

  behaviors() { return view_contract.behaviors.call(this); }
  events() { return view_contract.events.call(this); }
  _handleUiClick(event) { return view_contract._handleUiClick.call(this, event); }
  contains(other) { return view_contract.contains.call(this, other); }
  getHandlers(name) { return view_contract.getHandlers.call(this, name); }
  setState(state, recursive) { return view_contract.setState.call(this, state, recursive); }
  getState() { return view_contract.getState.call(this); }
  toggleState() { return view_contract.toggleState.call(this); }

  mget(name) {
    return this.model.get(name);
  }

  mset(name, value, options) {
    return this.model.set(name, value, options);
  }

  get(name) {
    return this.model.get(name) ?? this.getOption(name);
  }

  declareHandlers(options = {}) {
    this._handledEvents = { part: "single", ui: "single", ...options };
    return this._handledEvents;
  }

  fetchService(service, payload) {
    if (!this.runtime || !this.runtime.serviceClient) throw new Error("LETC service transport is not configured");
    return this.runtime.serviceClient.fetchService(service, payload);
  }

  postService(service, payload) {
    if (!this.runtime || !this.runtime.serviceClient) throw new Error("LETC service transport is not configured");
    return this.runtime.serviceClient.postService(service, payload);
  }

  childView(model) {
    const Widget = this.runtime && this.runtime.Kind.get(model.get(ATTR.kind));
    if (!Widget) throw new Error(`Unknown static LETC kind: ${model.get(ATTR.kind)}`);
    return Widget;
  }

  childViewOptions(model) {
    const descriptor = mergeKidOptions(model.toJSON(), this.mget("kidsOpt") || this.mget("itemsOpt"), this);
    model.set(descriptor);
    return { ...descriptor, model, runtime: this.runtime };
  }

  buildChildView(model, ChildViewClass, options) {
    const child = new ChildViewClass({ ...options, model, runtime: this.runtime });
    child.parent = this;
    return child;
  }

  onRender() {
    applyViewState(this);
    this.onDomRefresh();
  }

  // Marionette.CollectionView emits `add:child` with `(parent, child)`.
  // Preserve that real lifecycle signature so LETC part registration happens
  // before profile/progress source-derived `onPartReady` code runs.
  onAddChild(parent, child) {
    child.parent = parent;
    const part = child.mget(ATTR.sysPn);
    if (!part) return;
    const handlers = child.getHandlers("part");
    if (!handlers.length) handlers.push(parent);
    for (const owner of handlers) owner.registerPart(child, part);
  }

  onDomRefresh() {}

  feed(content) {
    if (!content) return this.children.last();
    const resolved = typeof content === "function" ? content(this) : content;
    const descriptors = normalizeKids(resolved);
    this.collection.set(descriptors);
    return this.children.last();
  }

  append(content) {
    this.collection.add(normalizeKids(content));
    return this.children.last();
  }

  prepend(content) {
    this.collection.add(normalizeKids(content), { at: 0 });
    return this.children.first();
  }

  clear() {
    this.collection.reset();
  }

  isEmpty() {
    return this.collection.length === 0;
  }

  getPart(name) {
    return this._branches[name];
  }

  registerPart(child, name) {
    this._branches[name] = child;
    child.el.dataset.partname = name;
    this[`__${_.camelCase(name)}`] = child;
    if (typeof this.onPartReady === "function") this.onPartReady(child, name);
    this.triggerMethod("part:ready", child, name);
    child.once("destroy", () => {
      if (this._branches[name] === child) delete this._branches[name];
      if (this[`__${_.camelCase(name)}`] === child) delete this[`__${_.camelCase(name)}`];
    });
    return child;
  }
}

function mergeKidOptions(descriptor, kidsOpt, owner) {
  if (!kidsOpt) return descriptor;
  const options = typeof kidsOpt === "function" ? kidsOpt(owner, descriptor) : kidsOpt;
  return { ...descriptor, ...(options || {}) };
}

function normalizeKids(value, kidsOpt, owner) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((entry) => entry && entry.kind).map((entry) => mergeKidOptions(entry, kidsOpt, owner));
}

module.exports = {
  ATTR,
  Backbone,
  colorFromName,
  LetcBox,
  LetcView,
  Marionette,
  _,
  applyViewState,
  normalizeKids
};
