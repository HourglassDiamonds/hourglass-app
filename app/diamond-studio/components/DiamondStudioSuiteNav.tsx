"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DIAMOND_STUDIO_SUITE_NAV,
  isDiamondStudioSuiteNavActive,
} from "./diamond-studio-suite-nav-config";
import DiamondStudioSuiteNavStyles from "./DiamondStudioSuiteNavStyles";

export default function DiamondStudioSuiteNav() {
  const pathname = usePathname() ?? "";

  return (
    <>
      <DiamondStudioSuiteNavStyles />
      <nav
        className="dts-topbar"
        aria-label="Diamond Studio tools"
        data-dts-subnav
      >
        <div className="dts-topnav">
          {DIAMOND_STUDIO_SUITE_NAV.map((item) => {
            const active = isDiamondStudioSuiteNavActive(pathname, item.href);
            return (
              <div
                key={item.href}
                className={`dts-topnav-item ${active ? "is-active" : "is-idle"}`}
              >
                {active ? (
                  <span className="dts-topnav-label">{item.label}</span>
                ) : (
                  <Link href={item.href} className="dts-topnav-label">
                    {item.label}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
