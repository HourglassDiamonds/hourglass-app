import fs from "fs";

const p = "app/diamond-studio/page.tsx";
let s = fs.readFileSync(p, "utf8");

const desktopOld = `        .dts-rail-top{
          grid-column:1;
          grid-row:1;
          align-self:start;
          max-height:calc(50dvh - 52px);
          overflow-y:auto;
          overflow-x:hidden;
          padding:18px 18px 12px 22px;
          display:flex;
          flex-direction:column;
          gap:28px;
          scrollbar-width:thin;
          scrollbar-color:var(--sb-thumb) transparent;
          min-width:0;
        }
        .dts-rail-tail{
          grid-column:1;
          grid-row:1;
          align-self:end;
          max-height:calc(50dvh - 52px);
          overflow-y:auto;
          overflow-x:hidden;
          padding:12px 18px 22px 22px;
          display:flex;
          flex-direction:column;
          gap:28px;
          border-top:1px solid oklch(from var(--hairline-soft) l c h / 0.5);
          scrollbar-width:thin;
          scrollbar-color:var(--sb-thumb) transparent;
          min-width:0;
        }
        .dts-rail-top:hover,
        .dts-rail-tail:hover{
          scrollbar-color:var(--sb-thumb-hover) transparent;
        }
        .dts-rail-top::-webkit-scrollbar,
        .dts-rail-tail::-webkit-scrollbar{ width:3px; }
        .dts-rail-top::-webkit-scrollbar-thumb,
        .dts-rail-tail::-webkit-scrollbar-thumb{
          background-color:var(--sb-thumb);
          border-radius:100px;
          border:1px solid transparent;
          background-clip:padding-box;
        }
        .dts-stage-stack{
          grid-column:2;
          grid-row:1;
          align-self:stretch;
          min-width:0;
          min-height:0;
          display:flex;
          flex-direction:column;
        }`;

const desktopNew = `        .dts-control-rail{
          grid-column:1;
          grid-row:1;
          align-self:stretch;
          min-height:0;
          min-width:0;
          overflow-x:hidden;
          overflow-y:auto;
          overscroll-behavior:contain;
          padding:16px 18px 16px 22px;
          display:flex;
          flex-direction:column;
          gap:20px;
          scrollbar-width:none;
          -ms-overflow-style:none;
        }
        .dts-control-rail::-webkit-scrollbar{
          width:0;
          height:0;
        }
        .dts-control-rail > *,
        .dts-control-rail section,
        .dts-control-rail .dts-card,
        .dts-control-rail .dts-card--coverage,
        .dts-control-rail .dts-card-metric{
          flex-shrink:0;
          overflow:visible;
          height:auto;
          max-height:none;
          position:static;
        }
        .dts-stage-stack{
          grid-column:2;
          grid-row:1;
          align-self:stretch;
          min-width:0;
          min-height:0;
          display:flex;
          flex-direction:column;
          overflow:hidden;
        }`;

if (s.includes(desktopOld)) s = s.replace(desktopOld, desktopNew);
else console.warn("desktop rail block not found");

s = s.replace(
  `      .dts-rail-top,
      .dts-rail-tail{
        display:flex;
        flex-direction:column;
        gap:28px;
        min-width:0;
      }`,
  `      .dts-control-rail{
        display:flex;
        flex-direction:column;
        gap:20px;
        min-width:0;
      }`,
);

s = s.replace(
  /\.dts-width-readout\{[^}]*\}\s*/g,
  "",
);
s = s.replace(
  /\.dts-width-readout \.dts-eyebrow\{[^}]*\}\s*/g,
  "",
);
s = s.replace(
  /\.dts-width-readout \.dts-wval\{[^}]*\}\s*/g,
  "",
);
s = s.replace(
  /\.dts-width-readout \.dts-wval sub\{[^}]*\}\s*/g,
  "",
);
s = s.replace(
  /\.dts-width-readout \.dts-cap\{[^}]*\}\s*/g,
  "",
);

