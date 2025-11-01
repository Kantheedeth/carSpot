"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="
        group sticky top-0 h-[100svh] border-r border-white/10 bg-[#0f141a]
        w-20 md:w-20 hover:w-64 transition-[width] duration-300 ease-out
      "
    >
      <div className="flex h-full flex-col justify-between py-4">
        {/* Top group */}
        <div>
          {/* Brand */}
          <div className="flex flex-col items-start px-4">
            {/* collapsed dot */}
            <div className="grid h-10 w-10 place-items-center group-hover:hidden" title="CarSpot">
              <div className="h-4 w-4 rounded-full bg-lime-400 shadow-[0_0_8px_2px_rgba(163,230,53,0.45)]" />
            </div>

            {/* expanded logo */}
            <div className="hidden w-full items-center justify-center group-hover:flex">
              <Image
                src="/carspot-logo.png"
                alt="CarSpot"
                width={160}
                height={40}
                priority
                className="h-8 w-auto"
              />
            </div>

            <div className="mt-3 h-px w-10 bg-white/10" />
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 px-2">
            <NavItem href="/" icon="🏠" label="Feed" pathname={pathname} />
            <NavItem href="/create" icon="➕" label="Create" pathname={pathname} isHighlighted />
            <NavItem href="/bookmarks" icon="🔖" label="Bookmarks" pathname={pathname} />
            <NavItem href="/messages" icon="💬" label="Messages" pathname={pathname} />
            <NavItem href="/admin" icon="🛠" label="Admin" pathname={pathname} />
          </nav>
        </div>

        {/* Bottom group */}
        <div className="px-2">
          <NavItem href="/u/1" icon="👤" label="Profile" pathname={pathname} />
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  pathname,
  isHighlighted = false,
}: {
  href: string;
  icon: string;
  label: string;
  pathname: string | null;
  isHighlighted?: boolean;
}) {
  const active = pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="
        relative flex items-center gap-3 rounded-xl px-2 py-2 text-white/80
        hover:bg-white/5 hover:text-white transition-colors
      "
    >
      {/* ✅ Just the green line — no background highlight */}
      {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-lime-400" />}

      <span
        className={`
          grid h-10 w-10 place-items-center text-[22px] leading-none
          ${isHighlighted ? "rounded-lg bg-white/10" : ""}
        `}
      >
        {icon}
      </span>

      <span className="ml-1 hidden truncate text-[15px] font-medium group-hover:block">
        {label}
      </span>
    </Link>
  );
}
