import fs from "fs";

const p = "app/diamond-studio/page.tsx";
let s = fs.readFileSync(p, "utf8");

const t = "di" + "v";
const ot = "<" + t;
const ct = "</" + t + ">";

const diamondMetric = `
              <p className="dts-card-metric" aria-label="Diamond width">
                <span className="dts-card-metric__text">
                  Diamond width:{" "}
                  <span className="dts-card-metric__val">
                    {diamondReadoutMm.toFixed(1)} mm
                  </span>{" "}
                  face-up diameter
                </span>
              </p>
`;

const tailRe = new RegExp(
  ot.replace("<", "\\<") +
    ' className="dts-rail-tail control-column">\\s*' +
    "(<section className=\"dts-card\" aria-label=\"Carat weight\">[\\s\\S]*?</section>)\\s*" +
    ot.replace("<", "\\<") +
    ' className="dts-width-readout"[\\s\\S]*?' +
    "(<section className=\"dts-card dts-card--coverage\"[\\s\\S]*?</section>)\\s*" +
    ct.replace("</", "\\</"),
);

const tail = tailRe.exec(s);
if (!tail) throw new Error("rail-tail parse failed");
const caratCov =
  tail[1] +
  diamondMetric +
  "\n            " +
  tail[2];
s = s.slice(0, tail.index) + s.slice(tail.index + tail[0].length);

const fingerRe = new RegExp(
  ot.replace("<", "\\<") +
    ' className="dts-width-readout finger-width">[\\s\\S]*?' +
    ct.replace("</", "\\</") +
    "\\s*" +
    ct.replace("</", "\\</") +
    "\\s*" +
    '(<div className="dts-stage-stack">)',
);
const finger = fingerRe.exec(s);
if (!finger) throw new Error("finger readout parse failed");
s =
  s.slice(0, finger.index) +
  caratCov +
  "\n          </aside>\n\n          " +
  finger[1] +
  s.slice(finger.index + finger[0].length);

s = s.replace(
  /\s*\{isMobileViewport \? \([\s\S]*?MOBILE DEBUG 725[\s\S]*?\) : null\}/,
  "",
);

fs.writeFileSync(p, s);
console.log("rail-top:", s.includes("dts-rail-top"));
console.log("rail-tail:", s.includes("dts-rail-tail"));
console.log("width-readout:", s.includes("dts-width-readout"));
console.log("control-rail:", s.includes("dts-control-rail"));
console.log("metrics:", (s.match(/dts-card-metric/g) || []).length);
