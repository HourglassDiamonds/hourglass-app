import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";

const [directoryArg, token, parentPidArg, deadlineArg] = process.argv.slice(2);
const directory = resolve(directoryArg ?? "");
const root = resolve(tmpdir());
const child = relative(root, directory);
const parentPid = Number(parentPidArg);
const deadline = Number(deadlineArg);

function safeTarget() {
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) &&
    basename(directory).startsWith("continuum-sterling-shadow-") && /^[a-f0-9]{64}$/.test(token ?? "");
}
function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function removeExactOwnedDirectory() {
  if (!safeTarget()) return;
  try {
    const owner = JSON.parse(await readFile(join(directory, ".continuum-evidence-owner.json"), "utf8"));
    if (owner.token !== token) return;
    await rm(directory, { recursive: true, force: true });
  } catch {
    // The controller may already have removed it.
  }
}

if (safeTarget() && Number.isFinite(deadline)) {
  while (processAlive(parentPid) && Date.now() < deadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  await removeExactOwnedDirectory();
}
