"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/usuSession";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAuthed, isAdmin } = useSession();

  // for now, until you have /me, fall back to /u/{user_id} or /u/1
  const profileHref = user ? `/u/${user.user_id}` : "/login";

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
            <div
              className="grid h-10 w-10 place-items-center group-hover:hidden"
              title="CarSpot"
            >
              <div className="h-4 w-4 rounded-full bg-lime-400 shadow-[0_0_8px_2px_rgba(163,230,53,0.45)]" />
            </div>

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

          {/* Nav */}
          <nav className="flex flex-col gap-1 px-2">
            {/* Feed always */}
            <NavItem
              href="/"
              iconSrc="/feed.png"
              label="Feed"
              pathname={pathname}
            />

            {/* If NOT logged in -> show Login right under Feed */}
            {!isAuthed && (
              <NavItem
                href="/login"
                iconSrc="/window.svg"
                label="Login"
                pathname={pathname}
              />
            )}

            {/* If logged in -> app actions + Profile under Admin */}
            {isAuthed && (
              <>
                <NavItem
                  href="/create"
                  iconSrc="/create.png"
                  label="Create"
                  pathname={pathname}
                  isHighlighted
                />
                <NavItem
                  href="/bookmarks"
                  iconSrc="/bookmark.png"
                  label="Bookmarks"
                  pathname={pathname}
                />
                <NavItem
                  href="/messages"
                  iconSrc="/message.png"
                  label="Messages"
                  pathname={pathname}
                />
                {isAdmin && (
                  <NavItem
                    href="/admin"
                    iconSrc="/file.svg"
                    label="Admin"
                    pathname={pathname}
                  />
                )}
                <NavItem
                  href={profileHref}
                  iconSrc="/profile.png"
                  label="Profile"
                  pathname={pathname}
                />
              </>
            )}
          </nav>
        </div>

        {/* bottom spacer / tiny footer optional */}
        <div className="px-2 pb-1 text-[9px] text-white/10">
          {/* © CarSpot */}
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  iconSrc,
  label,
  pathname,
  isHighlighted = false,
}: {
  href: string;
  iconSrc: string;
  label: string;
  pathname: string | null;
  isHighlighted?: boolean;
}) {
  const active =
    pathname === href ||
    (href !== "/" && pathname?.startsWith(href + "/"));

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
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-lime-400" />
      )}

      <span
        className={`grid h-10 w-10 place-items-center ${isHighlighted ? "rounded-lg bg-white/10" : ""}`}
      >
        <Image
          src={iconSrc}
          alt={`${label} icon`}
          width={24}
          height={24}
          className="h-6 w-6 object-contain"
        />
      </span>

      <span className="ml-1 hidden truncate text-[15px] font-medium group-hover:block">
        {label}
      </span>
    </Link>
  );
}
