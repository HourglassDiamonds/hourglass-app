/**
 * Published Geller 14kt per-dwt Cost Parts bands.
 * Source: RepairTaskSKUs.2026-08-26-17-29-10.xlsx · Version 5.0 Release 6.50.
 * Invalid inverted-range row ($2500-$2299) excluded. Do not interpolate inside a published band.
 */

export type Published14kGoldBand = {
  sku: string;
  goldUsdPerOzMin: number;
  goldUsdPerOzMax: number;
  pricePartsCents: number;
  costPartsCents: number;
};

/** OLS: costCentsPerDwt = (slopeMicro * goldUsdPerOz + interceptMicro) / 1_000_000 */
export const GELLER_14K_COST_OLS = {
  slopeMicro: 3206215,
  interceptMicro: -15676451,
  sampleCount: 70,
} as const;

export const GELLER_14K_GOLD_BANDS: readonly Published14kGoldBand[] = [
  { sku: "100000", goldUsdPerOzMin: 500, goldUsdPerOzMax: 549, pricePartsCents: 4900, costPartsCents: 1600 },
  { sku: "100001", goldUsdPerOzMin: 550, goldUsdPerOzMax: 599, pricePartsCents: 5300, costPartsCents: 1800 },
  { sku: "100002", goldUsdPerOzMin: 600, goldUsdPerOzMax: 649, pricePartsCents: 5800, costPartsCents: 1900 },
  { sku: "100003", goldUsdPerOzMin: 650, goldUsdPerOzMax: 699, pricePartsCents: 6300, costPartsCents: 2100 },
  { sku: "100004", goldUsdPerOzMin: 700, goldUsdPerOzMax: 749, pricePartsCents: 6800, costPartsCents: 2300 },
  { sku: "100005", goldUsdPerOzMin: 750, goldUsdPerOzMax: 799, pricePartsCents: 7300, costPartsCents: 2400 },
  { sku: "100006", goldUsdPerOzMin: 800, goldUsdPerOzMax: 849, pricePartsCents: 7800, costPartsCents: 2600 },
  { sku: "100007", goldUsdPerOzMin: 850, goldUsdPerOzMax: 899, pricePartsCents: 8300, costPartsCents: 2800 },
  { sku: "100008", goldUsdPerOzMin: 900, goldUsdPerOzMax: 949, pricePartsCents: 8800, costPartsCents: 2900 },
  { sku: "100009", goldUsdPerOzMin: 950, goldUsdPerOzMax: 999, pricePartsCents: 9200, costPartsCents: 3100 },
  { sku: "100010", goldUsdPerOzMin: 1000, goldUsdPerOzMax: 1049, pricePartsCents: 10000, costPartsCents: 3300 },
  { sku: "100011", goldUsdPerOzMin: 1050, goldUsdPerOzMax: 1099, pricePartsCents: 10500, costPartsCents: 3500 },
  { sku: "100012", goldUsdPerOzMin: 1100, goldUsdPerOzMax: 1149, pricePartsCents: 11000, costPartsCents: 3700 },
  { sku: "100013", goldUsdPerOzMin: 1150, goldUsdPerOzMax: 1199, pricePartsCents: 11400, costPartsCents: 3800 },
  { sku: "100014", goldUsdPerOzMin: 1200, goldUsdPerOzMax: 1249, pricePartsCents: 11900, costPartsCents: 4000 },
  { sku: "100015", goldUsdPerOzMin: 1250, goldUsdPerOzMax: 1299, pricePartsCents: 12400, costPartsCents: 4100 },
  { sku: "100016", goldUsdPerOzMin: 1300, goldUsdPerOzMax: 1349, pricePartsCents: 12900, costPartsCents: 4300 },
  { sku: "100017", goldUsdPerOzMin: 1350, goldUsdPerOzMax: 1399, pricePartsCents: 13300, costPartsCents: 4400 },
  { sku: "100018", goldUsdPerOzMin: 1400, goldUsdPerOzMax: 1449, pricePartsCents: 13800, costPartsCents: 4600 },
  { sku: "100019", goldUsdPerOzMin: 1450, goldUsdPerOzMax: 1499, pricePartsCents: 14300, costPartsCents: 4800 },
  { sku: "100020", goldUsdPerOzMin: 1500, goldUsdPerOzMax: 1549, pricePartsCents: 14800, costPartsCents: 4900 },
  { sku: "100021", goldUsdPerOzMin: 1550, goldUsdPerOzMax: 1599, pricePartsCents: 15200, costPartsCents: 5100 },
  { sku: "100022", goldUsdPerOzMin: 1600, goldUsdPerOzMax: 1649, pricePartsCents: 15700, costPartsCents: 5200 },
  { sku: "100023", goldUsdPerOzMin: 1650, goldUsdPerOzMax: 1699, pricePartsCents: 16200, costPartsCents: 5400 },
  { sku: "100024", goldUsdPerOzMin: 1700, goldUsdPerOzMax: 1749, pricePartsCents: 16700, costPartsCents: 5600 },
  { sku: "100025", goldUsdPerOzMin: 1750, goldUsdPerOzMax: 1799, pricePartsCents: 17200, costPartsCents: 5700 },
  { sku: "100026", goldUsdPerOzMin: 1800, goldUsdPerOzMax: 1849, pricePartsCents: 17600, costPartsCents: 5900 },
  { sku: "100027", goldUsdPerOzMin: 1850, goldUsdPerOzMax: 1899, pricePartsCents: 18100, costPartsCents: 6000 },
  { sku: "100028", goldUsdPerOzMin: 1900, goldUsdPerOzMax: 1949, pricePartsCents: 15600, costPartsCents: 5200 },
  { sku: "100029", goldUsdPerOzMin: 1950, goldUsdPerOzMax: 1999, pricePartsCents: 19100, costPartsCents: 6400 },
  { sku: "100030", goldUsdPerOzMin: 2000, goldUsdPerOzMax: 2049, pricePartsCents: 19500, costPartsCents: 6500 },
  { sku: "100031", goldUsdPerOzMin: 2050, goldUsdPerOzMax: 2099, pricePartsCents: 20000, costPartsCents: 6700 },
  { sku: "100032", goldUsdPerOzMin: 2100, goldUsdPerOzMax: 2149, pricePartsCents: 20500, costPartsCents: 6800 },
  { sku: "100033", goldUsdPerOzMin: 2150, goldUsdPerOzMax: 2199, pricePartsCents: 20900, costPartsCents: 7000 },
  { sku: "100034", goldUsdPerOzMin: 2200, goldUsdPerOzMax: 2249, pricePartsCents: 21400, costPartsCents: 7100 },
  { sku: "100036", goldUsdPerOzMin: 2300, goldUsdPerOzMax: 2349, pricePartsCents: 22400, costPartsCents: 7500 },
  { sku: "100037", goldUsdPerOzMin: 2350, goldUsdPerOzMax: 2399, pricePartsCents: 22900, costPartsCents: 7600 },
  { sku: "100038", goldUsdPerOzMin: 2400, goldUsdPerOzMax: 2449, pricePartsCents: 23300, costPartsCents: 7800 },
  { sku: "100039", goldUsdPerOzMin: 2450, goldUsdPerOzMax: 2499, pricePartsCents: 23800, costPartsCents: 7900 },
  { sku: "100040", goldUsdPerOzMin: 2500, goldUsdPerOzMax: 2549, pricePartsCents: 24300, costPartsCents: 8100 },
  { sku: "100041", goldUsdPerOzMin: 2550, goldUsdPerOzMax: 2599, pricePartsCents: 24800, costPartsCents: 8300 },
  { sku: "100042", goldUsdPerOzMin: 2600, goldUsdPerOzMax: 2649, pricePartsCents: 25300, costPartsCents: 8400 },
  { sku: "100043", goldUsdPerOzMin: 2650, goldUsdPerOzMax: 2699, pricePartsCents: 25700, costPartsCents: 8600 },
  { sku: "100044", goldUsdPerOzMin: 2700, goldUsdPerOzMax: 2749, pricePartsCents: 26200, costPartsCents: 8700 },
  { sku: "100045", goldUsdPerOzMin: 2750, goldUsdPerOzMax: 2799, pricePartsCents: 26700, costPartsCents: 8900 },
  { sku: "100046", goldUsdPerOzMin: 2800, goldUsdPerOzMax: 2849, pricePartsCents: 27200, costPartsCents: 9100 },
  { sku: "100047", goldUsdPerOzMin: 2850, goldUsdPerOzMax: 2899, pricePartsCents: 27600, costPartsCents: 9200 },
  { sku: "100048", goldUsdPerOzMin: 2900, goldUsdPerOzMax: 2949, pricePartsCents: 28100, costPartsCents: 9400 },
  { sku: "100049", goldUsdPerOzMin: 2950, goldUsdPerOzMax: 2999, pricePartsCents: 28600, costPartsCents: 9500 },
  { sku: "100050", goldUsdPerOzMin: 3000, goldUsdPerOzMax: 3049, pricePartsCents: 29100, costPartsCents: 9700 },
  { sku: "100051", goldUsdPerOzMin: 3050, goldUsdPerOzMax: 3099, pricePartsCents: 29500, costPartsCents: 9800 },
  { sku: "100052", goldUsdPerOzMin: 3100, goldUsdPerOzMax: 3149, pricePartsCents: 30000, costPartsCents: 10000 },
  { sku: "100053", goldUsdPerOzMin: 3150, goldUsdPerOzMax: 3199, pricePartsCents: 30500, costPartsCents: 10200 },
  { sku: "100054", goldUsdPerOzMin: 3200, goldUsdPerOzMax: 3249, pricePartsCents: 31000, costPartsCents: 10300 },
  { sku: "100055", goldUsdPerOzMin: 3250, goldUsdPerOzMax: 3299, pricePartsCents: 31400, costPartsCents: 10500 },
  { sku: "100056", goldUsdPerOzMin: 3300, goldUsdPerOzMax: 3349, pricePartsCents: 31900, costPartsCents: 10600 },
  { sku: "100057", goldUsdPerOzMin: 3350, goldUsdPerOzMax: 3399, pricePartsCents: 32400, costPartsCents: 10800 },
  { sku: "100058", goldUsdPerOzMin: 3400, goldUsdPerOzMax: 3449, pricePartsCents: 32900, costPartsCents: 11000 },
  { sku: "100059", goldUsdPerOzMin: 3450, goldUsdPerOzMax: 3499, pricePartsCents: 33400, costPartsCents: 11100 },
  { sku: "100060", goldUsdPerOzMin: 3500, goldUsdPerOzMax: 3549, pricePartsCents: 33800, costPartsCents: 11300 },
  { sku: "100061", goldUsdPerOzMin: 3500, goldUsdPerOzMax: 3599, pricePartsCents: 34300, costPartsCents: 11400 },
  { sku: "100062", goldUsdPerOzMin: 3600, goldUsdPerOzMax: 3649, pricePartsCents: 34800, costPartsCents: 11600 },
  { sku: "100063", goldUsdPerOzMin: 3650, goldUsdPerOzMax: 3699, pricePartsCents: 35300, costPartsCents: 11800 },
  { sku: "100064", goldUsdPerOzMin: 3700, goldUsdPerOzMax: 3749, pricePartsCents: 35700, costPartsCents: 11900 },
  { sku: "100065", goldUsdPerOzMin: 3750, goldUsdPerOzMax: 3799, pricePartsCents: 36200, costPartsCents: 12100 },
  { sku: "100066", goldUsdPerOzMin: 3800, goldUsdPerOzMax: 3849, pricePartsCents: 36700, costPartsCents: 12200 },
  { sku: "100067", goldUsdPerOzMin: 3850, goldUsdPerOzMax: 3899, pricePartsCents: 37200, costPartsCents: 12400 },
  { sku: "100068", goldUsdPerOzMin: 3900, goldUsdPerOzMax: 3949, pricePartsCents: 37600, costPartsCents: 12500 },
  { sku: "100069", goldUsdPerOzMin: 3950, goldUsdPerOzMax: 3999, pricePartsCents: 38100, costPartsCents: 12700 },
  { sku: "100070", goldUsdPerOzMin: 4000, goldUsdPerOzMax: 4049, pricePartsCents: 38600, costPartsCents: 12900 },
];
