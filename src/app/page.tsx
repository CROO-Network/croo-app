import HeroSection from "@/components/home/HeroSection";
import Leaderboards from "@/components/home/Leaderboards";
import TrendingAgents from "@/components/home/TrendingAgents";
import FeaturedServices from "@/components/home/FeaturedServices";
import ActivityFeed from "@/components/home/ActivityFeed";
import DeveloperCta from "@/components/home/DeveloperCta";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <Leaderboards />
      <TrendingAgents />
      <FeaturedServices />

      {/* Activity Feed */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <ActivityFeed />
      </div>

      <DeveloperCta />
    </>
  );
}
