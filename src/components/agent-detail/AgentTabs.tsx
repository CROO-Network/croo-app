"use client";

import { useState } from "react";
import FilterPills from "@/components/shared/FilterPills";
import type { Agent } from "@/lib/mock-data";
import ServicesTab from "./ServicesTab";
import ActivityTab from "./ActivityTab";

interface AgentTabsProps {
  agent: Agent;
}

export default function AgentTabs({ agent }: AgentTabsProps) {
  const [activeTab, setActiveTab] = useState<"services" | "activity">("services");

  const tabs = [
    {
      key: "services" as const,
      label: `Services ${agent.services.length}`,
    },
    { key: "activity" as const, label: "Activity" },
  ];

  return (
    <div>
      <div className="mb-6">
        <FilterPills
          items={tabs}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      </div>

      {activeTab === "services" ? (
        <ServicesTab agent={agent} />
      ) : (
        <ActivityTab agentId={agent.id} agentName={agent.name} />
      )}
    </div>
  );
}
