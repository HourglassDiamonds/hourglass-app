import { hashExecutiveDashboardPassword } from "../lib/executive-dashboard/password.ts";

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

const password = input.replace(/\r?\n$/, "");
if (!password || /[\r\n]/.test(password)) {
  process.stderr.write("A single non-empty password is required on stdin.\n");
  process.exit(1);
}

process.stdout.write(`${hashExecutiveDashboardPassword(password)}\n`);
