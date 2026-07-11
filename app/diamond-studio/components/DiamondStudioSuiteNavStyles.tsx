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
        gap:4px;
        padding:8px 16px 6px;
        min-height:44px;
        height:auto;
        flex-shrink:0;
        background: color-mix(in srgb, var(--hg-ivory, #efe8de) 94%, #fff);
        border-bottom:1px solid var(--hg-line, #e4dbcf);
        box-shadow:none;
      }
      .dts-topnav-eyebrow{
        margin:0;
        padding:0;
        font-size:8.5px;
        font-weight:500;
        letter-spacing:0.14em;
        text-transform:uppercase;
        color:color-mix(in srgb, var(--hg-muted, #756b61) 78%, var(--hg-ink, #1c1b1a));
        line-height:1.2;
        text-align:center;
        user-select:none;
      }
      .dts-topnav{
        display:flex; align-items:stretch; justify-content:center;
        gap:clamp(10px, 2.4vw, 28px);
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
        flex:0 1 auto;
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
        gap:2px;
        min-height:44px;
        padding:7px 14px 10px;
        text-decoration:none;
        color:inherit;
        border-radius:3px;
        border:1px solid transparent;
        background:transparent;
        transition:
          color 260ms cubic-bezier(0.28, 0.11, 0.22, 1),
          background-color 260ms cubic-bezier(0.28, 0.11, 0.22, 1),
          border-color 260ms cubic-bezier(0.28, 0.11, 0.22, 1),
          box-shadow 260ms cubic-bezier(0.28, 0.11, 0.22, 1);
      }
      .dts-topnav-label{
        display:inline;
        font-size:10px; font-weight:500; letter-spacing:0.07em;
        text-transform:uppercase;
        color:color-mix(in srgb, var(--hg-muted, #756b61) 88%, var(--hg-ink, #1c1b1a));
        white-space:nowrap;
        line-height:1.25;
        text-decoration:none;
      }
      .dts-topnav-line{
        display:inline;
      }
      .dts-topnav-line-gap{
        display:inline;
      }
      .dts-topnav-desc{
        font-size:8.5px;
        font-weight:400;
        letter-spacing:0.04em;
        text-transform:none;
        color:color-mix(in srgb, var(--hg-muted, #756b61) 72%, #fff);
        line-height:1.2;
        white-space:nowrap;
      }
      .dts-topnav-item.is-active .dts-topnav-hit{
        background:color-mix(in srgb, var(--hg-ivory, #efe8de) 55%, #fff);
        border-color:color-mix(in srgb, var(--hg-line, #e4dbcf) 88%, var(--hg-gold-deep, #987648));
        box-shadow:0 1px 0 color-mix(in srgb, var(--hg-gold-deep, #987648) 18%, transparent);
      }
      .dts-topnav-item.is-active .dts-topnav-label{
        color:var(--hg-ink, #1c1b1a);
        font-weight:600;
        letter-spacing:0.07em;
      }
      .dts-topnav-item.is-active .dts-topnav-desc{
        color:color-mix(in srgb, var(--hg-muted, #756b61) 70%, var(--hg-ink, #1c1b1a));
      }
      .dts-topnav-item.is-active .dts-topnav-hit::after{
        content:"";
        position:absolute;
        left:50%;
        bottom:3px;
        transform:translateX(-50%);
        width:min(72%, 112px);
        height:1.5px;
        background:linear-gradient(90deg, transparent,
          color-mix(in srgb, var(--hg-gold-deep, #987648) 82%, transparent) 14%,
          color-mix(in srgb, var(--hg-gold-deep, #987648) 82%, transparent) 86%, transparent);
        opacity:1;
        pointer-events:none;
      }
      .dts-topnav-hit:focus-visible{
        outline:2px solid var(--hg-focus-ring, #cbbda9);
        outline-offset:2px;
      }
      .dts-topnav-item.is-idle .dts-topnav-hit{
        border-color:color-mix(in srgb, var(--hg-line, #e4dbcf) 70%, transparent);
      }
      .dts-topnav-item.is-idle:hover .dts-topnav-hit{
        background:color-mix(in srgb, var(--hg-ivory, #efe8de) 70%, #fff);
        border-color:var(--hg-line, #e4dbcf);
      }
      .dts-topnav-item.is-idle:hover .dts-topnav-label{
        color:var(--hg-ink, #1c1b1a);
      }
      .dts-topnav-item.is-idle:hover .dts-topnav-desc{
        color:color-mix(in srgb, var(--hg-muted, #756b61) 80%, var(--hg-ink, #1c1b1a));
      }
      .dts-topnav-item.is-soon .dts-topnav-hit{
        color:color-mix(in srgb, var(--hg-muted, #756b61) 62%, #fff);
        cursor:default;
        pointer-events:none;
        border-color:transparent;
      }
      @media (min-width: 1024px) {
        [data-suite-instrument] .dts-topbar{
          display:grid;
          grid-template-columns:256px minmax(0, 1fr);
          grid-template-rows:auto auto;
          justify-content:stretch;
          align-items:center;
          padding-left:0;
          padding-right:16px;
          gap:4px 0;
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
          width:100%;
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
