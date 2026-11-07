import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type Violation = {
  rule: "internal-import" | "inventory-storage" | "dependency-cycle";
  message: string;
};

type ImportRef = { specifier: string; line: number };
type SourceFile = { abs: string; rel: string; module: string; text: string; imports: ImportRef[] };

const STOCK_ACCESS_MODULES = new Set(["orders", "checkout"]);

function listSourceFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listSourceFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) result.push(full);
  }
  return result.sort();
}

// Replaces comments with spaces (keeping line breaks) so that code mentioned in comments is ignored.
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
    } else if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
    } else if (ch === "/" && next === "*") {
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += "  ";
      i += 2;
    } else {
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      out += ch;
      i += 1;
    }
  }
  return out;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === "\n") line += 1;
  return line;
}

function parseImports(text: string): ImportRef[] {
  const found: ImportRef[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const at = (match.index ?? 0) + match[0].lastIndexOf(specifier);
      found.push({ specifier, line: lineOf(text, at) });
    }
  }
  return found;
}

// The first path segment is the module; a file directly in src/ is its own module.
function moduleOf(rel: string): string {
  return rel.split("/")[0];
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function resolveImport(fromAbs: string, specifier: string): { target: string; exists: boolean } {
  const base = path.resolve(path.dirname(fromAbs), specifier);
  for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return { target: candidate, exists: true };
  }
  return { target: base, exists: false };
}

function findCycles(edges: Map<string, Set<string>>): string[][] {
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  function visit(node: string): void {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of edges.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node)!, low.get(next)!));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node)!, index.get(next)!));
      }
    }
    if (low.get(node) === index.get(node)) {
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      components.push(component);
    }
  }

  for (const node of [...edges.keys()].sort()) if (!index.has(node)) visit(node);

  const cycles: string[][] = [];
  for (const component of components) {
    const members = new Set(component);
    const start = [...members].sort()[0];
    if (members.size === 1 && !edges.get(start)?.has(start)) continue;

    const path_: string[] = [start];
    const seen = new Set<string>([start]);
    const walk = (node: string): boolean => {
      for (const next of [...(edges.get(node) ?? [])].sort()) {
        if (!members.has(next)) continue;
        if (next === start) {
          path_.push(start);
          return true;
        }
        if (seen.has(next)) continue;
        seen.add(next);
        path_.push(next);
        if (walk(next)) return true;
        path_.pop();
      }
      return false;
    };
    if (walk(start)) cycles.push(path_);
  }
  return cycles;
}

export function checkArchitecture(srcDir: string): Violation[] {
  const rootDir = path.dirname(srcDir);
  const display = (abs: string) => toPosix(path.relative(rootDir, abs));

  const files: SourceFile[] = listSourceFiles(srcDir).map((abs) => {
    const rel = toPosix(path.relative(srcDir, abs));
    const text = stripComments(readFileSync(abs, "utf8"));
    return { abs, rel, module: moduleOf(rel), text, imports: parseImports(text) };
  });

  const violations: Violation[] = [];
  const fileEdges = new Map<string, Set<string>>();
  const moduleEdges = new Map<string, Set<string>>();
  const moduleEvidence = new Map<string, string>();

  for (const file of files) {
    fileEdges.set(file.rel, fileEdges.get(file.rel) ?? new Set());
    moduleEdges.set(file.module, moduleEdges.get(file.module) ?? new Set());

    for (const imp of file.imports) {
      const { target, exists } = resolveImport(file.abs, imp.specifier);
      const targetRel = toPosix(path.relative(srcDir, target));
      if (targetRel.startsWith("..")) continue;
      const targetModule = moduleOf(targetRel);
      const where = `${display(file.abs)}:${imp.line}`;

      if (targetRel.split("/").includes("internal") && targetModule !== file.module) {
        violations.push({
          rule: "internal-import",
          message: `${where} module "${file.module}" imports internal file of module "${targetModule}": ${imp.specifier}`,
        });
      }

      if (exists) {
        fileEdges.get(file.rel)!.add(targetRel);
        if (targetModule !== file.module) {
          moduleEdges.get(file.module)!.add(targetModule);
          const key = `${file.module}>${targetModule}`;
          if (!moduleEvidence.has(key)) moduleEvidence.set(key, where);
        }
      }
    }

    if (STOCK_ACCESS_MODULES.has(file.module)) {
      const stockAccess =
        /\.\s*stock\b|\[\s*["']stock["']\s*\]|\{[^}]*\bstock\b[^}]*\}\s*=\s*\w+/g;
      for (const match of file.text.matchAll(stockAccess)) {
        violations.push({
          rule: "inventory-storage",
          message: `${display(file.abs)}:${lineOf(file.text, match.index ?? 0)} module "${file.module}" reads or writes Inventory storage directly; use the public API of inventory`,
        });
      }
    }
  }

  for (const cycle of findCycles(fileEdges)) {
    violations.push({
      rule: "dependency-cycle",
      message: `import cycle between files: ${cycle.map((f) => `src/${f}`).join(" -> ")}`,
    });
  }

  for (const cycle of findCycles(moduleEdges)) {
    const steps = cycle
      .slice(0, -1)
      .map((m, i) => `${m} -> ${cycle[i + 1]} (${moduleEvidence.get(`${m}>${cycle[i + 1]}`)})`);
    violations.push({
      rule: "dependency-cycle",
      message: `dependency cycle between modules: ${steps.join("; ")}`,
    });
  }

  return violations;
}