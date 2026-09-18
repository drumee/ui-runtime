const assert = require("assert/strict");
const childProcess = require("child_process");
const fs = require("fs");
const { isBuiltin } = require("module");
const os = require("os");
const path = require("path");
const test = require("node:test");

const packageRoot = path.resolve(__dirname, "..");

function run(command, args, options = {}) {
  const env = { ...process.env, ...(options.env || {}) };
  delete env.NODE_TEST_CONTEXT;
  return childProcess.spawnSync(command, args, {
    cwd: options.cwd || packageRoot,
    encoding: "utf8",
    env
  });
}

function mustRun(command, args, options = {}) {
  const result = run(command, args, options);
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function packageName(specifier) {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/", 1)[0];
}

test("packed UI runtime is standalone, confined and dependency-complete", { timeout: 300000 }, async (t) => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "ui-runtime-artifact-"));
  t.after(() => fs.rmSync(work, { recursive: true, force: true }));
  const artifacts = path.join(work, "artifacts");
  const consumer = path.join(work, "consumer");
  const cache = process.env.NPM_CONFIG_CACHE || path.join(work, "npm-cache");
  fs.mkdirSync(artifacts, { recursive: true });
  fs.mkdirSync(consumer, { recursive: true });

  mustRun("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", artifacts], {
    env: { NPM_CONFIG_CACHE: cache }
  });
  const archives = fs.readdirSync(artifacts).filter((name) => name.endsWith(".tgz"));
  assert.equal(archives.length, 1);
  const artifact = path.join(artifacts, archives[0]);
  const entries = mustRun("tar", ["-tzf", artifact]).stdout.trim().split("\n").filter(Boolean);
  for (const expected of ["package/src/index.js", "package/src/browser.js", "package/src/letc/skin/index.scss"]) {
    assert.ok(entries.includes(expected), `artifact omits ${expected}`);
  }
  for (const entry of entries) {
    assert.doesNotMatch(entry, /^package\/(?:node_modules|sources|target|tests?|\.tmp|\.github)\//);
  }

  fs.writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "ui-runtime-consumer", private: true }));
  mustRun("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", artifact], {
    cwd: consumer,
    env: { NPM_CONFIG_CACHE: cache, NODE_PATH: "" }
  });
  const installedRoot = path.join(consumer, "node_modules", "@drumee", "ui-runtime");
  const installedPackageJson = path.join(installedRoot, "package.json");
  assert.ok(fs.existsSync(installedPackageJson));
  assert.ok(installedRoot.startsWith(path.join(consumer, "node_modules") + path.sep));
  const manifest = JSON.parse(fs.readFileSync(installedPackageJson, "utf8"));
  assert.equal(manifest.name, "@drumee/ui-runtime");
  assert.equal(manifest.version, "0.1.0-alpha.1");

  const declared = new Set(Object.keys(manifest.dependencies || {}));
  const external = new Set();
  const jsFiles = entries.filter((entry) => /^package\/.*\.js$/.test(entry)).sort();
  for (const entry of jsFiles) {
    const relative = entry.slice("package/".length);
    const text = fs.readFileSync(path.join(installedRoot, relative), "utf8");
    assert.doesNotMatch(text, /(?:process\.cwd\(|NODE_PATH|\/opt\/kernel|\.\.\/\.\.\/\.\.\/|\/home\/|sources\/|target\/|transient)/, `hidden coupling in ${relative}`);
    for (const match of text.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
      const specifier = match[2];
      if (specifier.startsWith(".")) continue;
      assert.equal(path.isAbsolute(specifier), false, `absolute require in ${relative}`);
      if (!isBuiltin(specifier)) external.add(packageName(specifier));
    }
  }
  for (const dependency of external) assert.ok(declared.has(dependency), `undeclared dependency ${dependency}`);
  assert.deepEqual([...external].sort(), ["backbone", "backbone.marionette", "dompurify", "jquery", "lodash"]);

  const smoke = `
    const assert = require("assert/strict");
    const path = require("path");
    const resolved = require.resolve("@drumee/ui-runtime");
    assert.ok(resolved.startsWith(path.join(process.env.CONSUMER, "node_modules") + path.sep));
    const runtime = require("@drumee/ui-runtime");
    let registry;
    registry = new runtime.KindRegistry({
      bootstrapPlugin: async () => ({ path: "/-/plugins/packed/index.js" }),
      loadJS: async () => registry.registerAddons({ packed: class PackedWidget {} })
    });
    registry.setReady(Promise.resolve());
    registry.loadPlugin({ name: "packed", kind: "packed" }).then((Widget) => {
      assert.equal(typeof Widget, "function");
    }).catch((error) => { process.nextTick(() => { throw error; }); });
  `;
  mustRun("node", ["-e", smoke], { cwd: consumer, env: { NODE_PATH: "", CONSUMER: consumer } });
  t.diagnostic(`artifact=${archives[0]}`);
  t.diagnostic(`JavaScript audit=${jsFiles.map((entry) => entry.slice(8)).join(",")}`);
  t.diagnostic(`external dependencies=${[...external].sort().join(",")}`);
});
