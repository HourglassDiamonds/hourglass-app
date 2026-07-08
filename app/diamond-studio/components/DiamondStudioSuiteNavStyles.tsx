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
        align-items:stretch;
        justify-content:center;
        padding:0 16px;
        min-height:44px;
        height:var(--dts-subnav-h, 44px);
        flex-shrink:0;
        background: color-mix(in srgb, var(--hg-ivory, #efe8de) 94%, #fff);
        border-bottom:1px solid var(--hg-line, #e4dbcf);
        box-shadow:none;
      }
      .dts-topnav{
        display:flex; align-items:flex-end; justify-content:center;
        gap:clamp(18px, 4vw, 48px);
        min-width:0;
        overflow-x:auto;
        overflow-y:hidden;
        padding:8px 4px 0;
        scrollbar-width:none;
        -ms-overflow-style:none;
        width:100%;
      }
      .dts-topnav::-webkit-scrollbar{ display:none; }
      .dts-topnav-item{
        display:flex; flex-direction:column; align-items:center; justify-content:flex-end;
        gap:4px;
        flex:0 0 auto;
        min-width:0;
        text-align:center;
        user-select:none;
        position:relative;
        padding:0 2px 8px;
      }
      .dts-topnav-item.is-active .dts-topnav-label{
        color:var(--hg-ink, #1c1b1a);
        font-weight:600;
        letter-spacing:0.08em;
      }
      .dts-topnav-item.is-active::after{
        content:"";
        position:absolute;
        left:50%;
        bottom:2px;
        transform:translateX(-50%);
        width:min(100%, 148px);
        height:1px;
        background:linear-gradient(90deg, transparent,
          color-mix(in srgb, var(--hg-gold-deep, #987648) 70%, transparent) 18%,
          color-mix(in srgb, var(--hg-gold-deep, #987648) 70%, transparent) 82%, transparent);
        opacity:0.98;
      }
      .dts-topnav-label{
        font-size:10px; font-weight:500; letter-spacing:0.08em;
        text-transform:uppercase; color:var(--hg-muted, #756b61);
        white-space:nowrap;
        line-height:1.28;
        text-decoration:none;
        transition:color 260ms cubic-bezier(0.28, 0.11, 0.22, 1);
      }
      .dts-topnav-label:focus-visible{
        outline:2px solid var(--hg-focus-ring, #cbbda9);
        outline-offset:3px;
        border-radius:4px;
      }
      .dts-topnav-item:not(.is-active):hover .dts-topnav-label{
        color:var(--hg-ink, #1c1b1a);
      }
      @media (max-width: 768px) {
        .dts-topbar{
          display:flex;
          align-items:stretch;
          justify-content:flex-start;
          padding:0 12px;
          min-height:44px;
          height:auto;
        }
        .dts-topnav{
          margin-left:0;
          padding:8px 0 0;
          justify-content:flex-start;
          gap:clamp(16px,4.5vw,28px);
          width:100%;
          min-width:0;
        }
      }
    `,
      }}
    />
  );
}
