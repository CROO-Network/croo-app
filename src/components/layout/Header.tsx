"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import iconPng from "@/app/icon.png";
import { Menu, LogOut, User, Bot, ClipboardList, Copy, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConnectModal } from "@/components/auth/ConnectModal";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import { ChainSwitcher, ChainSwitcherInline } from "@/components/layout/ChainSwitcher";
import { RegisterAgentButton } from "@/components/shared/RegisterAgentButton";
import TopUpModal from "@/components/shared/TopUpModal";
import { useToast } from "@/components/shared/Toast";
import { useAuth } from "@/lib/auth";
import { useChain } from "@/lib/chain-context";
import { loggedInUserAvatarSrc } from "@/lib/avatar-display";
import { useIdentity } from "@/lib/identity-context";
import { truncateAddress, formatUsdc } from "@/lib/formatters";
import { useBalance } from "@/hooks/useBalance";
import { getMyNavigatorInfo } from "@/lib/api/agent";

type StoreNavLink = {
  label: string;
  href: string;
  disabled?: boolean;
  tooltip?: string;
  badge?: string;
  interactiveOnly?: boolean;
};

const storeNavLinks: StoreNavLink[] = [
  { label: "Store", href: "/" },
  {
    label: "My First Agent",
    href: "/myfirstagent",
    badge: "Campaign",
    interactiveOnly: true,
  },
];

