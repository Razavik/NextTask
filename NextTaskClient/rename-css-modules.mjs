import { readdirSync, statSync, renameSync, readFileSync, writeFileSync } from "fs";
import { join, basename, dirname } from "path";

function walk(dir, exts, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, exts, results);
    } else if (exts.some((e) => full.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const cssFiles = walk("src", [".module.css"]);

for (const file of cssFiles) {
  const name = basename(file);
  if (name === "index.module.css") continue;
  const target = join(dirname(file), "index.module.css");
  renameSync(file, target);
  console.log(`renamed: ${file} -> ${target}`);
}

const codeFiles = walk("src", [".ts", ".tsx"]);
let updated = 0;

for (const file of codeFiles) {
  let content = readFileSync(file, "utf8");
  const original = content;
  content = content.replace(/(['"])([^'"]+\.module\.css)\1/g, (match, quote, path) => {
    const updatedPath = path.replace(/[^/\\]+\.module\.css$/, "index.module.css");
    return `${quote}${updatedPath}${quote}`;
  });
  if (content !== original) {
    writeFileSync(file, content, "utf8");
    updated++;
    console.log(`updated: ${file}`);
  }
}

console.log(`\nUpdated imports in ${updated} files.`);
