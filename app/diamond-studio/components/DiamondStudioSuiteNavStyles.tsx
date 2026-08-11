/** Shared Diamond Studio Suite subnav styles (Hourglass parchment instrument tabs). */
export default function DiamondStudioSuiteNavStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .dts-topbar{
        position:relative;
        z-index:2;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:2px;
        padding:4px 16px 3px;
        min-height:44px;
        height:auto;
        flex-shrink:0;
        background: color-mix(in srgb, var(--hg-ivory, #efe8de) 88%, #f7f1e8);
        border-bottom:1px solid color-mix(in srgb, var(--hg-line, #e4dbcf) 82%, var(--hg-gold-deep, #987648));
        box-shadow:none;
      }
      .dts-topnav-eyebrow{
        margin:0;
        padding:0;
        font-size:8.5px;
        font-weight:500;
        letter-spacing:0.14em;
        text-transform:uppercase;
        color:color-mix(in srgb, var(--hg-muted, #70665d) 72%, var(--hg-ink, #1c1b1a));
        line-height:1.2;
        text-align:center;
        user-select:none;
      }
      .dts-topnav{
        display:flex; align-items:stretch; justify-content:center;
        gap:clamp(12px, 2vw, 22px);
        min-width:0;
        overflow-x:visible;
        overflow-y:hidden;
        padding:0;
        width:100%;
        max-width:54rem;
      }
      .dts-topnav-item{
        display:flex;
        flex-direction:column;
        align-items:stretch;
        justify-content:stretch;
        flex:0 0 auto;
        width:clamp(148px, 11.2vw, 162px);
        min-width:0;
        text-align:center;
        user-select:none;
        position:relative;
      }
      .dts-topnav-hit{
        position:relative;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:3px;
        box-sizing:border-box;
        width:100%;
        min-height:52px;
        padding:9px 12px 11px;
        text-decoration:none;
        color:inherit;
        border-radius:4px;
        border:1px solid color-mix(in srgb, var(--hg-line, #e4dbcf) 78%, var(--hg-gold-deep, #987648));
        background:color-mix(in srgb, var(--hg-ivory, #efe8de) 62%, #fff8ef);
        transition:
          color 260ms cubic-bezier(0.28, 0.11, 0.22, 1),
          background-color 260ms cubic-bezier(0.28, 0.11, 0.22, 1),
          border-color 260ms cubic-bezier(0.28, 0.11, 0.22, 1),
          box-shadow 260ms cubic-bezier(0.28, 0.11, 0.22, 1);
      }
      .dts-topnav-label{
        display:inline;
        font-size:11.5px; font-weight:500; letter-spacing:0.08em;
        text-transform:uppercase;
        color:color-mix(in srgb, var(--hg-muted, #70665d) 55%, var(--hg-ink, #1c1b1a));
        white-space:nowrap;
        line-height:1.2;
        text-decoration:none;
      }
      .dts-topnav-line{
        display:inline;
      }
      .dts-topnav-line-gap{
        display:inline;
      }
      .dts-topnav-desc{
        font-size:9.5px;
        font-weight:400;
        letter-spacing:0.045em;
        text-transform:none;
        /* P0-4 (WCAG 1.4.3): keep ≥4.5:1 on parchment surfaces. */
        color:var(--hg-muted, #70665d);
        line-height:1.2;
        white-space:nowrap;
      }
      .dts-topnav-item.is-active .dts-topnav-hit{
        background:color-mix(in srgb, #fff 58%, var(--hg-ivory, #efe8de));
        border-color:color-mix(in srgb, var(--hg-line, #e4dbcf) 55%, var(--hg-gold-deep, #987648));
        box-shadow:
          0 1px 0 color-mix(in srgb, var(--hg-gold-deep, #987648) 22%, transparent),
          inset 0 0 0 1px color-mix(in srgb, #fff 55%, transparent);
      }
      .dts-topnav-item.is-active .dts-topnav-label{
        color:var(--hg-ink, #1c1b1a);
        font-weight:600;
        letter-spacing:0.075em;
      }
      .dts-topnav-item.is-active .dts-topnav-desc{
        color:color-mix(in srgb, var(--hg-muted, #70665d) 58%, var(--hg-ink, #1c1b1a));
      }
      .dts-topnav-item.is-active .dts-topnav-hit::after{
        content:"";
        position:absolute;
        left:50%;
        bottom:4px;
        transform:translateX(-50%);
        width:min(68%, 104px);
        height:1.5px;
        /* Illuminated seam — antique gold edges, champagne center. */
        background:linear-gradient(90deg, transparent,
          color-mix(in srgb, var(--hg-gold-deep, #987648) 82%, transparent) 14%,
          color-mix(in srgb, var(--hg-light-champagne, #f4e9d2) 62%, var(--hg-gold-deep, #987648)) 50%,
          color-mix(in srgb, var(--hg-gold-deep, #987648) 82%, transparent) 86%, transparent);
        opacity:1;
        pointer-events:none;
      }
      /* Route-entry — the seam resolves into position once, short and
         direct; no travel across the nav. */
      @media (prefers-reduced-motion: no-preference) {
        .dts-topnav-item.is-active .dts-topnav-hit::after{
          animation: dts-indicator-resolve 450ms var(--hg-motion-ease-luxury, cubic-bezier(0.19, 0.62, 0.17, 0.99)) backwards;
        }
      }
      @keyframes dts-indicator-resolve {
        0% {
          opacity: 0;
          transform: translateX(-50%) scaleX(0.55);
        }
        100% {
          opacity: 1;
          transform: translateX(-50%) scaleX(1);
        }
      }
      /* Idle tools — a faint seam warms under hover/focus; no scale, no lift. */
      .dts-topnav-item.is-idle .dts-topnav-hit::after{
        content:"";
        position:absolute;
        left:50%;
        bottom:4px;
        transform:translateX(-50%);
        width:min(68%, 104px);
        height:1px;
        background:linear-gradient(90deg, transparent,
          color-mix(in srgb, var(--hg-gold-deep, #987648) 48%, transparent) 50%, transparent);
        opacity:0;
        transition:opacity 260ms cubic-bezier(0.28, 0.11, 0.22, 1);
        pointer-events:none;
      }
      .dts-topnav-item.is-idle:hover .dts-topnav-hit::after,
      .dts-topnav-item.is-idle .dts-topnav-hit:focus-visible::after{
        opacity:1;
      }
      .dts-topnav-hit:focus-visible{
        outline:2px solid var(--hg-focus-ring, #987648);
        outline-offset:4px;
        border-radius:6px;
      }
      .dts-topnav-item.is-idle .dts-topnav-hit{
        border-color:color-mix(in srgb, var(--hg-line, #e4dbcf) 72%, var(--hg-gold-deep, #987648));
      }
      .dts-topnav-item.is-idle:hover .dts-topnav-hit{
        background:color-mix(in srgb, var(--hg-ivory, #efe8de) 48%, #fff);
        border-color:color-mix(in srgb, var(--hg-line, #e4dbcf) 58%, var(--hg-gold-deep, #987648));
      }
      .dts-topnav-item.is-idle:hover .dts-topnav-label{
        color:var(--hg-ink, #1c1b1a);
      }
      .dts-topnav-item.is-idle:hover .dts-topnav-desc{
        color:color-mix(in srgb, var(--hg-muted, #70665d) 70%, var(--hg-ink, #1c1b1a));
      }
      .dts-topnav-item.is-soon .dts-topnav-hit{
        color:color-mix(in srgb, var(--hg-muted, #70665d) 62%, #fff);
        cursor:default;
        pointer-events:none;
        border-color:transparent;
        background:transparent;
      }
      @media (min-width: 1024px) {
        [data-suite-instrument] .dts-topbar{
          display:grid;
          /* Mirror Size Studio main columns so eyebrow / nav / stage title share one axis. */
          grid-template-columns:256px minmax(0, 1fr);
          grid-template-rows:auto auto;
          justify-content:stretch;
          align-items:center;
          padding-left:0;
          padding-right:0;
          gap:2px 0;
        }
        [data-suite-instrument] .dts-topnav-eyebrow{
          grid-column:2;
          grid-row:1;
          justify-self:center;
        }
        [data-suite-instrument] .dts-topnav{
          grid-column:2;
          grid-row:2;
          justify-content:center;
          justify-self:center;
          width:max-content;
          max-width:100%;
        }
      }
      @media (min-width: 1200px) and (max-width: 1440px) {
        [data-suite-instrument] .dts-topbar{
          grid-template-columns:minmax(220px, 260px) minmax(0, 1fr);
        }
      }
      @media (max-width: 768px) {
        .dts-topbar{
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          padding:8px 10px 7px;
          min-height:44px;
          height:auto;
          gap:5px;
        }
        .dts-topnav{
          display:grid;
          grid-template-columns:repeat(3, minmax(0, 1fr));
          gap:6px;
          margin-left:0;
          padding:0;
          justify-content:stretch;
          width:100%;
          max-width:none;
          min-width:0;
          overflow-x:hidden;
        }
        .dts-topnav-item{
          width:100%;
          min-width:0;
          height:100%;
          flex:1 1 auto;
        }
        .dts-topnav-hit{
          width:100%;
          height:100%;
          min-height:48px;
          padding:7px 3px 10px;
          box-sizing:border-box;
          gap:3px;
        }
        .dts-topnav-label{
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:1px;
          font-size:8.5px;
          letter-spacing:0.04em;
          white-space:normal;
          max-width:100%;
          line-height:1.15;
        }
        .dts-topnav-line{
          display:block;
        }
        .dts-topnav-line-gap{
          display:none;
        }
        .dts-topnav-desc{
          font-size:7.5px;
          letter-spacing:0.02em;
          white-space:normal;
          max-width:100%;
          line-height:1.15;
          padding:0 1px;
        }
        .dts-topnav-item.is-active .dts-topnav-hit::after{
          width:min(64%, 88px);
          bottom:2px;
        }
      }
      /* Prefer hiding descriptors over shortening primary outcome labels. */
      @media (max-width: 374px) {
        .dts-topnav-desc{
          display:none;
        }
        .dts-topnav-hit{
          min-height:44px;
          padding:8px 2px 9px;
          gap:2px;
        }
        .dts-topnav-label{
          font-size:8px;
          letter-spacing:0.035em;
        }
      }
    `,
      }}
    />
  );
}
