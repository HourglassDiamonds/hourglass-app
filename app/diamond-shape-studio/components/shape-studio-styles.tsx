export function ShapeStudioStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      /* Phase 1: suite chrome uses shared Header / SuiteShell geometry (no compact).
         Phase 1b: Scaled Preview joins shared suite-nav grid (256px) from
         DiamondStudioSuiteNavStyles — no .dts-topbar column overrides.
         .dss-main keeps its own instrument rail widths (248/216) separately. */
      @media (min-width: 961px) {
        /* Post-photo only: lock instrument height. Entry uses content height.
           Must override DiamondStudioSuiteShell's .dss-app workspace lock. */
        .diamond-studio-suite-route:has([data-shape-studio-instrument][data-entry-state="photo"])[data-suite-instrument] .dss-app {
          height: var(--dts-workspace-h);
          max-height: var(--dts-workspace-h);
          min-height: 0;
          overflow: hidden;
        }
        .diamond-studio-suite-route:has([data-shape-studio-instrument][data-entry-state="capture"])[data-suite-instrument] .dss-app {
          height: auto !important;
          max-height: none !important;
          min-height: 0;
          overflow: visible;
        }
      }

      .dss-shell{
        --gold: var(--hg-gold, oklch(0.74 0.090 70));
        --gold-soft: color-mix(in srgb, var(--hg-gold, #c4a574) 42%, #fff);
        --gold-warm: var(--hg-gold-deep, oklch(0.68 0.110 65));
        --topnav-active: var(--hg-ink, #1c1b1a);
        --topnav-idle: var(--hg-muted, #756b61);
        --bg: var(--hg-ivory, #efe8de);
        --bg-deep: color-mix(in srgb, var(--hg-ivory, #efe8de) 88%, var(--hg-line, #e4dbcf));
        --card: var(--hg-surface, #f7f2ea);
        --card-edge: var(--hg-line, #e4dbcf);
        --ink: var(--hg-ink, #1c1b1a);
        --ink-soft: var(--hg-muted, #756b61);
        --ink-mute: var(--hg-eyebrow, #8a8177);
        --hairline: var(--hg-line, #e4dbcf);
        --hairline-soft: color-mix(in srgb, var(--hg-line, #e4dbcf) 55%, #fff);
        --pill-active: color-mix(in srgb, var(--hg-surface, #f7f2ea) 70%, #fff);
        --pill-edge: var(--hg-line-strong, #d9cfc2);
        --shadow-1: 0 1px 2px color-mix(in srgb, var(--hg-muted, #756b61) 8%, transparent),
          0 8px 24px color-mix(in srgb, var(--hg-ink, #1c1b1a) 5%, transparent);
        --dt-ease: cubic-bezier(0.28, 0.11, 0.22, 1);
        --grot: var(--font-geist-sans), system-ui, sans-serif;
        --serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
        background: var(--bg);
        color: var(--ink);
        font-family: var(--grot);
        -webkit-font-smoothing: antialiased;
        height:100%;
        min-height:100%;
      }
      .dss-app{
        position:relative; z-index:1;
        isolation:isolate;
        width:100%;
        height:auto;
        display:flex;
        flex-direction:column;
        min-height:0;
      }
      .dss-app::before{
        content:"";
        position:absolute;
        inset:0;
        pointer-events:none;
        background: radial-gradient(ellipse 58% 48% at 50% 32%,
          oklch(from var(--bg) calc(l + 0.02) c h) 0%,
          var(--bg) 58%,
          var(--bg-deep) 100%);
        z-index:-1;
      }
      .dss-main{
        position:relative;
        z-index:1;
        display:grid;
        grid-template-columns:248px minmax(0, 1fr);
        grid-template-rows:minmax(0, 1fr);
        min-height:0;
        overflow:hidden;
        flex:1 1 auto;
      }
      .dss-main--entry{
        grid-template-columns:minmax(0, 1fr);
        flex:0 0 auto;
        overflow:visible;
        min-height:0;
        grid-template-rows:auto;
      }
      .dss-main--entry .dss-stage-stack{
        grid-column:1;
        overflow:visible;
        min-height:0;
      }
      .dss-main--entry .dss-tool-header{
        width:100%;
        max-width:520px;
        margin:0 auto 10px;
        text-align:center;
      }
      .dss-main--entry .dss-tool-header h1{
        font-size:clamp(1.15rem, 2.4vw, 1.4rem) !important;
      }
      .dss-main--entry .dss-stage-preview{
        flex:0 0 auto;
        min-height:0;
        overflow:visible;
        justify-content:flex-start;
        padding:clamp(18px, 3.2vh, 36px) 16px clamp(20px, 3.5vh, 40px);
      }
      .dss-control-rail{
        grid-column:1; grid-row:1;
        padding:12px 14px 14px 18px;
        overflow-y:auto;
        overflow-x:hidden;
        display:flex; flex-direction:column; gap:12px;
        scrollbar-width:thin;
        min-height:0;
        align-self:stretch;
        background:color-mix(in srgb, var(--card) 55%, transparent);
        border-right:1px solid color-mix(in srgb, var(--hairline) 80%, transparent);
      }
      .dss-stage-stack{
        grid-column:2; grid-row:1;
        display:flex; flex-direction:column;
        min-width:0; min-height:0; overflow:hidden;
      }
      .dss-stage-preview{
        flex:1 1 auto; min-height:0;
        display:flex; flex-direction:column; align-items:center;
        justify-content:flex-start;
        padding:clamp(6px, 1.1vh, 12px) 12px 2px;
        overflow:hidden;
      }
      .dss-tool-header{
        margin:0 12px 4px;
        flex:0 0 auto;
      }
      .dss-tool-header h1{
        font-size:clamp(1rem, 2.1vw, 1.18rem) !important;
      }
      .dss-tool-header p{
        margin-top:0.2rem !important;
        max-width:28rem !important;
      }
      .dss-sentence{
        margin:0 12px 4px; text-align:center;
        font-family:var(--serif); font-weight:300;
        font-size:clamp(15px, 1.8vh, 17px); line-height:1.35;
        color:var(--ink); max-width:min(42rem, 92vw);
      }
      .dss-trust-note{
        margin:0 16px 8px; text-align:center;
        font-size:11px; line-height:1.45;
        color:var(--ink-mute); max-width:min(36rem, 90vw);
      }
      .dss-ring-pending-val{
        margin:4px 0 8px;
        font-family:var(--serif);
        font-size:clamp(1.05rem, 2vh, 1.25rem);
        font-weight:400;
        color:var(--ink-soft);
        text-align:center;
      }
      .dss-stage-canvas{
        display:flex; justify-content:center; align-items:center; width:100%;
        min-width:0; flex:1 1 auto; min-height:0;
      }
      .dss-stage-canvas:has(.dss-viewer.is-empty){
        align-items:flex-start;
        padding-top:clamp(4px, 0.8vh, 10px);
      }
      .dss-viewer{
        position:relative;
        width:min(520px, 90%);
        aspect-ratio:7/9;
        max-height:min(62vh, 100%);
        background:color-mix(in srgb, var(--card) 88%, #fff);
        border:1px solid color-mix(in srgb, var(--card-edge) 85%, var(--hairline));
        border-radius:16px;
        overflow:hidden;
        box-shadow:var(--shadow-1);
      }
      .dss-viewer.is-empty{
        /* Legacy empty-viewer chrome — entry no longer uses .dss-viewer. */
        display:none;
      }
      .dss-entry-surface{
        width:100%;
        display:flex;
        justify-content:center;
        align-items:flex-start;
        padding:0 16px;
        box-sizing:border-box;
      }
      .dss-entry-card{
        width:100%;
        max-width:520px;
        margin:0 auto;
        padding:28px 32px 30px;
        text-align:center;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:10px;
        background:color-mix(in srgb, var(--card) 96%, #fff);
        border:1px solid color-mix(in srgb, var(--card-edge) 92%, var(--hairline));
        border-radius:16px;
        box-shadow:var(--shadow-1);
        box-sizing:border-box;
      }
      .dss-entry-card--qr{
        max-width:480px;
        padding:26px 28px 28px;
        gap:12px;
      }
      .dss-entry-card .dss-stage-empty-kicker{
        margin:0;
        font-size:9.5px;
        letter-spacing:0.2em;
        text-transform:uppercase;
        color:var(--ink-mute);
      }
      .dss-entry-card .dss-stage-empty-title{
        margin:0;
        font-family:var(--serif);
        font-size:clamp(1.2rem, 2.4vh, 1.45rem);
        font-weight:400;
        line-height:1.28;
        color:var(--ink);
        max-width:22ch;
      }
      .dss-entry-card .dss-stage-empty-copy{
        margin:2px 0 0;
        font-size:13.5px;
        line-height:1.55;
        color:var(--ink-soft);
        max-width:38ch;
      }
      .dss-entry-card .dss-stage-empty-privacy{
        margin:4px 0 0;
        font-size:11.5px;
        line-height:1.5;
        color:var(--ink-mute);
        max-width:40ch;
      }
      .dss-entry-card .dss-stage-empty-actions{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:8px;
        margin-top:6px;
        width:100%;
      }
      .dss-entry-card .dss-stage-empty-btn{
        padding:11px 18px;
        border-radius:9px;
        border:1px solid var(--pill-edge);
        background:var(--pill-active);
        font-size:10px;
        letter-spacing:0.12em;
        text-transform:uppercase;
        color:var(--ink);
        cursor:pointer;
        min-width:min(100%, 220px);
      }
      .dss-entry-card .dss-stage-empty-btn:focus-visible{
        outline:2px solid color-mix(in srgb, var(--gold-warm) 55%, transparent);
        outline-offset:2px;
      }
      /* Wide layout: QR relay entry. Narrow: same-device local entry. */
      .dss-entry-desktop{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:10px;
        width:100%;
      }
      .dss-entry-mobile{
        display:none;
        flex-direction:column;
        align-items:center;
        gap:10px;
        width:100%;
      }
      .dss-entry-card--review{
        max-width:520px;
        padding:22px 20px 24px;
      }
      .dss-entry-review{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:12px;
        width:100%;
      }
      .dss-entry-review-img{
        display:block;
        width:100%;
        max-width:100%;
        max-height:min(52vh, 420px);
        object-fit:contain;
        border-radius:10px;
        background:color-mix(in srgb, var(--hairline-soft) 55%, #fff);
      }
      .dss-entry-review-actions,
      .dss-entry-mobile-actions{
        flex-direction:column;
        align-items:stretch;
      }
      .dss-entry-review-actions .dss-stage-empty-btn,
      .dss-entry-mobile-actions .dss-stage-empty-btn{
        min-width:0;
        width:100%;
        min-height:44px;
        padding:12px 18px;
        font-size:11px;
        letter-spacing:0.14em;
      }
      .dss-entry-local-error{
        margin:0;
        font-size:12.5px;
        line-height:1.45;
        color:color-mix(in srgb, #8a3a2a 88%, var(--ink));
        max-width:36ch;
      }
      .dss-entry-secondary-link{
        margin:2px 0 0;
        padding:8px 4px;
        border:0;
        background:transparent;
        font-size:12px;
        line-height:1.4;
        color:var(--ink-mute);
        text-decoration:underline;
        text-underline-offset:3px;
        cursor:pointer;
        min-height:44px;
      }
      .dss-entry-secondary-link:focus-visible{
        outline:2px solid color-mix(in srgb, var(--gold-warm) 55%, transparent);
        outline-offset:2px;
        border-radius:4px;
      }
      .dss-stage-empty{
        position:relative;
        z-index:1;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:6px;
        text-align:center;
        max-width:280px;
      }
      .dss-stage-empty-kicker{
        margin:0;
        font-size:9px;
        letter-spacing:0.2em;
        text-transform:uppercase;
        color:var(--ink-mute);
      }
      .dss-stage-empty-title{
        margin:0;
        font-family:var(--serif);
        font-size:clamp(1.05rem, 2.1vh, 1.22rem);
        font-weight:400;
        line-height:1.25;
        color:var(--ink);
      }
      .dss-stage-empty-copy{
        margin:0;
        font-size:12px;
        line-height:1.5;
        color:var(--ink-soft);
      }
      .dss-stage-empty-privacy{
        margin:8px 0 0;
        font-size:11px;
        line-height:1.45;
        color:var(--ink-mute);
        max-width:32ch;
      }
      .dss-stage-empty-actions{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:8px;
        margin-top:10px;
        width:100%;
      }
      .dss-stage-empty-btn{
        padding:8px 12px;
        border-radius:8px;
        border:1px solid var(--pill-edge);
        background:var(--pill-active);
        font-size:9px;
        letter-spacing:0.11em;
        text-transform:uppercase;
        color:var(--ink);
        cursor:pointer;
      }
      .dss-stage-empty-btn--quiet{
        background:color-mix(in srgb, var(--hairline-soft) 70%, #fff);
        border-color:var(--hairline);
        color:var(--ink-soft);
      }
      .dss-stage-empty-steps{
        margin:4px 0 0;
        padding:0;
        list-style:none;
        display:flex;
        flex-direction:column;
        gap:3px;
        font-size:9.5px;
        letter-spacing:0.06em;
        text-transform:uppercase;
        color:var(--ink-mute);
      }
      .dss-stage-empty-steps li::before{
        content:"";
        display:inline-block;
        width:4px;
        height:4px;
        margin-right:8px;
        border-radius:50%;
        background:color-mix(in srgb, var(--gold-warm) 70%, var(--hairline));
        vertical-align:middle;
      }
      .dss-hand-img{
        position:absolute; inset:0;
        width:100%; height:100%; object-fit:contain;
        pointer-events:none; user-select:none;
      }
      .dss-hand-img--framed{
        inset:auto;
        max-width:none;
        object-fit:fill;
      }
      .dss-viewer.is-framed-crop,
      .dss-viewer.is-framing{
        overflow:hidden;
      }
      .dss-viewer.is-framing{
        cursor:grab;
        touch-action:none;
      }
      .dss-viewer.is-framing.is-panning{
        cursor:grabbing;
      }
      .dss-viewer.is-framing .dss-cal-handle{
        pointer-events:none;
        opacity:0.4;
      }
      .dss-viewer.is-framing .dss-cal-jaw,
      .dss-viewer.is-framing .dss-cal-stem,
      .dss-viewer.is-framing .dss-cal-segment{
        opacity:0.35;
      }
      .dss-frame-copy{
        margin:8px 12px 0;
        max-width:440px;
        text-align:center;
      }
      .dss-frame-heading{
        margin:0;
        font-size:13px;
        letter-spacing:0.08em;
        text-transform:uppercase;
        color:var(--ink);
      }
      .dss-frame-support{
        margin:6px 0 0;
        font-size:12px;
        line-height:1.45;
        color:var(--ink-soft);
      }
      .dss-frame-zoom{
        display:inline-flex;
        gap:6px;
      }
      .dss-viewer.is-placeable{ cursor:crosshair; }
      .dss-viewer.is-placeable .dss-overlay{ cursor:grab; }
      .dss-overlay{
        position:absolute; z-index:2; cursor:grab; touch-action:none;
        transform:translate(-50%, -50%);
        overflow:hidden;
      }
      .dss-overlay.is-dragging{ cursor:grabbing; }
      .dss-overlay-face{
        position:absolute; inset:0;
      }
      .dss-overlay-face.dss-overlay-face--ew{
        inset:auto;
        left:50%; top:50%;
        transform:translate(-50%, -50%) rotate(90deg);
        transform-origin:center center;
      }
      .dss-overlay img{
        pointer-events:none; display:block;
      }
      .dss-overlay-label{
        position:absolute; top:-18px; left:50%; transform:translateX(-50%);
        font-size:8px; letter-spacing:0.12em; text-transform:uppercase;
        color:var(--ink-soft); white-space:nowrap; pointer-events:none;
      }
      .dss-cal-layer{
        position:absolute; inset:0; z-index:3; pointer-events:none;
      }
      .dss-cal-segment{
        position:absolute;
        height:1.5px;
        background:color-mix(in srgb, var(--ink-soft) 55%, var(--gold-warm));
        transform-origin:0 50%;
        opacity:0.7;
        pointer-events:none;
      }
      .dss-cal-endpoint{ pointer-events:none; }
      .dss-cal-jaw-anchor{
        position:absolute;
        z-index:6;
        width:0; height:0;
        transform:translate(-50%, -50%);
        pointer-events:none;
      }
      .dss-cal-stem{
        position:absolute;
        z-index:3;
        height:1.5px;
        background:color-mix(in srgb, var(--ink-soft) 42%, var(--gold-warm));
        transform-origin:0 50%;
        opacity:0.55;
        pointer-events:none;
      }
      .dss-cal-handle{
        position:absolute;
        z-index:5;
        width:38px; height:38px;
        margin:0; padding:0;
        border:none; background:transparent;
        transform:translate(-50%, -50%);
        cursor:grab; touch-action:none;
        pointer-events:auto;
      }
      .dss-cal-handle:active,
      .dss-cal-handle.is-dragging{ cursor:grabbing; }
      /* Natively vertical precision mark; rotated by segment angle only. */
      .dss-cal-jaw{
        position:absolute;
        left:50%; top:50%;
        z-index:3;
        width:1.75px;
        height:28px;
        margin:0;
        background:color-mix(in srgb, var(--ink) 88%, var(--gold-warm));
        opacity:0.96;
        transform:translate(-50%, -50%) rotate(var(--dss-cal-jaw-angle, 0deg));
        transform-origin:center center;
        pointer-events:none;
        border-radius:1px;
      }
      .dss-cal-handle-ring{
        position:absolute;
        left:50%; top:50%;
        z-index:1;
        width:21px; height:21px;
        border-radius:50%;
        background:color-mix(in srgb, var(--card) 42%, transparent);
        border:1.5px solid color-mix(in srgb, var(--ink-soft) 55%, var(--gold-warm));
        box-shadow:0 1px 3px oklch(from var(--hairline) l c h / 0.18);
        transform:translate(-50%, -50%);
        pointer-events:none;
      }
      .dss-cal-endpoint:has(.dss-cal-handle.is-dragging) .dss-cal-handle-ring{
        border-color:color-mix(in srgb, var(--ink) 45%, var(--gold-warm));
        box-shadow:0 1px 5px oklch(from var(--hairline) l c h / 0.28);
      }
      .dss-cal-handle-center{
        position:absolute;
        z-index:2;
        left:50%; top:50%;
        width:3px; height:3px;
        border-radius:50%;
        background:color-mix(in srgb, var(--ink) 82%, var(--gold-warm));
        transform:translate(-50%, -50%);
        pointer-events:none;
      }
      .dss-guide-actions{
        display:flex; flex-wrap:wrap; justify-content:center; align-items:center;
        gap:8px; margin:6px 12px 0; max-width:440px;
      }
      .dss-guide-btn{
        padding:8px 14px;
        border-radius:8px;
        border:1px solid var(--pill-edge);
        background:var(--pill-active);
        font-size:9px;
        letter-spacing:0.11em;
        text-transform:uppercase;
        color:var(--ink);
        cursor:pointer;
      }
      .dss-guide-btn:disabled{
        opacity:0.45; cursor:not-allowed;
      }
      .dss-guide-btn--quiet{
        background:color-mix(in srgb, var(--hairline-soft) 70%, #fff);
        border-color:var(--hairline);
        color:var(--ink-soft);
      }
      .dss-guide-warn{
        flex:1 0 100%;
        margin:0;
        text-align:center;
        font-size:11px;
        line-height:1.4;
        color:var(--ink-mute);
      }
      .dss-guide-support{
        flex:1 0 100%;
        margin:0 0 2px;
        text-align:center;
        font-size:11px;
        line-height:1.4;
        color:var(--ink-soft);
      }
      .dss-scaled-lead{
        margin:0 0 8px;
        font-size:12px;
        line-height:1.45;
        color:var(--ink-soft);
      }
      .dss-scaled-privacy{
        margin:0 0 12px;
        font-size:11px;
        line-height:1.4;
        color:var(--ink-mute);
      }
      .dss-scaled-phone-cta{
        width:100%;
        margin-top:10px;
      }
      .dss-scaled-photo-status{
        margin:0 0 10px;
        font-size:12px;
        color:var(--ink-soft);
      }
      .dss-viewer.is-awaiting-calibration{
        box-shadow:
          var(--shadow-1),
          inset 0 0 0 1px color-mix(in srgb, var(--gold-warm) 28%, transparent);
      }
      .dss-stage-hint{
        margin:6px 12px 0; font-size:10.5px; color:var(--ink-mute);
        text-align:center; max-width:440px; line-height:1.45;
        flex:0 0 auto;
      }
      .dss-shape-strip-wrap{
        flex:0 0 auto;
        width:100%;
        display:flex; justify-content:center;
        margin:clamp(4px, 0.9vh, 10px) 0 clamp(4px, 1vh, 10px);
      }
      .dss-shape-strip{
        display:flex; align-items:stretch; gap:7px; padding:7px 11px;
        background:oklch(from var(--card) l c h / 0.74);
        border:1px solid oklch(from var(--card-edge) l c h / 0.42);
        border-radius:16px;
        backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
        box-shadow:0 4px 16px oklch(from var(--hairline) l c h / 0.06);
        white-space:nowrap;
      }
      .dss-shape-chip{
        display:flex; flex-direction:column; align-items:center;
        justify-content:center; gap:3px;
        padding:7px 6px 6px; border-radius:11px;
        border:1px solid transparent; cursor:pointer;
        background:oklch(from var(--hairline-soft) l c h / 0.72);
        min-width:49px; flex:0 0 auto;
        transition:background 160ms ease, border-color 160ms ease, color 160ms ease;
      }
      .dss-shape-chip:hover{
        background:oklch(from var(--hairline-soft) l c h / 0.92);
      }
      .dss-shape-chip:focus-visible{
        outline:2px solid color-mix(in srgb, var(--gold-warm) 55%, transparent);
        outline-offset:2px;
      }
      .dss-shape-chip.is-selected{
        background:color-mix(in srgb, #f3eee4 78%, var(--card));
        border-color:color-mix(in srgb, var(--ink) 18%, var(--card-edge));
        box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--ink) 6%, transparent);
      }
      .dss-shape-chip .dss-thumb{
        height:24.5px; width:26.5px;
        display:flex; align-items:center; justify-content:center;
      }
      .dss-shape-thumb-img{
        max-height:24.5px; max-width:26.5px;
        object-fit:contain; display:block;
      }
      .dss-shape-chip .dss-name{
        font-size:7px; font-weight:500; letter-spacing:0.11em;
        text-transform:uppercase; color:var(--ink-soft);
      }
      .dss-shape-chip.is-selected .dss-name{
        color:var(--ink);
        font-weight:600;
      }
      .dss-card{
        background:color-mix(in srgb, var(--card) 96%, #fff);
        border:1px solid color-mix(in srgb, var(--card-edge) 92%, var(--ink-mute));
        border-radius:14px;
        padding:11px 12px 12px;
        box-shadow:var(--shadow-1);
        flex-shrink:0;
      }
      .dss-card-head{
        font-size:9.35px; font-weight:500; letter-spacing:0.168em;
        text-transform:uppercase; color:var(--ink-soft); margin:0 0 8px;
        font-family:var(--serif);
        font-style:italic;
      }
      .dss-card.is-start-focus{
        outline:1px solid color-mix(in srgb, var(--gold-warm) 55%, var(--hairline));
        box-shadow:0 0 0 3px color-mix(in srgb, var(--gold-soft) 35%, transparent), var(--shadow-1);
      }
      .dss-stepper{
        display:flex; align-items:center; justify-content:center;
        gap:14px; margin:2px 0 6px;
      }
      .dss-stepper button{
        width:24px; height:24px; border-radius:50%;
        border:1px solid var(--hairline); background:var(--card);
        color:var(--ink-soft); cursor:pointer; font-size:13px;
      }
      .dss-stepper button:disabled{ opacity:0.35; cursor:default; }
      .dss-step-val{
        font-family:var(--serif); font-size:24px; min-width:52px;
        text-align:center; font-variant-numeric:tabular-nums;
      }
      .dss-slider{ position:relative; margin:4px 4px 2px; padding:0 8px; }
      .dss-track{
        position:relative; height:36px; margin:0;
        background-image:linear-gradient(var(--hairline),var(--hairline));
        background-size:100% 1px; background-position:center;
        background-repeat:no-repeat; touch-action:none;
        outline:none;
      }
      .dss-track:focus-visible{
        box-shadow:0 0 0 2px color-mix(in srgb, var(--gold-warm) 55%, transparent);
        border-radius:8px;
      }
      .dss-track::before{
        content:""; position:absolute; left:0; top:50%; height:1px;
        transform:translateY(-50%);
        background:linear-gradient(90deg, var(--gold-soft), var(--gold-warm));
        opacity:0.55; width:var(--dss-fill, 0%); pointer-events:none;
      }
      .dss-handle{
        position:absolute; top:50%; width:10px; height:10px;
        border-radius:50%; background:var(--card);
        border:1px solid oklch(from var(--ink-soft) l c h / 0.72);
        transform:translate(-50%,-50%); cursor:grab; touch-action:none;
        pointer-events:none;
      }
      .dss-track.is-dragging .dss-handle,
      .dss-track:active .dss-handle{
        cursor:grabbing;
        border-color:color-mix(in srgb, var(--ink) 40%, var(--gold-warm));
      }
      .dss-endpoints{
        display:flex; justify-content:space-between;
        font-size:8.5px; color:var(--ink-mute); margin-top:4px;
      }
      .dss-dim-note{
        margin-top:6px; font-size:11px; color:var(--ink-soft); text-align:center;
        line-height:1.4;
      }
      .dss-dim-note strong{
        font-family:var(--serif); font-size:13px; color:var(--ink); font-weight:400;
      }
      .dss-orientation{
        margin-top:10px;
        padding-top:9px;
        border-top:1px solid color-mix(in srgb, var(--hairline) 70%, transparent);
      }
      .dss-orientation-label{
        font-size:9px; font-weight:500; letter-spacing:0.14em;
        text-transform:uppercase; color:var(--ink-mute);
        text-align:center; margin:0 0 7px;
      }
      .dss-orientation-row{
        display:flex; gap:6px;
      }
      .dss-orientation-pill{
        flex:1; padding:7px 6px; border-radius:8px;
        border:1px solid var(--hairline); background:var(--hairline-soft);
        font-size:10px; letter-spacing:0.08em; text-transform:uppercase;
        color:var(--ink-soft); cursor:pointer;
      }
      .dss-orientation-pill.is-selected{
        background:color-mix(in srgb, #f3eee4 70%, var(--pill-active));
        border-color:color-mix(in srgb, var(--ink) 16%, var(--pill-edge));
        color:var(--ink);
        font-weight:600;
      }
      .dss-orientation-pill:focus-visible{
        outline:2px solid color-mix(in srgb, var(--gold-warm) 55%, transparent);
        outline-offset:2px;
      }
      .dss-mode-row{ display:flex; gap:6px; }
      .dss-mode-btn, .dss-slot-btn{
        flex:1; padding:7px 6px; border-radius:8px;
        border:1px solid var(--hairline); background:var(--hairline-soft);
        font-size:9px; letter-spacing:0.11em; text-transform:uppercase;
        color:var(--ink-soft); cursor:pointer;
      }
      .dss-mode-btn.is-active, .dss-slot-btn.is-active{
        background:var(--pill-active); border-color:var(--pill-edge); color:var(--ink);
      }
      .dss-slot-row{ display:flex; gap:6px; margin-top:8px; }
      .dss-upload-mode-row{ display:flex; gap:6px; margin-bottom:10px; }
      .dss-upload-mode-btn{
        flex:1; padding:7px 6px; border-radius:8px;
        border:1px solid var(--hairline); background:var(--hairline-soft);
        font-size:9px; letter-spacing:0.11em; text-transform:uppercase;
        color:var(--ink-soft); cursor:pointer;
      }
      .dss-upload-mode-btn.is-active{
        background:var(--pill-active); border-color:var(--pill-edge); color:var(--ink);
      }
      .dss-upload-mode-btn:disabled{ opacity:0.55; cursor:default; }
      .dss-capture-path-label{
        margin:12px 0 6px;
        font-size:9px;
        letter-spacing:0.14em;
        text-transform:uppercase;
        color:var(--ink-mute);
        text-align:center;
      }
      .dss-capture-path-list{
        display:flex;
        flex-direction:column;
        gap:7px;
      }
      .dss-capture-path{
        display:flex;
        flex-direction:column;
        gap:8px;
        padding:10px 11px 11px;
        border-radius:12px;
        border:1px solid color-mix(in srgb, var(--card-edge) 88%, var(--hairline));
        background:color-mix(in srgb, var(--hairline-soft) 55%, #fff);
      }
      .dss-capture-path-title{
        margin:0 0 3px;
        font-family:var(--serif);
        font-size:13px;
        font-weight:400;
        line-height:1.25;
        color:var(--ink);
      }
      .dss-capture-path-body{
        margin:0;
        font-size:10.5px;
        line-height:1.4;
        color:var(--ink-soft);
      }
      .dss-capture-path-cta{
        align-self:flex-start;
        padding:7px 11px;
        border-radius:8px;
        border:1px solid var(--pill-edge);
        background:var(--pill-active);
        font-size:9px;
        letter-spacing:0.12em;
        text-transform:uppercase;
        color:var(--ink);
        cursor:pointer;
      }
      .dss-capture-path-cta:disabled{ opacity:0.55; cursor:default; }
      .dss-upload-zone{
        border:1px dashed var(--hairline); border-radius:12px;
        padding:12px 11px; text-align:center; cursor:pointer;
        background:color-mix(in srgb, var(--hairline-soft) 60%, #fff);
      }
      .dss-upload-zone.is-dragover{ border-color:var(--gold-warm); }
      .dss-upload-zone p{
        margin:0; font-size:12px; color:var(--ink-soft); line-height:1.45;
      }
      .dss-upload-zone .dss-upload-cta{
        display:inline-block; margin-top:6px; font-size:10px;
        letter-spacing:0.14em; text-transform:uppercase; color:var(--ink);
      }
      .dss-qr-panel{
        display:flex; flex-direction:column; align-items:center; gap:10px;
        padding:8px 4px 4px; text-align:center;
      }
      .dss-qr-panel--stage{
        gap:12px;
        padding:0;
        width:100%;
        max-width:none;
      }
      .dss-qr-panel--stage .dss-qr-lead{
        font-size:13.5px;
        line-height:1.55;
        max-width:38ch;
        color:var(--ink-soft);
      }
      .dss-qr-panel--stage .dss-qr-frame{
        padding:16px;
      }
      .dss-qr-panel--stage .dss-stage-empty-title{
        max-width:18ch;
      }
      .dss-entry-card--qr .dss-qr-cancel{
        margin-top:2px;
        font-size:10px;
      }
      .dss-qr-lead{
        margin:0; font-size:11px; line-height:1.5; color:var(--ink-soft);
      }
      .dss-qr-frame{
        padding:12px; border-radius:12px; background:var(--card);
        border:1px solid var(--hairline-soft);
      }
      .dss-qr-status{
        margin:0; font-size:10px; letter-spacing:0.1em;
        text-transform:uppercase; color:var(--ink);
      }
      .dss-qr-meta{
        margin:0; font-size:9px; color:var(--ink-mute);
      }
      .dss-qr-message{ margin:0; font-size:11px; line-height:1.45; color:var(--ink-soft); }
      .dss-qr-message--warn{ color:oklch(0.48 0.08 35); }
      .dss-qr-cancel{
        margin-top:4px; padding:0; border:none; background:none;
        cursor:pointer; font-size:9px; letter-spacing:0.12em;
        text-transform:uppercase; color:var(--ink-soft); text-decoration:underline;
      }
      .dss-qr-loading{
        margin:12px 0; font-size:12px; color:var(--ink-soft); text-align:center;
      }
      .dss-editorial{
        position:relative;
        z-index:1;
        flex-shrink:0;
        /* Tighten the handoff from the shape strip into the explainer. */
        margin-top:0;
      }

      /* Split / mid desktop: denser rail, smaller empty stage */
      @media (min-width: 961px) and (max-width: 1200px) {
        .dss-main{ grid-template-columns:216px minmax(0, 1fr); }
        .dss-main--entry{ grid-template-columns:minmax(0, 1fr); }
        .dss-control-rail{ padding:10px 10px 12px 12px; gap:10px; }
        .dss-viewer{ width:min(460px, 92%); max-height:min(58vh, 100%); }
        .dss-entry-card{ max-width:480px; padding:24px 26px 26px; }
        .dss-entry-card--qr{ max-width:440px; }
        .dss-step-val{ font-size:22px; min-width:48px; }
        .dss-card{ padding:10px 11px 11px; }
      }

      @media (min-width: 961px) {
        .dss-main{
          flex:1 1 auto;
          min-height:0;
          overflow:hidden;
        }
      }

      /* Stack earlier for split-screen / tablet so the instrument stays readable */
      @media (max-width: 960px) {
        .dss-shell{
          overflow-x:hidden;
          overflow-y:auto;
          scroll-padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 96px);
        }
        .dss-app{
          height:auto !important;
          max-height:none !important;
          min-height:0;
          overflow:visible;
          box-sizing:border-box;
          padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 96px);
        }
        .dss-main{
          display:flex !important; flex-direction:column;
          overflow:visible; gap:11px;
        }
        .dss-main--entry{ gap:0; overflow:visible; }
        .dss-main--entry .dss-stage-preview{
          display:flex;
          flex-direction:column;
          align-items:center;
          padding:16px 0 24px;
        }
        .dss-entry-surface{
          order:3;
          width:100%;
          padding:0 20px;
        }
        .dss-entry-card{
          max-width:min(520px, 100%);
          width:100%;
          padding:22px 20px 24px;
        }
        .dss-entry-card--qr{
          max-width:min(480px, 100%);
        }
        .dss-entry-card .dss-stage-empty-title{
          max-width:none;
          font-size:clamp(1.15rem, 5vw, 1.35rem);
        }
        .dss-entry-card .dss-stage-empty-copy,
        .dss-entry-card .dss-stage-empty-privacy,
        .dss-qr-panel--stage .dss-qr-lead{
          max-width:none;
        }
        .dss-entry-desktop{ display:none; }
        .dss-entry-mobile{ display:flex; }
        .dss-control-rail{ display:contents; }
        .dss-control-rail > .dss-card{
          width:calc(100% - 40px); margin-left:20px; margin-right:20px;
        }
        .dss-control-rail > .dss-card:nth-child(1){ order:5; }
        .dss-control-rail > .dss-card:nth-child(2){ order:6; }
        .dss-control-rail > .dss-card:nth-child(3){ order:7; }
        .dss-control-rail > .dss-card:nth-child(4){ order:8; }
        .dss-stage-stack{ display:contents; }
        .dss-stage-preview{ display:contents; }
        .dss-tool-header{
          order:1;
          width:calc(100% - 40px);
          margin:8px 20px 0;
        }
        .dss-sentence{
          order:2; width:calc(100% - 40px); margin:2px 20px 4px;
          font-size:clamp(16.5px, 4.4vw, 18.5px); max-width:none;
        }
        .dss-trust-note{
          order:2; width:calc(100% - 40px); margin:0 20px 8px;
          max-width:none;
        }
        .dss-stage-canvas{ order:3; width:100%; padding:0 20px; box-sizing:border-box; }
        .dss-stage-hint{ order:4; width:calc(100% - 40px); margin:8px 20px 0; }
        .dss-viewer{
          width:100%;
          max-width:280px;
          max-height:min(46vh, 340px);
          aspect-ratio:7/9.15;
        }
        .dss-shape-strip-wrap{
          order:9; width:calc(100% - 40px); margin:4px 20px 12px;
          -webkit-mask-image:linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
          mask-image:linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
        }
        .dss-shape-strip{
          width:100%; overflow-x:auto; justify-content:flex-start;
          scrollbar-width:none;
        }
        .dss-shape-strip::-webkit-scrollbar{ display:none; }

        /* Mobile affordance: carat slider — ~52px hit, restrained visual thumb */
        .dss-slider{
          margin:8px 2px 4px;
          padding:0 4px;
        }
        .dss-track{
          height:52px;
          min-height:52px;
          background-size:100% 2px;
        }
        .dss-track::before{
          height:2px;
          opacity:0.7;
        }
        /*
          Invisible 52px hit disc around the thumb; visual thumb stays ~20px
          via ::after so acquisition is easy without a bulky control.
        */
        .dss-handle{
          width:52px;
          height:52px;
          background:transparent;
          border:none;
          box-shadow:none;
          pointer-events:auto;
        }
        .dss-handle::after{
          content:"";
          position:absolute;
          left:50%;
          top:50%;
          width:20px;
          height:20px;
          border-radius:50%;
          transform:translate(-50%,-50%);
          background:var(--card);
          border:1.5px solid oklch(from var(--ink-soft) l c h / 0.72);
          box-shadow:
            0 0 0 1px color-mix(in srgb, #fff 55%, transparent),
            0 1px 4px oklch(from var(--hairline) l c h / 0.28);
          pointer-events:none;
        }
        .dss-track.is-dragging{
          background-size:100% 2.5px;
        }
        .dss-track.is-dragging::before{
          height:2.5px;
          opacity:0.9;
        }
        .dss-track.is-dragging .dss-handle::after{
          width:22px;
          height:22px;
          border-color:color-mix(in srgb, var(--ink) 50%, var(--gold-warm));
          box-shadow:
            0 0 0 2px color-mix(in srgb, #fff 70%, transparent),
            0 0 0 3px color-mix(in srgb, var(--ink) 28%, transparent),
            0 2px 6px oklch(from var(--hairline) l c h / 0.32);
        }
        /* While dragging, block page pan so the slider keeps the gesture */
        .dss-shell[data-slider-adjusting]{
          touch-action:none;
          overscroll-behavior:none;
        }
        .dss-stepper button{
          width:44px;
          height:44px;
          font-size:18px;
        }

        /* Mobile affordance: calibration guide lines — quieter at rest, clearer while dragging */
        .dss-cal-segment{
          height:2px;
          opacity:0.88;
          background:color-mix(in srgb, var(--ink) 62%, var(--gold-warm));
          box-shadow:
            0 0 0 1px color-mix(in srgb, #fff 58%, transparent),
            0 1px 2px color-mix(in srgb, #000 28%, transparent);
        }
        .dss-cal-stem{
          height:2px;
          opacity:0.72;
          background:color-mix(in srgb, var(--ink-soft) 48%, var(--gold-warm));
          box-shadow:0 0 0 1px color-mix(in srgb, #fff 45%, transparent);
        }
        .dss-cal-jaw{
          width:2.25px;
          height:32px;
          opacity:1;
          background:color-mix(in srgb, var(--ink) 90%, var(--gold-warm));
          box-shadow:
            0 0 0 1px color-mix(in srgb, #fff 62%, transparent),
            0 0 0 2px color-mix(in srgb, #000 22%, transparent);
        }
        .dss-cal-handle{
          width:48px;
          height:48px;
        }
        .dss-cal-handle-ring{
          width:24px;
          height:24px;
          border-width:2px;
          background:color-mix(in srgb, var(--card) 58%, transparent);
          border-color:color-mix(in srgb, var(--ink) 42%, var(--gold-warm));
          box-shadow:
            0 0 0 1px color-mix(in srgb, #fff 50%, transparent),
            0 1px 4px oklch(from var(--hairline) l c h / 0.28);
        }
        .dss-cal-handle-center{
          width:4px;
          height:4px;
        }
        .dss-cal-layer:has(.dss-cal-handle.is-dragging) .dss-cal-segment{
          height:2.5px;
          opacity:1;
          box-shadow:
            0 0 0 1.5px color-mix(in srgb, #fff 78%, transparent),
            0 0 0 3px color-mix(in srgb, #000 38%, transparent),
            0 0 6px color-mix(in srgb, var(--gold-warm) 35%, transparent);
        }
        .dss-cal-layer:has(.dss-cal-handle.is-dragging) .dss-cal-stem{
          opacity:0.95;
          box-shadow:
            0 0 0 1px color-mix(in srgb, #fff 70%, transparent),
            0 0 0 2px color-mix(in srgb, #000 30%, transparent);
        }
        .dss-cal-layer:has(.dss-cal-handle.is-dragging) .dss-cal-jaw{
          width:2.75px;
          box-shadow:
            0 0 0 1.5px color-mix(in srgb, #fff 80%, transparent),
            0 0 0 3px color-mix(in srgb, #000 36%, transparent);
        }
        .dss-cal-endpoint:has(.dss-cal-handle.is-dragging) .dss-cal-handle-ring{
          width:28px;
          height:28px;
          border-color:color-mix(in srgb, var(--ink) 55%, var(--gold-warm));
          background:color-mix(in srgb, var(--card) 72%, transparent);
          box-shadow:
            0 0 0 2px color-mix(in srgb, #fff 75%, transparent),
            0 0 0 4px color-mix(in srgb, #000 30%, transparent),
            0 0 8px color-mix(in srgb, var(--gold-warm) 30%, transparent);
        }

        /* While carat slider is dragged, emphasize the live overlay silhouette */
        .dss-shell[data-slider-adjusting] .dss-overlay{
          filter:drop-shadow(0 0 0.5px #fff) drop-shadow(0 0 1.5px rgba(0,0,0,0.55));
        }
      }
    `,
      }}
    />
  );
}
