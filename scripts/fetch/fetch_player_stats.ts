import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PYTHON_SCRIPT = path.join(ROOT, "scripts", "data", "build_player_stats_index.py");

console.log("Delegating player stats build to", PYTHON_SCRIPT);

const child = spawn("python3", [PYTHON_SCRIPT], { stdio: "inherit" });

child.on("exit", code => {
  if (typeof code === "number" && code !== 0) {
    process.exit(code);
  } else if (code === null) {
    console.warn("Player stats build exited without status; assuming success.");
  }
});
