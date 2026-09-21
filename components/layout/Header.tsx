"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Settings } from "lucide-react";
import Link from "next/link";
import { SearchBar } from "@/components/ui/SearchBar";
import { formatUpdatedAt } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import type { Alert } from "@/types";

export function Header({
  breadcrumb,
  title,
  subtitle,
  userName,
  userRole,
  alerts = [],
  onMenuClick,
}: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  userName: string;
  userRole: string;
  alerts?: Alert[];
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    setMenuOpen(false);
    await supabase?.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-surface px-4 py-3.5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              aria-label="Open menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-page lg:hidden"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="truncate text-[12.5px] text-text-secondary">
              <span className="hover:text-accent">{breadcrumb.split(" / ")[0]}</span>
              <span className="mx-1.5 text-text-tertiary">/</span>
              <span className="text-text-primary">{breadcrumb.split(" / ")[1]}</span>
            </div>
            <h1 className="mt-0.5 truncate text-[20px] font-semibold leading-tight text-text-primary sm:text-[22px]">
              {title}
            </h1>
            <p className="mt-0.5 hidden truncate text-[12.5px] text-text-secondary sm:block">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[12.5px] text-text-secondary xl:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Last updated: {formatUpdatedAt()} EAT
          </div>

          <SearchBar />

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-page"
            >
              <Bell className="h-4 w-4" />
              {alerts.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
                  {alerts.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-lg sm:w-80">
                <div className="border-b border-border px-3.5 py-2.5 text-[12.5px] font-semibold text-text-primary">
                  Notifications
                </div>
                {alerts.length === 0 ? (
                  <div className="px-3.5 py-6 text-center text-[12.5px] text-text-tertiary">
                    You&apos;re all caught up.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {alerts.slice(0, 5).map((a) => (
                      <div
                        key={a.id}
                        className="border-b border-border px-3.5 py-2.5 last:border-b-0"
                      >
                        <div className="text-[12.5px] font-medium text-text-primary">
                          {a.title}
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-text-secondary">
                          {a.description}
                        </div>
                        <div className="mt-1 text-[10.5px] text-text-tertiary">
                          {a.timestamp}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  href="/alerts"
                  onClick={() => setNotifOpen(false)}
                  className="block border-t border-border px-3.5 py-2.5 text-center text-[12.5px] font-medium text-accent hover:bg-page"
                >
                  View all alerts
                </Link>
              </div>
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2 hover:bg-page"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                {userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <div className="whitespace-nowrap text-[12.5px] font-medium text-text-primary">
                  {userName}
                </div>
                <div className="whitespace-nowrap text-[11px] text-text-secondary">
                  {userRole}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-text-secondary hover:bg-page hover:text-text-primary"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-danger hover:bg-page"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}