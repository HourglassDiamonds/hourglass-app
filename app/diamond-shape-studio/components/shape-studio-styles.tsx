export function ShapeStudioStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
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
        background: radial-gradient(ellipse 60% 55% at 50% 38%,
          oklch(from var(--bg) calc(l + 0.02) c h) 0%,
          var(--bg) 60%,
          var(--bg-deep) 100%);
        z-index:0;
      }
      .dss-main{
        display:grid;
        grid-template-columns:256px minmax(0, 1fr);
        grid-template-rows:minmax(0, 1fr);
        min-height:0;
        overflow:hidden;
      }
      .dss-control-rail{
        grid-column:1; grid-row:1;
        padding:16px 18px 16px 22px;
        overflow-y:auto;
        overflow-x:hidden;
        display:flex; flex-direction:column; gap:18px;
        scrollbar-width:none;
        min-height:0;
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
        padding:clamp(16px, 2.2vh, 28px) 0 8px;
        overflow:hidden;
      }
      .dss-tool-header{
        margin:0 12px 8px;
        flex:0 0 auto;
      }
      .dss-sentence{
        margin:0 12px 12px; text-align:center;
        font-family:var(--serif); font-weight:300;
        font-size:clamp(16px, 2.1vh, 19px); line-height:1.38;
        color:var(--ink); max-width:520px;
      }
      .dss-stage-canvas{
        display:flex; justify-content:center; width:100%;
        min-width:0; flex:1 1 auto; min-height:0;
      }
      .dss-viewer{
        position:relative;
        width:min(578px, 93.5%);
        aspect-ratio:7/9;
        max-height:96%;
        background:color-mix(in srgb, var(--card) 88%, #fff);
        border:1px solid color-mix(in srgb, var(--card-edge) 85%, var(--hairline));
        border-radius:16px;
        overflow:hidden;
        box-shadow:var(--shadow-1);
      }
      .dss-viewer.is-empty{
        display:grid;
        place-items:center;
        padding:28px 24px;
        background:
          radial-gradient(ellipse 70% 55% at 50% 38%, color-mix(in srgb, var(--card) 92%, #fff), var(--card)),
          linear-gradient(180deg, color-mix(in srgb, var(--card) 96%, #fff), var(--card));
      }
      .dss-viewer.is-empty::before{
        content:"";
        position:absolute;
        inset:14px;
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
        gap:8px;
        text-align:center;
        max-width:300px;
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
        font-size:clamp(1.1rem, 2.4vh, 1.35rem);
        font-weight:400;
        line-height:1.25;
        color:var(--ink);
      }
      .dss-stage-empty-copy{
        margin:0;
        font-size:12.5px;
        line-height:1.55;
        color:var(--ink-soft);
      }
      .dss-stage-empty-steps{
        margin:6px 0 0;
        padding:0;
        list-style:none;
        display:flex;
        flex-direction:column;
        gap:4px;
        font-size:10px;
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
        margin:8px 12px 0; font-size:11px; color:var(--ink-mute);
        text-align:center; max-width:480px; line-height:1.5;
        flex:0 0 auto;
      }
      .dss-shape-strip-wrap{
        flex:0 0 auto;
        width:100%;
        display:flex; justify-content:center;
        margin:clamp(10px, 1.6vh, 20px) 0 clamp(14px, 2.4vh, 28px);
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
        padding:13px 14px 14px;
        box-shadow:var(--shadow-1);
        flex-shrink:0;
      }
      .dss-card-head{
        font-size:9.35px; font-weight:500; letter-spacing:0.168em;
        text-transform:uppercase; color:var(--ink-soft); margin:0 0 10px;
        font-family:var(--serif);
        font-style:italic;
      }
      .dss-stepper{
        display:flex; align-items:center; justify-content:center;
        gap:14px; margin:2px 0 8px;
      }
      .dss-stepper button{
        width:24px; height:24px; border-radius:50%;
        border:1px solid var(--hairline); background:var(--card);
        color:var(--ink-soft); cursor:pointer; font-size:13px;
      }
      .dss-stepper button:disabled{ opacity:0.35; cursor:default; }
      .dss-step-val{
        font-family:var(--serif); font-size:28px; min-width:56px;
        text-align:center; font-variant-numeric:tabular-nums;
      }
      .dss-slider{ position:relative; margin:6px 4px 2px; padding:0 8px; }
      .dss-track{
        position:relative; height:40px; margin:0;
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
        font-size:8.5px; color:var(--ink-mute); margin-top:6px;
      }
      .dss-dim-note{
        margin-top:8px; font-size:11px; color:var(--ink-soft); text-align:center;
      }
      .dss-dim-note strong{
        font-family:var(--serif); font-size:13px; color:var(--ink); font-weight:400;
      }
      .dss-mode-row{ display:flex; gap:6px; }
      .dss-mode-btn, .dss-slot-btn{
        flex:1; padding:8px 6px; border-radius:8px;
        border:1px solid var(--hairline); background:var(--hairline-soft);
        font-size:9px; letter-spacing:0.11em; text-transform:uppercase;
        color:var(--ink-soft); cursor:pointer;
      }
      .dss-mode-btn.is-active, .dss-slot-btn.is-active{
        background:var(--pill-active); border-color:var(--pill-edge); color:var(--ink);
      }
      .dss-slot-row{ display:flex; gap:6px; margin-top:10px; }
      .dss-upload-mode-row{ display:flex; gap:6px; margin-bottom:12px; }
      .dss-upload-mode-btn{
        flex:1; padding:8px 6px; border-radius:8px;
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
        padding:20px 14px; text-align:center; cursor:pointer;
        background:var(--hairline-soft);
      }
      .dss-upload-zone.is-dragover{ border-color:var(--gold-warm); }
      .dss-upload-zone p{
        margin:0; font-size:12px; color:var(--ink-soft); line-height:1.5;
      }
      .dss-upload-zone .dss-upload-cta{
        display:inline-block; margin-top:8px; font-size:10px;
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
      @media (min-width: 769px) {
        .dss-main{
          flex:1 1 auto;
          min-height:0;
          overflow:hidden;
        }
      }
      @media (max-width: 768px) {
        .dss-shell{
          overflow-x:hidden;
          overflow-y:auto;
          scroll-padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 96px);
        }
        .dss-app{
          height:auto;
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
        .dss-control-rail > .dss-card:nth-child(1){ order:1; }
        .dss-control-rail > .dss-card:nth-child(2){ order:5; }
        .dss-control-rail > .dss-card:nth-child(3){ order:6; }
        .dss-control-rail > .dss-card:nth-child(4){ order:7; }
        .dss-stage-stack{ display:contents; }
        .dss-stage-preview{ display:contents; }
        .dss-tool-header{
          order:1;
          width:calc(100% - 40px);
          margin:4px 20px 0;
        }
        .dss-sentence{
          order:2; width:calc(100% - 40px); margin:2px 20px 8px;
          font-size:clamp(16.5px, 4.4vw, 18.5px); max-width:none;
        }
        .dss-stage-canvas{ order:3; width:100%; padding:0 20px; box-sizing:border-box; }
        .dss-stage-hint{ order:4; width:calc(100% - 40px); margin:8px 20px 0; }
        .dss-viewer{ width:100%; max-width:260px; max-height:min(48vh, 352px); aspect-ratio:7/9.15; }
        .dss-shape-strip-wrap{
          order:8; width:calc(100% - 40px); margin:4px 20px 12px;
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
