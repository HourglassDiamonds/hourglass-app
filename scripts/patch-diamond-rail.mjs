import fs from "fs";

const path = "app/diamond-studio/page.tsx";
let s = fs.readFileSync(path, "utf8");

const fingerMetric = `            <p className="dts-metric-row finger-width" aria-label="Finger width">
              <span className="dts-metric-row__text">
                Finger width:{" "}
                <span className="dts-metric-row__val">
                  {fingerMm.toFixed(1)} mm
                </span>{" "}
                inside diameter
              </span>
            </p>`;

const diamondMetric = `            <p className="dts-metric-row" aria-label="Diamond width">
              <span className="dts-metric-row__text">
                Diamond width:{" "}
                <span className="dts-metric-row__val">
                  {diamondReadoutMm.toFixed(1)} mm
                </span>{" "}
                face-up diameter
              </span>
            </p>`;

function sliceDiv(text, openIndex) {
  let depth = 0;
  let pos = openIndex;
  while (pos < text.length) {
    const nextOpen = text.indexOf("<div", pos);
    const nextClose = text.indexOf("</div>", pos);
    if (nextClose === -1) throw new Error("unclosed div");
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      pos = nextClose + 6;
      if (depth === 0) return text.slice(openIndex, pos);
    }
  }
  throw new Error("slice failed");
}

const fingerIdx = s.indexOf("dts-width-readout finger-width");
if (fingerIdx === -1) throw new Error("finger readout not found");
const fingerOpen = s.lastIndexOf("<motion", fingerIdx);
const fingerOpenDiv = s.lastIndexOf("<div", fingerIdx);
const fingerStart = Math.max(fingerOpen, fingerOpenDiv);
const fingerBlock = sliceDiv(s, fingerStart);
s = s.slice(0, fingerStart) + fingerMetric + s.slice(fingerStart + fingerBlock.length);

const railMarker = 'className="dts-rail-tail control-column"';
const railIdx = s.indexOf(railMarker);
if (railIdx === -1) throw new Error("rail-tail not found");
const railOpen = s.lastIndexOf("<div", railIdx);
let railTailBlock = sliceDiv(s, railOpen);

const diamondIdx = railTailBlock.indexOf('aria-label="Diamond width"');
if (diamondIdx === -1) throw new Error("diamond readout not in rail");
const diamondOpen = railTailBlock.lastIndexOf("<div", diamondIdx);
const diamondBlock = sliceDiv(railTailBlock, diamondOpen);
railTailBlock =
  railTailBlock.slice(0, diamondOpen) +
  diamondMetric +
  railTailBlock.slice(diamondOpen + diamondBlock.length);

s = s.slice(0, railOpen) + s.slice(railOpen + railTailBlock.length);

const stageMarker = 'className="dts-stage-stack"';
const stageIdx = s.indexOf(stageMarker);
if (stageIdx === -1) throw new Error("stage-stack not found");
const stageOpen = s.lastIndexOf("<div", stageIdx);

const jsxBeforeStage = s.slice(0, stageOpen);
if (jsxBeforeStage.includes(railMarker)) {
  throw new Error("rail-tail still before stage in JSX");
}

if (!jsxBeforeStage.includes("</aside>")) {
  s =
    s.slice(0, stageOpen) +
    railTailBlock +
    "\n          </aside>\n\n          " +
    s.slice(stageOpen);
} else {
  throw new Error("aside already closed before stage");
}

if ((s.match(/className="dts-rail-tail control-column"/g) || []).length > 1) {
  throw new Error("duplicate rail-tail");
}

fs.writeFileSync(path, s);
console.log("Patched", path);
