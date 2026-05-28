import { readFileSync } from "fs";

async function main() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const path =
    process.argv[2] ??
    "data/light-performance-calibration/uploads/1779546949531-353466126.pdf";

  const data = new Uint8Array(readFileSync(path));

  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  type TextItem = {
    str?: string;
    transform?: number[];
    hasEOL?: boolean;
  };

  function pageTextFromContent(items: TextItem[]) {
    const lines: string[] = [];
    let line = "";
    let lastY: number | null = null;

    for (const item of items) {
      const str = typeof item.str === "string" ? item.str : "";
      if (!str) continue;

      const y = item.transform?.[5];

      if (
        y !== undefined &&
        lastY !== null &&
        Math.abs(y - lastY) > 4 &&
        line.trim()
      ) {
        lines.push(line.trim());
        line = str;
      } else {
        line += line ? (item.hasEOL ? "\n" : " ") + str : str;
      }

      if (item.hasEOL && line.trim()) {
        lines.push(line.trim());
        line = "";
      }

      if (y !== undefined) lastY = y;
    }

    if (line.trim()) lines.push(line.trim());

    return lines.join("\n");
  }

  const parts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(pageTextFromContent(content.items as TextItem[]));
  }

  const text = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();

  console.log("\n======================");
  console.log("TEXT LENGTH:", text.length);
  console.log("FILE:", path);
  console.log("======================\n");

  const labels = [
    "Table",
    "Crown",
    "Pavilion",
    "Star",
    "Lower",
    "Girdle",
    "Culet",
    "Depth",
    "Carat",
    "Proportion",
    "Polish",
    "Symmetry",
  ];

  for (const lab of labels) {
    const idx = text.search(new RegExp(lab, "i"));

    if (idx >= 0) {
      console.log("\n--- around " + lab + " ---\n");
      console.log(text.slice(Math.max(0, idx - 120), idx + 300));
    }
  }

  const propIdx = text.search(/proportion/i);

  if (propIdx >= 0) {
    console.log("\n======================");
    console.log("PROPORTION BLOCK");
    console.log("======================\n");
    console.log(text.slice(propIdx, propIdx + 1500));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
