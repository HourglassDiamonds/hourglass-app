export function CapturePageStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      /* Colors bound to the approved --hg-* brand tokens (with literal
         fallbacks). Layout, behavior, and capture lifecycle are unchanged. */
      .dss-capture-shell{
        min-height:100dvh;
        display:grid;
        place-items:center;
        padding:24px 20px;
        background:var(--hg-body, #f7f3ee);
        color:var(--hg-ink, #1c1b1a);
        font-family:var(--font-geist-sans), system-ui, sans-serif;
        pointer-events:auto;
      }
      .dss-capture-card{
        width:min(420px, 100%);
        background:oklch(from var(--hg-surface, #f8f3eb) calc(l + 0.015) c h);
        border:1px solid var(--hg-line, #e4dbcf);
        border-radius:14px;
        padding:28px 24px 24px;
        box-shadow:var(--hg-shadow-soft, 0 6px 18px rgba(48, 36, 28, 0.04));
        text-align:center;
        pointer-events:auto;
        position:relative;
        z-index:1;
      }
      .dss-capture-brand{
        font-size:9px; letter-spacing:0.18em; text-transform:uppercase;
        color:var(--hg-eyebrow, #8a8177);
        margin:0 0 16px;
      }
      .dss-capture-title{
        font-family:ui-serif, Georgia, serif;
        font-size:clamp(22px, 5vw, 26px);
        font-weight:400;
        margin:0 0 10px;
      }
      .dss-capture-body{
        font-size:13px; line-height:1.55; color:var(--hg-muted, #756b61);
        margin:0 0 16px;
      }
      .dss-capture-note{
        font-size:11.5px; line-height:1.5; color:var(--hg-muted, #756b61);
        margin:0 0 18px;
      }
      .dss-capture-guide{
        margin:0 auto 16px;
        width:min(100%, 280px);
        pointer-events:none;
      }
      .dss-capture-guide-frame{
        position:relative;
        width:100%;
        aspect-ratio:4/5;
        border-radius:14px;
        border:1px solid var(--hg-line, #e4dbcf);
        background:
          radial-gradient(ellipse 70% 55% at 50% 42%,
            oklch(from var(--hg-body, #f7f3ee) calc(l + 0.02) c h),
            var(--hg-body, #f7f3ee));
        overflow:hidden;
        pointer-events:none;
      }
      .dss-capture-guide-caption{
        margin:8px 0 0;
        font-size:9px;
        letter-spacing:0.14em;
        text-transform:uppercase;
        color:var(--hg-eyebrow, #8a8177);
        pointer-events:none;
      }
      .dss-capture-file-control{
        position:relative;
        z-index:2;
        display:block;
        width:100%;
        cursor:pointer;
      }
      .dss-capture-primary{
        display:block;
        box-sizing:border-box;
        width:100%;
        padding:12px 16px;
        border-radius:10px;
        border:1px solid oklch(from var(--hg-gold, #ad9164) 0.82 0.04 h);
        background:oklch(from var(--hg-gold, #ad9164) 0.94 0.024 h);
        font-size:11px;
        letter-spacing:0.12em;
        text-transform:uppercase;
        color:var(--hg-ink, #1c1b1a);
        cursor:pointer;
        text-align:center;
        pointer-events:none;
      }
      .dss-capture-file-input{
        position:absolute;
        inset:0;
        z-index:3;
        width:100%;
        height:100%;
        margin:0;
        padding:0;
        opacity:0;
        cursor:pointer;
        font-size:16px;
        border:0;
      }
      /* Keyboard focus lands on the invisible input — surface it on the
         visible control instead. */
      .dss-capture-file-control:has(.dss-capture-file-input:focus-visible)
        .dss-capture-primary{
        outline:2px solid var(--hg-focus-ring, #987648);
        outline-offset:2px;
      }
      .dss-capture-file-control.is-busy .dss-capture-primary{
        opacity:0.6;
      }
      .dss-capture-file-control.is-busy .dss-capture-file-input{
        pointer-events:none;
        cursor:default;
      }
      .dss-capture-file-control.is-hidden{
        position:absolute;
        width:1px;
        height:1px;
        overflow:hidden;
        clip:rect(0,0,0,0);
        pointer-events:none;
      }
      .dss-capture-error{
        margin:14px 0 0;
        font-size:13px;
        font-weight:600;
        color:oklch(0.42 0.12 30);
        line-height:1.45;
      }
      .dss-capture-actions{
        margin:16px 0 0;
        display:flex;
        justify-content:center;
      }
      .dss-capture-secondary{
        appearance:none;
        border:1px solid var(--hg-line-strong, #d9cdbd);
        background:transparent;
        color:var(--hg-charcoal, #2b2723);
        font-size:11px;
        letter-spacing:0.08em;
        text-transform:uppercase;
        padding:10px 14px;
        border-radius:10px;
        cursor:pointer;
      }
      .dss-capture-secondary:focus-visible{
        outline:2px solid var(--hg-focus-ring, #987648);
        outline-offset:2px;
      }
      .dss-capture-hint{
        margin:16px 0 0;
        font-size:10px;
        letter-spacing:0.06em;
        color:var(--hg-eyebrow, #8a8177);
      }
      .sr-only{
        position:absolute;
        width:1px;
        height:1px;
        padding:0;
        margin:-1px;
        overflow:hidden;
        clip:rect(0,0,0,0);
        white-space:nowrap;
        border:0;
      }
    `,
      }}
    />
  );
}
