import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkArchitecture } from "../scripts/architecture-checks.ts";

const projectRoot = path.resolve(import.meta.dirname, "..");
const script = path.join(projectRoot, "scripts", "check-architecture.ts");

function withTree(files: Record<string, string>, run: (srcDir: string) => void): void {
  const root = mkdtempSync(path.join(os.tmpdir(), "arch-check-"));
  const srcDir = path.join(root, "src");
  try {
    for (const [name, content] of Object.entries(files)) {
      const full = path.join(srcDir, name);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    run(srcDir);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const database = 'export const database = { stock: new Map() };\n';

test("the real repository has no architecture violations", () => {
  assert.deepEqual(checkArchitecture(path.join(projectRoot, "src")), []);
});

test("public imports between modules are allowed", () => {
  withTree({
    "orders/service.ts": 'import { pay } from "../payments/index.ts";\nexport const run = pay;\n',
    "payments/index.ts": 'import { impl } from "./internal/impl.ts";\nexport const pay = impl;\n',
    "payments/internal/impl.ts": "export const impl = 1;\n",
  }, (srcDir) => {
    assert.deepEqual(checkArchitecture(srcDir), []);
  });
});

test("importing an internal file of another module is reported", () => {
  withTree({
    "orders/service.ts": 'import { impl } from "../payments/internal/impl.ts";\nexport const run = impl;\n',
    "payments/internal/impl.ts": "export const impl = 1;\n",
  }, (srcDir) => {
    const violations = checkArchitecture(srcDir);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, "internal-import");
    assert.match(violations[0].message, /src\/orders\/service\.ts:1 .*payments/);
  });
});

test("Orders writing Inventory storage directly is reported", () => {
  withTree({
    "database.ts": database,
    "orders/service.ts": 'import { database } from "../database.ts";\nexport const run = () => database.stock.set("a", 1);\n',
  }, (srcDir) => {
    const violations = checkArchitecture(srcDir);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, "inventory-storage");
    assert.match(violations[0].message, /src\/orders\/service\.ts:2/);
  });
});

test("Checkout writing Inventory storage through an alias is reported", () => {
  withTree({
    "database.ts": database,
    "checkout/controller.ts": 'import { database as db } from "../database.ts";\nexport const run = () => db.stock.clear();\n',
  }, (srcDir) => {
    assert.equal(checkArchitecture(srcDir)[0].rule, "inventory-storage");
  });
});

test("Inventory itself may use its own storage", () => {
  withTree({
    "database.ts": database,
    "inventory/index.ts": 'import { database } from "../database.ts";\nexport const run = () => database.stock.set("a", 1);\n',
  }, (srcDir) => {
    assert.deepEqual(checkArchitecture(srcDir), []);
  });
});

test("a file import cycle is reported with its path", () => {
  withTree({
    "inventory/a.ts": 'import { b } from "./b.ts";\nexport const a = () => b;\n',
    "inventory/b.ts": 'import { a } from "./a.ts";\nexport const b = () => a;\n',
  }, (srcDir) => {
    const violations = checkArchitecture(srcDir);
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /src\/inventory\/a\.ts -> src\/inventory\/b\.ts -> src\/inventory\/a\.ts/);
  });
});

test("a cycle between modules is reported even without a file cycle", () => {
  withTree({
    "orders/service.ts": 'import { pay } from "../payments/index.ts";\nexport const run = pay;\n',
    "payments/index.ts": 'import { run } from "../orders/service.ts";\nexport const pay = run;\n',
    "payments/other.ts": 'export const other = 1;\n',
  }, (srcDir) => {
    const messages = checkArchitecture(srcDir).map((v) => v.message);
    assert.ok(messages.some((m) => /between modules: orders -> payments/.test(m)));
  });
});

test("forbidden code mentioned only in comments is ignored", () => {
  withTree({
    "database.ts": database,
    "orders/service.ts": '// database.stock.set() and ../payments/internal/x.ts are forbidden\nexport const run = 1;\n',
  }, (srcDir) => {
    assert.deepEqual(checkArchitecture(srcDir), []);
  });
});

test("the command exits with code 1 and a readable message on a violation", () => {
  withTree({
    "orders/service.ts": 'import { impl } from "../payments/internal/impl.ts";\nexport const run = impl;\n',
    "payments/internal/impl.ts": "export const impl = 1;\n",
  }, (srcDir) => {
    const result = spawnSync(process.execPath, [script, srcDir], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /FAIL \[internal-import\] src\/orders\/service\.ts:1/);
  });
});

test("the command exits with code 0 on the real repository", () => {
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Architecture checks passed/);
});