if (!s.includes(".dts-card-metric{")) {
  s = s.replace(
    ".dts-ticks-carat span.is-current{ color:var(--ink); font-weight:500; }",
    `.dts-ticks-carat span.is-current{ color:var(--ink); font-weight:500; }
      .dts-card-metric{
        margin:10px 0 0;
        padding:0 2px;
        text-align:center;
      }
      .dts-card-metric__text{
        font-size:10.5px;
        line-height:1.45;
        color:var(--ink-soft);
        letter-spacing:0.01em;
      }
      .dts-card-metric__val{
        font-family:var(--serif);
        font-size:12.5px;
        color:var(--ink);
        font-variant-numeric:tabular-nums;
      }`,
  );
}

if (!s.includes("diamond-studio-viewport-lock")) {
  s = s.replace(
    ".dts-shell{",
    `@media (min-width: 769px) {
        html.diamond-studio-viewport-lock,
        html.diamond-studio-viewport-lock body{
          overflow:hidden !important;
          height:100vh !important;
          max-height:100vh !important;
        }
        html.diamond-studio-viewport-lock body > div,
        html.diamond-studio-viewport-lock body main{
          min-height:0 !important;
          height:100vh !important;
          max-height:100vh !important;
          overflow:hidden !important;
        }
      }
      .dts-shell{`,
  );

  s = s.replace(
    ".dts-app{ position:relative; z-index:1; width:100%; height:100%;\n        display:grid; grid-template-rows:minmax(60px,auto) 1fr; }",
    `.dts-app{ position:relative; z-index:1; width:100%; height:100%;
        display:grid; grid-template-rows:minmax(60px,auto) 1fr; }
      @media (min-width: 769px) {
        .dts-shell{
          height:100vh;
          max-height:100vh;
          overflow:hidden;
        }
        .dts-app{
          height:100vh;
          max-height:100vh;
          overflow:hidden;
          grid-template-rows:var(--dts-topbar-h, 60px) minmax(0, 1fr);
        }
        .dts-main{
          min-height:0;
          overflow:hidden;
        }
      }`,
  );
}

const mobileRailOld = `        .dts-rail-top{
          width:100%;
          max-width:none;
          position:relative;
          transform:none;
          flex:0 0 auto;
          padding:20px 20px 4px;
          gap:22px;
          overflow-x:hidden;
          overflow-y:visible;
        }
        .dts-rail-tail{
          width:100%;
          max-width:none;
          position:relative;
          transform:none;
          flex:0 0 auto;
          padding:4px 20px 36px;
          gap:22px;
          overflow-x:hidden;
          overflow-y:visible;
          border-top:1px solid oklch(from var(--hairline-soft) l c h / 0.45);
        }`;

const mobileRailNew = `        .dts-control-rail{
          display:contents;
        }
        .dts-main .dts-card[aria-label="Finger size"],
        .dts-main .dts-card[aria-label="Skin tone"],
        .dts-main .dts-card[aria-label="Stone orientation"]{
          order:1;
        }
        .dts-stage-stack{
          order:2;
        }
        .dts-main .dts-card[aria-label="Carat weight"],
        .dts-main .dts-card[aria-label="Finger coverage"]{
          order:3;
        }`;

if (s.includes(mobileRailOld)) s = s.replace(mobileRailOld, mobileRailNew);
else console.warn("mobile rail block not found");

s = s.replace(
  /\n        \.dts-width-readout\{\n          padding:12px 0 10px;\n        \}\n/,
  "\n",
);

s = s.replace(
  /\n        \/\* TEMP mobile debug:[\s\S]*?transform:translateY\(40px\) !important;\n        \}\n/,
  "\n",
);

s = s.replace(
  /\n        \.dts-mobile-debug-725\{[\s\S]*?\}\n/,
  "\n",
);

s = s.replace(
  `        .dts-rail-top,
        .dts-rail-tail,
        .dts-rail-top::-webkit-scrollbar-thumb,
        .dts-rail-tail::-webkit-scrollbar-thumb{
          transition-duration:0.01ms;
        }`,
  `        .dts-control-rail{
          transition-duration:0.01ms;
        }`,
);

fs.writeFileSync(p, s);
console.log("width-readout in jsx:", s.includes('className="dts-width-readout'));
console.log("rail-top css:", s.includes(".dts-rail-top{"));
console.log("control-rail css:", s.includes(".dts-control-rail{"));
