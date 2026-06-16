import type { GiaDiagramBandOcr } from "../parsers/gia/gia-diagram-extraction";
import { LGDR2536297567_DIAGRAM_BANDS } from "./lgdr2536297567-diagram-bands";

/** First-pass LGDR diagram OCR degraded like intermittent Railway production. */
export const LGDR2536297567_DEGRADED_FIRST_PASS_BANDS: GiaDiagramBandOcr[] =
  LGDR2536297567_DIAGRAM_BANDS.map((band) => {
    if (band.id === "header") {
      return {
        ...band,
        text: "50% 59%\n14.5% 35.5\n",
      };
    }
    if (band.id === "stack" || band.id === "lgdr-diagram-region") {
      return { ...band, text: "" };
    }
    if (band.id === "crown") {
      return {
        ...band,
        text: "43.5% 41.0\n3.5%\n80%\n",
      };
    }
    if (band.id === "crown-angle") {
      return { ...band, text: "14.5% 35.5\n41.0" };
    }
    if (["girdle", "culet-depth", "pavilion"].includes(band.id)) {
      return { ...band, text: "Profile to actual proportions" };
    }
    return band;
  });

export const LGDR2536297567_RETRY_STACK_TEXT =
  "medium\nslightly 61 5%\nthick 1 °\n(faceted) 43.5% 41.0\n3.5%\n80%\nnone";

export const LGDR2536297567_RETRY_REGION_TEXT =
  "50% 59%\n14.5% 35.5°\nslightly 61.5%\n3.5%\n80%\nnone";
