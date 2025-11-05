import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const ROOT = path.resolve("public/scripts");

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const bareD3 = /from\s+["']d3(?:["'\/])/;
  const absoluteImport = /from\s+["']\//;
  const violations = [];
  if (bareD3.test(content)) {
    violations.push("imports bare d3 bundle");
  }
  if (absoluteImport.test(content)) {
    violations.push("uses absolute import path");
  }
  return violations;
}

const files = statSync(ROOT, { throwIfNoEntry: false }) ? walk(ROOT) : [];

const problems = [];
for (const file of files) {
  const issues = checkFile(file);
  if (issues.length > 0) {
    problems.push({ file, issues });
  }
}

if (problems.length > 0) {
  console.error("Found disallowed imports in build output:\n");
  for (const problem of problems) {
    console.error(`- ${path.relative(process.cwd(), problem.file)}: ${problem.issues.join(", ")}`);
  }
  process.exitCode = 1;
}
