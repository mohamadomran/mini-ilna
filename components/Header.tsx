"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`px-2 py-1 rounded-md text-sm transition ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Header() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm sticky top-0 z-50">
      {/* Center the content with max-w and mx-auto */}
      <div className="max-w-3xl mx-auto flex h-14 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg tracking-tight"
        >
          <span className="inline-block h-3 w-3 rounded-sm bg-slate-900 dark:bg-slate-100" />
          mini-ilna
        </Link>
        <nav className="flex items-center gap-3">
          <NavLink href="/onboard">Onboard</NavLink>
          <NavLink href="/bookings">Bookings</NavLink>
        </nav>
      </div>
    </header>
  );
}