// Small copy button for wallet address
function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    showToast("Address copied");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="ml-1 text-[#9A9A9A] hover:text-[#0F0F0F] transition-colors shrink-0"
      title="Copy address"
    >
      {copied ? (
        <Check className="h-3 w-3 text-[#6EE646]" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

export function Header() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const { status, session, logout } = useAuth();
  const { openGate } = useIdentity();
  const { isInteractive } = useChain();
  const isLoggedIn = status === "authenticated" && !!session;
  const walletAddress = session?.userInfo.walletAddr ?? "";

  // Navigator AA wallet for Top Up. Share react-query cache with NavigatorFAB.tsx
  // by reusing queryKey ["me", "navigator", userId]. The Top Up modal MUST
  // receive the Navigator AA address — never fall back to the owner EOA, which
  // would strand funds (see NavigatorFAB.tsx for the same fix).
  const navigatorWalletQuery = useQuery({
    queryKey: ["me", "navigator", session?.userId ?? null],
    queryFn: () => getMyNavigatorInfo(),
    enabled: isLoggedIn && isInteractive,
    staleTime: 60_000,
  });
  const { refetch: refetchNavigatorWallet } = navigatorWalletQuery;
  const navigatorWalletAddress =
    navigatorWalletQuery.data?.navigator?.walletAddress?.trim() ?? "";

  // Live Navigator wallet balance for the dropdown. Event-driven (no polling).
  const { balanceUsdc, escrowUsdc, refetch: refetchBalance } = useBalance();
  const numericBalance =
    balanceUsdc != null && balanceUsdc !== "" ? Number(balanceUsdc) : NaN;
  const numericEscrow =
    escrowUsdc != null && escrowUsdc !== "" ? Number(escrowUsdc) : NaN;
  const hasBalance = Number.isFinite(numericBalance);
  const hasEscrow = Number.isFinite(numericEscrow) && numericEscrow > 0;
  const displayBalance = hasBalance ? `$${formatUsdc(numericBalance)}` : "$—";
  const displayEscrow = hasEscrow ? `$${formatUsdc(numericEscrow)}` : null;
  const isNavigatorWalletReady = navigatorWalletAddress.length > 0;
  const menuWalletAddress = isInteractive
    ? (isNavigatorWalletReady ? navigatorWalletAddress : walletAddress)
    : walletAddress;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDropdownOpenChange = useCallback(
    (nextOpen: boolean) => {
      setDropdownOpen(nextOpen);
      if (!nextOpen || !isLoggedIn) return;
      void refetchNavigatorWallet();
      void refetchBalance();
    },
    [isLoggedIn, refetchBalance, refetchNavigatorWallet],
  );

  const pathname = usePathname();

  const handleLogout = () => {
    const shouldReturnHome = pathname === "/account" || pathname.startsWith("/account/");
    logout();
    if (shouldReturnHome) {
      router.replace("/");
    }
  };

  if (pathname === "/mcp") {
    return null;
  }

  const isCampaignPage =
    pathname === "/myfirstagent" || pathname.startsWith("/myfirstagent/");
  const isStorePage = !pathname.startsWith("/account") && !isCampaignPage;
  const navLinks = storeNavLinks
    .filter((link) => isInteractive || !link.interactiveOnly)
    .map((link) => ({
      ...link,
      active:
        link.href === "/"
          ? isStorePage
          : pathname === link.href || pathname.startsWith(`${link.href}/`),
    }));
  const identityLabel = session?.loginMethod === "wallet" ? "Connected Wallet" : "Account";
  const identityValue =
    session?.loginMethod === "wallet"
      ? walletAddress || session.identifier
      : session?.userInfo.googleName || session?.identifier || session?.userId || "";
  const avatarUrl = loggedInUserAvatarSrc({
    avatar: session?.userInfo.avatar,
    googlePicture: session?.userInfo.googlePicture,
    isGoogleLogin: session?.loginMethod === "google",
    userId: session?.userId ?? "guest",
  });

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          isScrolled
            ? "bg-white/90 backdrop-blur-md border-b border-[#E2E2E0] shadow-sm"
            : "bg-transparent"
        }`}
      >
        <AnnouncementBar />

        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Logo + protocol entry */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={iconPng} alt="CROO" width={40} height={40} className="rounded-lg" />
            <span className="text-[#9A9A9A] text-xs font-mono uppercase tracking-widest">/ Store</span>
          </Link>
          <button
            type="button"
            onClick={openGate}
            title="A2A — choose identity"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#6EE646]/40 bg-[#F0F9EB] hover:bg-[#E5F5DD] px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-[#3D8C1F] transition-colors cursor-pointer"
          >
            <Bot className="h-3 w-3" />
            Agent View
          </button>
        </div>

        {/* Center: Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <div key={link.label} className="relative group">
              <Link
                href={link.href}
                className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150 ${
                  link.active
                    ? "text-[#0F0F0F] font-semibold"
                    : link.disabled
                    ? "text-[#9A9A9A] cursor-not-allowed"
                    : "text-[#6B6B6B] hover:text-[#0F0F0F]"
                }`}
                onClick={link.disabled ? (e) => e.preventDefault() : undefined}
              >
                {link.label}
                {link.badge && (
                  <span className="rounded-full border border-[#6EE646]/40 bg-[#F0FDE8] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#3D8C1F]">
                    {link.badge}
                  </span>
                )}
              </Link>
              {link.active && (
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#6EE646] rounded-full" />
              )}
              {link.disabled && link.tooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-[#0F0F0F] text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {link.tooltip}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right: Chain switcher + Register Agent + Auth */}
        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <div className="hidden md:block">
              <ChainSwitcher />
            </div>
          )}
          <RegisterAgentButton className="hidden md:inline-flex px-4 py-2 text-sm text-[#0F0F0F] bg-[#6EE646] hover:bg-[#5DD835] rounded-full transition-colors duration-150" />

          {/* Desktop Auth */}
          <div className="hidden md:block">
            {isLoggedIn ? (
              <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
                <DropdownMenuTrigger
                  openOnHover
                  delay={0}
                  closeDelay={250}
                  render={
                    <button
                      className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-[#E2E2E0]/50 transition-colors cursor-pointer"
                    />
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-8 w-8 rounded-full border border-[#E2E2E0] bg-[#F5F5F3]"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {/* Wallet: Base keeps balance + Top Up; BNB is address only */}
                  <div className="px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] text-[#9A9A9A] uppercase tracking-wider font-medium">
                        Wallet
                      </p>
                      {isInteractive && (
                        <p className="text-sm font-mono tabular-nums font-semibold text-[#0F0F0F]">
                          {displayBalance}
                        </p>
                      )}
                    </div>
                    {isInteractive && displayEscrow && (
                      <p className="mt-1 text-right text-[11px] text-[#9A9A9A] font-mono tabular-nums">
                        {displayEscrow} in escrow
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1 min-w-0">
                        <p className="text-xs font-mono text-[#0F0F0F] truncate">
                          {menuWalletAddress
                            ? truncateAddress(menuWalletAddress)
                            : identityValue}
                        </p>
                        {menuWalletAddress ? (
                          <CopyAddress address={menuWalletAddress} />
                        ) : null}
                      </div>
                      {isInteractive &&
                        (isNavigatorWalletReady ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTopUpOpen(true);
                              setDropdownOpen(false);
                            }}
                            className="shrink-0 inline-flex items-center h-7 rounded-full bg-[#6EE646] px-3 text-[11px] font-medium text-[#0F0F0F] transition-colors hover:bg-[#5DD835] cursor-pointer"
                          >
                            Top Up
                          </button>
                        ) : (
                          <button
                            disabled
                            title="Navigator wallet is being prepared — try again in a moment"
                            className="shrink-0 inline-flex items-center h-7 rounded-full bg-[#E2E2E0] px-3 text-[11px] font-medium text-[#9A9A9A] cursor-not-allowed"
                          >
                            Top Up
                          </button>
                        ))}
                    </div>
                  </div>
                  <DropdownMenuSeparator />

                  {isInteractive && (
                    <>
                      <DropdownMenuLinkItem
                        href="/account"
                        className="gap-2 focus:bg-[#6EE646]/10 focus:text-[#0F0F0F]"
                      >
                        <User className="h-4 w-4" />
                        Account
                      </DropdownMenuLinkItem>
                      <DropdownMenuLinkItem
                        href="/account/agents"
                        className="gap-2 focus:bg-[#6EE646]/10 focus:text-[#0F0F0F]"
                      >
                        <Bot className="h-4 w-4" />
                        My Agents
                      </DropdownMenuLinkItem>
                      <DropdownMenuLinkItem
                        href="/account/orders"
                        className="gap-2 focus:bg-[#6EE646]/10 focus:text-[#0F0F0F]"
                      >
                        <ClipboardList className="h-4 w-4" />
                        My Orders
                      </DropdownMenuLinkItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="gap-2 text-red-600 focus:bg-red-50 focus:text-red-600"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <ConnectModal />
            )}
          </div>
          {isLoggedIn && isInteractive && isNavigatorWalletReady && (
            <TopUpModal
              open={topUpOpen}
              onOpenChange={setTopUpOpen}
              walletLabel="Wallet"
              walletAddress={navigatorWalletAddress}
            />
          )}
          {/* Mobile: Hamburger */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <button
                    aria-label="Open menu"
                    className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#E2E2E0]/50 transition-colors cursor-pointer"
                  />
                }
              >
                <Menu className="h-5 w-5 text-[#0F0F0F]" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-white">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2.5">
                    <Image
                      src={iconPng}
                      alt="CROO"
                      width={28}
                      height={28}
                      className="rounded-lg"
                    />
                    <span className="text-[#9A9A9A] text-xs font-mono uppercase tracking-widest">
                      / Store
                    </span>
                  </SheetTitle>
                </SheetHeader>
                {isLoggedIn && (
                  <div className="mt-6 mx-4">
                    <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-[#9A9A9A]">
                      Chain
                    </p>
                    <ChainSwitcherInline onSelect={() => setMobileOpen(false)} />
                  </div>
                )}

                <nav className={`${isLoggedIn ? "mt-4" : "mt-8"} flex flex-col gap-1`}>
                  {navLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium transition-colors ${
                        link.active
                          ? "bg-[#6EE646]/10 text-[#0F0F0F] border-l-2 border-[#6EE646]"
                          : link.disabled
                          ? "text-[#9A9A9A] cursor-not-allowed"
                          : "text-[#6B6B6B] hover:bg-[#E2E2E0]/50"
                      }`}
                      onClick={(e) => {
                        if (link.disabled) e.preventDefault();
                        else setMobileOpen(false);
                      }}
                    >
                      <span>{link.label}</span>
                      {link.badge && (
                        <span className="rounded-full border border-[#6EE646]/40 bg-[#F0FDE8] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#3D8C1F]">
                          {link.badge}
                        </span>
                      )}
                      {link.disabled && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-[#9A9A9A]">
                          Soon
                        </span>
                      )}
                    </Link>
                  ))}
                </nav>

                {isLoggedIn && (
                  <>
                    {/* Account identity */}
                    <div className="mt-4 mx-4 px-4 py-3 rounded-xl bg-[#F5F5F3]">
                      <span className="text-[10px] uppercase tracking-wider text-[#9A9A9A] font-medium">
                        {isInteractive ? identityLabel : "Wallet"}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs font-mono text-[#0F0F0F]">
                          {walletAddress ? truncateAddress(walletAddress) : identityValue}
                        </span>
                        {walletAddress && <CopyAddress address={walletAddress} />}
                      </div>
                    </div>
                    {isInteractive && (
                      <div className="mt-2 mx-4 p-4 rounded-2xl bg-[#F5F5F3]">
                        <span className="text-[10px] uppercase tracking-wider text-[#9A9A9A] font-medium">
                          Balance
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-lg font-semibold text-[#0F0F0F] font-mono tabular-nums">
                            {displayBalance}
                          </span>
                          {isNavigatorWalletReady ? (
                            <button
                              type="button"
                              onClick={() => {
                                setTopUpOpen(true);
                                setMobileOpen(false);
                              }}
                              className="h-7 rounded-full bg-[#6EE646] px-3 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#5DD835] cursor-pointer"
                            >
                              Top Up
                            </button>
                          ) : (
                            <button
                              disabled
                              title="Navigator wallet is being prepared — try again in a moment"
                              className="h-7 rounded-full bg-[#E2E2E0] px-3 text-xs font-medium text-[#9A9A9A] cursor-not-allowed"
                            >
                              Top Up
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!isInteractive && (
                  <div className="mt-4 mx-4">
                    <RegisterAgentButton className="w-full justify-center rounded-full bg-[#6EE646] px-4 py-2.5 text-sm font-medium text-[#0F0F0F] hover:bg-[#5DD835]" />
                  </div>
                )}

                <div className="mt-6 mx-4">
                  {isLoggedIn ? (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-red-600 border-red-200 rounded-full"
                      onClick={() => {
                        handleLogout();
                        setMobileOpen(false);
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Disconnect
                    </Button>
                  ) : (
                    <ConnectModal />
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        </div>
      </header>

      <div className="h-10" aria-hidden />
    </>
  );
}
