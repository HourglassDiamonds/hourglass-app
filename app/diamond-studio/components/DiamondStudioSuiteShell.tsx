"use client";

import Header from "../../shared-components/Header";
import DiamondStudioBrandChrome from "./DiamondStudioBrandChrome";
import DiamondStudioSuiteNav from "./DiamondStudioSuiteNav";

const SUITE_SHELL_CSS = `
[data-diamond-studio-suite-route] {
  --dts-header-h: var(--hg-studio-header-h, 7.5rem);
  --dts-subnav-h: 78px;
  --dts-chrome-h: calc(var(--dts-header-h) + var(--dts-subnav-h));
  --dts-workspace-h: calc(100dvh - var(--dts-chrome-h));
  background: var(--hg-ivory, #efe8de);
  color: var(--hg-ink, #1c1b1a);
}
@media (max-width: 768px) {
  [data-diamond-studio-suite-route] {
    --dts-subnav-h: 92px;
  }
}
@media (max-width: 374px) {
  [data-diamond-studio-suite-route] {
    --dts-subnav-h: 78px;
  }
}
@media (min-width: 1024px) {
  [data-diamond-studio-suite-route][data-suite-instrument] .dts-app,
  [data-diamond-studio-suite-route][data-suite-instrument] .dss-app {
    height: var(--dts-workspace-h);
    max-height: var(--dts-workspace-h);
    min-height: 0;
    overflow: hidden;
  }
}
`;

type DiamondStudioSuiteShellProps = {
  children: React.ReactNode;
  /** Enables measured workspace height for .dts-app / .dss-app instrument tools. */
  instrument?: boolean;
};

export default function DiamondStudioSuiteShell({
  children,
  instrument = false,
}: DiamondStudioSuiteShellProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SUITE_SHELL_CSS }} />
      <div
        data-diamond-studio-suite-route
        data-diamond-studio-route
        data-suite-instrument={instrument ? true : undefined}
        className="diamond-studio-suite-route min-h-screen w-full"
      >
        {instrument ? <DiamondStudioBrandChrome /> : null}
        <div className="diamond-studio-site-header" data-dts-site-header>
          <div className="mx-auto w-full max-w-[1200px] px-6 md:px-10">
            <Header currentPage="diamond-studio" />
          </div>
        </div>
        <DiamondStudioSuiteNav />
        {children}
      </div>
    </>
  );
}
