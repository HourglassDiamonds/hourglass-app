export function CapturePageStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .dss-capture-shell{
        min-height:100dvh;
        display:grid;
        place-items:center;
        padding:24px 20px;
        background:oklch(0.965 0.008 75);
        color:oklch(0.28 0.012 60);
        font-family:var(--font-geist-sans), system-ui, sans-serif;
        pointer-events:auto;
      }
      .dss-capture-card{
        width:min(420px, 100%);
        background:oklch(0.985 0.006 78);
        border:1px solid oklch(0.93 0.006 72);
        border-radius:14px;
        padding:28px 24px 24px;
        box-shadow:0 1px 2px oklch(0.55 0.012 65 / 0.04), 0 4px 14px oklch(0.45 0.012 65 / 0.04);
        text-align:center;
        pointer-events:auto;
        position:relative;
        z-index:1;
      }
      .dss-capture-brand{
        font-size:9px; letter-spacing:0.18em; text-transform:uppercase;
        color:oklch(0.46 0.011 62);
        margin:0 0 16px;
      }
      .dss-capture-title{
        font-family:ui-serif, Georgia, serif;
        font-size:clamp(22px, 5vw, 26px);
        font-weight:400;
        margin:0 0 10px;
      }
      .dss-capture-body{
        font-size:13px; line-height:1.55; color:oklch(0.46 0.011 62);
        margin:0 0 16px;
      }
      .dss-capture-note{
        font-size:11.5px; line-height:1.5; color:oklch(0.52 0.010 62);
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
        border:1px solid oklch(0.90 0.008 72);
        background:
          radial-gradient(ellipse 70% 55% at 50% 42%, oklch(0.99 0.004 78), oklch(0.96 0.008 75));
        overflow:hidden;
        pointer-events:none;
      }
      .dss-capture-guide-caption{
        margin:8px 0 0;
        font-size:9px;
        letter-spacing:0.14em;
        text-transform:uppercase;
        color:oklch(0.58 0.010 65);
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
        border:1px solid oklch(0.82 0.040 70);
        background:oklch(0.94 0.024 75);
        font-size:11px;
        letter-spacing:0.12em;
        text-transform:uppercase;
        color:oklch(0.28 0.012 60);
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
        border:1px solid oklch(0.86 0.012 70);
        background:transparent;
        color:oklch(0.36 0.012 60);
        font-size:11px;
        letter-spacing:0.08em;
        text-transform:uppercase;
        padding:10px 14px;
        border-radius:10px;
        cursor:pointer;
      }
      .dss-capture-hint{
        margin:16px 0 0;
        font-size:10px;
        letter-spacing:0.06em;
        color:oklch(0.62 0.010 65);
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
