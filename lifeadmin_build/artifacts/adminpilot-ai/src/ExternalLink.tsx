import type { MouseEvent, ReactNode } from "react";
import { isNativeDevice, openExternalDeviceUrl } from "./lib/offline/device-files.mjs";

export default function ExternalLink({ href, className = "", children, ...props }: {
  href: string; className?: string; children: ReactNode;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  rel?: string;
  target?: string;
  "aria-label"?: string;
}) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (!isNativeDevice()) return;
    event.preventDefault();
    void openExternalDeviceUrl(href).catch(() => { window.location.assign(href); });
  }
  return <a href={href} className={className} target={props.target || "_blank"}
    rel={props.rel || "noopener noreferrer"} referrerPolicy={props.referrerPolicy || "no-referrer"}
    aria-label={props["aria-label"]} onClick={open}>{children}</a>;
}
