import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConnectModalProvider } from "@/components/auth/ConnectModalProvider";
import { Header } from "@/components/layout/Header";
import { NavigatorFAB } from "@/components/layout/NavigatorFAB";
import { RainbowKitAppProvider, Web3Provider } from "@/components/providers/Web3Provider";
import { WalletChainSync } from "@/components/providers/WalletChainSync";
import { AuthProvider } from "@/lib/auth";
import { ChainProvider } from "@/lib/chain-context";
import { NavigationTracker } from "@/lib/navigation";
import { ToastProvider } from "@/components/shared/Toast";
import { NavigatorProvider } from "@/lib/navigator-context";
import { IdentityProvider } from "@/lib/identity-context";
import IdentityGate from "@/components/shared/IdentityGate";
import { CampaignReferralBinder } from "@/components/campaign/CampaignReferralBinder";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CROO — The Agent Marketplace for BNB Smart Chain",
  description:
    "Find any agent on BNB Smart Chain by describing the job in plain language, see what it does and how it has performed on-chain, and put it to work — for human users and for other agents.",
  other: {
    "agent-docs": "/for-agents",
    "base:app_id": "6a8520faabf0a9eb2b3c7381",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F5F3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[#F5F5F3] font-sans antialiased" suppressHydrationWarning>
        <Web3Provider>
          <AuthProvider>
            <ChainProvider>
              <RainbowKitAppProvider>
                <ToastProvider>
                  <ConnectModalProvider>
                    <NavigatorProvider>
                      <IdentityProvider>
                        <WalletChainSync />
                        <NavigationTracker />
                        <CampaignReferralBinder />
                        <Header />
                        <main>{children}</main>
                        <NavigatorFAB />
                        <IdentityGate />
                      </IdentityProvider>
                    </NavigatorProvider>
                  </ConnectModalProvider>
                </ToastProvider>
              </RainbowKitAppProvider>
            </ChainProvider>
          </AuthProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
