"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  DIAMOND_STUDIO_SUITE_NAV,
  type DiamondStudioSuiteNavItem,
  isDiamondStudioSuiteNavActive,
} from "./diamond-studio-suite-nav-config";
import DiamondStudioSuiteNavStyles from "./DiamondStudioSuiteNavStyles";

function SuiteNavLabel({ item }: { item: DiamondStudioSuiteNavItem }) {
  return (
    <>
      <span className="dts-topnav-label">
        {item.labelLines.map((line, index) => (
          <Fragment key={`${item.href}-${index}`}>
            {index > 0 ? <span className="dts-topnav-line-gap"> </span> : null}
            <span className="dts-topnav-line">{line}</span>
          </Fragment>
        ))}
      </span>
      <span className="dts-topnav-desc">{item.descriptor}</span>
    </>
  );
}

function suiteNavAccessibleName(item: DiamondStudioSuiteNavItem): string {
  return `${item.label}. ${item.descriptor}`;
}

export default function DiamondStudioSuiteNav() {
  const pathname = usePathname() ?? "";

  return (
    <>
      <DiamondStudioSuiteNavStyles />
      <nav
        className="dts-topbar"
        aria-label="Explore the Diamond Studio"
        data-dts-subnav
      >
        <p className="dts-topnav-eyebrow">Explore the Diamond Studio</p>
        <div className="dts-topnav" role="list">
          {DIAMOND_STUDIO_SUITE_NAV.map((item) => {
            const active =
              !item.comingSoon &&
              isDiamondStudioSuiteNavActive(pathname, item.href);
            const accessibleName = suiteNavAccessibleName(item);
            return (
              <div
                key={item.href}
                role="listitem"
                className={`dts-topnav-item ${active ? "is-active" : "is-idle"}${item.comingSoon ? " is-soon" : ""}`}
              >
                {item.comingSoon ? (
                  <span
                    className="dts-topnav-hit"
                    aria-disabled="true"
                    aria-label={accessibleName}
                    title="Coming soon"
                  >
                    <SuiteNavLabel item={item} />
                  </span>
                ) : active ? (
                  <span
                    className="dts-topnav-hit"
                    aria-current="page"
                    aria-label={accessibleName}
                  >
                    <SuiteNavLabel item={item} />
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="dts-topnav-hit"
                    aria-label={accessibleName}
                  >
                    <SuiteNavLabel item={item} />
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
