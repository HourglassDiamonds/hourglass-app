import fs from "fs";

const p = "app/diamond-studio/page.tsx";
let s = fs.readFileSync(p, "utf8");

const c = "</" + "motion".replace("motion", "div");

s = s.replaceAll("</motion>", c);

const bad =
  `          ${c}\r\n        ${c}\r\n      ${c}\r\n    ${c}\r\n          </aside>`;
const good = `          ${c}\r\n          </aside>`;

if (!s.includes(bad)) {
  console.error("bad block not found");
  process.exit(1);
}
s = s.replace(bad, good);

fs.writeFileSync(p, s);
console.log("fixed");
