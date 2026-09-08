"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectModal } from "@/components/auth/ConnectModal";
import BaseModeOnly from "@/components/shared/BaseModeOnly";
import { useAuth } from "@/lib/auth";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    label: "Account",
    href: "/account",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="2.75" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M3 13.25c0-2.21 2.24-4 5-4s5 1.79 5 4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "My Agents",
    href: "/account/agents",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3.25" y="3.25" width="9.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="6" cy="6" r="1" fill="currentColor" />
        <circle cx="10" cy="6" r="1" fill="currentColor" />
        <path d="M5.5 12.75h5M8 9.75v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "My Orders",
    href: "/account/orders",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M4.25 2.75h7.5a1 1 0 011 1v8.5a1 1 0 01-1 1h-7.5a1 1 0 01-1-1v-8.5a1 1 0 011-1z"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M5.5 5.5h5m-5 2.5h5m-5 2.5h3"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/account") {
    return pathname === "/account";
  }

  if (href === "/account/agents") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-[#F5F5F3] text-[#0F0F0F] font-medium"
          : "text-[#9A9A9A] hover:bg-[#FAFAF9] hover:text-[#0F0F0F]"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#6EE646]" />
      )}
      <span className="shrink-0">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <BaseModeOnly title="Personal Center is not available here yet">
      <AccountLayoutInner>{children}</AccountLayoutInner>
    </BaseModeOnly>
  );
}

function AccountLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, session } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#F5F5F3]">
        <div className="mx-auto max-w-3xl px-6 pb-16 pt-24">
          <div className="rounded-2xl border border-[#E2E2E0] bg-white p-8 text-sm text-[#6B6B6B]">
            Restoring your session...
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#F5F5F3]">
        <div className="mx-auto max-w-3xl px-6 pb-16 pt-24">
          <div className="rounded-2xl border border-[#E2E2E0] bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6EE646]/15">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2.5a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z" stroke="#0F0F0F" strokeWidth="1.4" />
                <path d="M3.75 17.5c0-2.76 2.8-5 6.25-5s6.25 2.24 6.25 5" stroke="#0F0F0F" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-[#0F0F0F]">Connect to access your account</h1>
            <p className="mt-2 text-sm text-[#6B6B6B]">
              Sign in with Google or a Web3 wallet before opening your account pages.
            </p>
            <div className="mt-6 flex justify-center">
              <ConnectModal />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-16 pt-24 lg:flex-row lg:gap-8">
        <aside className="w-full shrink-0 lg:w-52">
          <div className="lg:sticky lg:top-24">
            <div className="mb-3 flex items-center gap-3 px-1">
              <span className="h-px w-5 bg-[#6EE646]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A]">
                Personal Center
              </span>
            </div>

            <nav className="rounded-2xl border border-[#E2E2E0] bg-white p-2">
              <div className="space-y-1">
                {navItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
