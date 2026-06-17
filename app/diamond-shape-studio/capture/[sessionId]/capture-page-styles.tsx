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
      }
      .dss-capture-card{
        width:min(420px, 100%);
        background:oklch(0.985 0.006 78);
        border:1px solid oklch(0.93 0.006 72);
        border-radius:14px;
        padding:28px 24px 24px;
        box-shadow:0 1px 2px oklch(0.55 0.012 65 / 0.04), 0 4px 14px oklch(0.45 0.012 65 / 0.04);
        text-align:center;
      }
      .dss-capture-brand{
        font-size:9px; letter-spacing:0.14em; color:oklch(0.46 0.011 62);
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
        margin:0 0 20px;
      }
      .dss-capture-primary{
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
      }
      .dss-capture-primary:disabled{ opacity:0.6; cursor:default; }
      .dss-capture-error{
        margin:14px 0 0;
        font-size:12px;
        color:oklch(0.48 0.08 35);
        line-height:1.45;
      }
      .dss-capture-hint{
        margin:16px 0 0;
        font-size:10px;
        letter-spacing:0.06em;
        color:oklch(0.62 0.010 65);
      }
    `,
      }}
    />
  );
}
