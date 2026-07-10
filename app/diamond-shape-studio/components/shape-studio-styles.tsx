export function ShapeStudioStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      /* Shape Studio–only suite chrome compact (does not affect Size Studio). */
      @media (min-width: 768px) {
        .diamond-studio-suite-route:has([data-shape-studio-instrument]) [data-dts-site-header] header > div {
          padding-top: 0.7rem !important;
          padding-bottom: 0.7rem !important;
          align-items: center !important;
        }
        .diamond-studio-suite-route:has([data-shape-studio-instrument]) [data-dts-site-header] span.relative.block {
          height: 52px !important;
          width: 52px !important;
        }
      }
      @media (min-width: 961px) {
        .diamond-studio-suite-route:has([data-shape-studio-instrument]) {
          --dts-subnav-h: 40px;
        }
        .diamond-studio-suite-route:has([data-shape-studio-instrument]) .dts-topbar {
          min-height: 40px;
          height: var(--dts-subnav-h, 40px);
        }
        .diamond-studio-suite-route:has([data-shape-studio-instrument]) .dts-topnav {
          padding-top: 6px;
        }
        .diamond-studio-suite-route:has([data-shape-studio-instrument]) .dts-topnav-item {
          padding-bottom: 6px;
        }
        /* Match Size Studio instrument height behavior starting at split-friendly width */
        .diamond-studio-suite-route:has([data-shape-studio-instrument])[data-suite-instrument] .dss-app {
          height: var(--dts-workspace-h);
          max-height: var(--dts-workspace-h);
          min-height: 0;
          overflow: hidden;
        }
      }
      @media (min-width: 1024px) {
        .diamond-studio-suite-route:has([data-shape-studio-instrument])[data-suite-instrument] .dts-topbar {
          grid-template-columns: 248px minmax(0, 1fr);
        }
      }
      @media (min-width: 961px) and (max-width: 1200px) {
        .diamond-studio-suite-route:has([data-shape-studio-instrument])[data-suite-instrument] .dts-topbar {
          grid-template-columns: 216px minmax(0, 1fr);
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
        z-index:0;
      }
      .dss-main{
        display:grid;
        grid-template-columns:248px minmax(0, 1fr);
        grid-template-rows:minmax(0, 1fr);
        min-height:0;
        overflow:hidden;
        flex:1 1 auto;
      }
      .dss-control-rail{
        grid-column:1; grid-row:1;
        padding:12px 14px 14px 18px;
        overflow-y:auto;
        overflow-x:hidden;
        display:flex; flex-direction:column; gap:12px;
        scrollbar-width:none;
        min-height:0;
        align-self:stretch;
      }
      .dss-control-rail::-webkit-scrollbar{ display:none; }
      .dss-stage-stack{
        grid-column:2; grid-row:1;
        display:flex; flex-direction:column;
        min-width:0; min-height:0; overflow:hidden;
      }
      .dss-stage-preview{
        flex:1 1 auto; min-height:0;
        display:flex; flex-direction:column; align-items:center;
        justify-content:flex-start;
        padding:clamp(8px, 1.4vh, 16px) 12px 4px;
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
        margin:0 12px 8px; text-align:center;
        font-family:var(--serif); font-weight:300;
        font-size:clamp(15px, 1.8vh, 17px); line-height:1.35;
        color:var(--ink); max-width:480px;
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
        width:min(400px, 72%);
        aspect-ratio:5/6;
        max-height:min(48vh, 440px);
        display:grid;
        place-items:center;
        padding:22px 20px;
        background:
          radial-gradient(ellipse 70% 55% at 50% 38%, color-mix(in srgb, var(--card) 92%, #fff), var(--card)),
          linear-gradient(180deg, color-mix(in srgb, var(--card) 96%, #fff), var(--card));
      }
      .dss-viewer.is-empty::before{
        content:"";
        position:absolute;
        inset:12px;
        border:1px dashed color-mix(in srgb, var(--hairline) 90%, transparent);
        border-radius:12px;
        pointer-events:none;
      }
      .dss-stage-empty{
        position:relative;
        z-index:1;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:6px;
        text-align:center;
        max-width:260px;
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
      .dss-overlay{
        position:absolute; z-index:2; cursor:grab; touch-action:none;
        transform:translate(-50%, -50%);
      }
      .dss-overlay.is-dragging{ cursor:grabbing; }
      .dss-overlay img{
        width:100%; height:100%; object-fit:contain;
        pointer-events:none; display:block;
      }
      .dss-overlay-label{
        position:absolute; top:-18px; left:50%; transform:translateX(-50%);
        font-size:8px; letter-spacing:0.12em; text-transform:uppercase;
        color:var(--ink-soft); white-space:nowrap; pointer-events:none;
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
        margin:clamp(6px, 1.1vh, 12px) 0 clamp(10px, 1.8vh, 18px);
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
      }
      .dss-shape-chip.is-selected{
        background:oklch(from var(--pill-active) l c h / 0.52);
        border-color:oklch(from var(--pill-edge) l c h / 0.16);
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
      .dss-shape-chip.is-selected .dss-name{ color:var(--ink); }
      .dss-card{
        background:color-mix(in srgb, var(--card) 92%, #fff);
        border:1px solid color-mix(in srgb, var(--card-edge) 88%, var(--hairline));
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
        background-repeat:no-repeat; touch-action:pan-x;
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
      }
      .dss-endpoints{
        display:flex; justify-content:space-between;
        font-size:8.5px; color:var(--ink-mute); margin-top:4px;
      }
      .dss-dim-note{
        margin-top:6px; font-size:11px; color:var(--ink-soft); text-align:center;
      }
      .dss-dim-note strong{
        font-family:var(--serif); font-size:13px; color:var(--ink); font-weight:400;
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
      .dss-upload-zone{
        border:1px dashed var(--hairline); border-radius:12px;
        padding:14px 12px; text-align:center; cursor:pointer;
        background:var(--hairline-soft);
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
      }

      /* Split / mid desktop: denser rail, smaller empty stage */
      @media (min-width: 961px) and (max-width: 1200px) {
        .dss-main{ grid-template-columns:216px minmax(0, 1fr); }
        .dss-control-rail{ padding:10px 10px 12px 12px; gap:10px; }
        .dss-viewer{ width:min(460px, 92%); max-height:min(58vh, 100%); }
        .dss-viewer.is-empty{
          width:min(320px, 82%);
          max-height:min(42vh, 360px);
        }
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
          order:2; width:calc(100% - 40px); margin:2px 20px 8px;
          font-size:clamp(16.5px, 4.4vw, 18.5px); max-width:none;
        }
        .dss-stage-canvas{ order:3; width:100%; padding:0 20px; box-sizing:border-box; }
        .dss-stage-hint{ order:4; width:calc(100% - 40px); margin:8px 20px 0; }
        .dss-viewer{
          width:100%;
          max-width:280px;
          max-height:min(46vh, 340px);
          aspect-ratio:7/9.15;
        }
        .dss-viewer.is-empty{
          width:100%;
          max-width:260px;
          max-height:min(42vh, 300px);
          aspect-ratio:5/6;
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
      }
    `,
      }}
    />
  );
}
