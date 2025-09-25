"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";

type NavLinkProps = {
  segment: string;
  label: string;
  locale: string;
};

function NavLink({ segment, label, locale }: NavLinkProps) {
  const pathname = usePathname();
  const href = `/${locale}/${segment}`;
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm transition ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!pathname) return null;

  const search = searchParams?.toString();

  const buildHref = (locale: string) => {
    const segments = pathname.split("/");
    if (segments.length > 1) {
      segments[1] = locale;
    } else {
      segments.push(locale);
    }

    let href = segments.join("/");
    if (!href.startsWith("/")) href = `/${href}`;
    return search ? `${href}?${search}` : href;
  };

  return (
    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
      {routing.locales.map((locale) => {
        const active = locale === currentLocale;
        return (
          <Link
            key={locale}
            href={buildHref(locale)}
            className={`px-2 py-1 rounded transition ${
              active
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {locale.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}

export default function Header() {
  const locale = useLocale();
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl w-full mx-auto flex h-14 items-center justify-between px-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 font-bold text-lg tracking-tight text-slate-900 dark:text-white"
        >
          <span className="inline-block h-3 w-3 rounded-sm bg-slate-900 dark:bg-slate-100" />
          {tApp("title")}
        </Link>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-3">
            <NavLink segment="onboard" label={tNav("onboard")} locale={locale} />
            <NavLink segment="bookings" label={tNav("bookings")} locale={locale} />
          </nav>
          <LocaleSwitcher currentLocale={locale} />
        </div>
      </div>
    </header>
  );
}
