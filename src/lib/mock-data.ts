export interface Agent {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "offline" | "paused";
  wallet: string;
  joinedAt: string;
  description: string;
  tags: string[];
  stats: {
    totalOrders: number;
    totalVolume: number;
    completionRate: number;
    avgDeliveryTime: string;
  };
  services: Service[];
  lowestPrice: number;
  chain?: "base" | "bsc";
  chains?: string[];
  linkedAgentId?: string;
  externalUrl?: string;
  score?: number;
  feedbackCount?: number;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  sla: string;
  orders7d?: number;
  requirementType?: "text" | "schema";
  deliverableType: "text" | "schema";
  requirements: string | Record<string, string>;
  deliverable: string | Record<string, string>;
  requirementsSchema?: SchemaField[];
  deliverableSchema?: SchemaField[];
}

export interface ActivityEvent {
  id: string;
  type: "order_completed" | "agent_joined" | "order_locked" | "order_expired" | "x402_paid";
  agentName: string;
  agentId: string;
  agentAvatar?: string;
  serviceName?: string;
  orderId?: string;
  amount?: number;
  timestamp: string;
  relativeTime: string;
  timeline?: OrderEvent[];
  /** Outcome status shown as a badge on the feed row */
  orderStatus?: "success" | "failed" | "not_passed";
  /** Human-readable task completion duration (e.g. "15min", "2hr 5min") */
  duration?: string;
  /** BSC x402 payment hash, when present */
  payTxHash?: string;
}

export interface Order {
  id: string;
  agentName: string;
  agentId: string;
  serviceName: string;
  amount: number;
  status: "completed" | "in_progress" | "deliver_failed" | "expired" | "lock_failed" | "paid" | "feedback";
  payTxHash?: string;
  buyerWallet: string;
  timeline: OrderEvent[];
  createdAt: string;
  relativeTime: string;
}

export interface OrderEvent {
  phase: "lock" | "deliver" | "clear" | "expired" | "deliver_failed";
  timestamp: string;
  detail: string;
  txHash?: string;
}

const avatarUrls = [
  "https://api.dicebear.com/9.x/bottts/svg?seed=DataPulse&backgroundColor=b6e3f4",
  "https://api.dicebear.com/9.x/bottts/svg?seed=WhaleTracker&backgroundColor=d1d4f9",
  "https://api.dicebear.com/9.x/bottts/svg?seed=ContentForge&backgroundColor=ffd5dc",
  "https://api.dicebear.com/9.x/bottts/svg?seed=BridgeBot&backgroundColor=c0aede",
  "https://api.dicebear.com/9.x/bottts/svg?seed=AuditGuard&backgroundColor=b6f4d0",
  "https://api.dicebear.com/9.x/bottts/svg?seed=YieldHunter&backgroundColor=fff3b0",
  "https://api.dicebear.com/9.x/bottts/svg?seed=SocialSentinel&backgroundColor=ffceb4",
  "https://api.dicebear.com/9.x/bottts/svg?seed=CodeReviewer&backgroundColor=b4f0ff",
  "https://api.dicebear.com/9.x/bottts/svg?seed=NFTValuator&backgroundColor=f4b6c2",
  "https://api.dicebear.com/9.x/bottts/svg?seed=GasOptimizer&backgroundColor=d4f4b6",
  "https://api.dicebear.com/9.x/bottts/svg?seed=AlphaSignal&backgroundColor=d9b6f4",
  "https://api.dicebear.com/9.x/bottts/svg?seed=ChainGuard&backgroundColor=b6d9f4",
];

export const mockAgents: Agent[] = [
  {
    id: "agent-001",
    name: "DataPulse",
    avatar: avatarUrls[0],
    status: "online",
    wallet: "0x1a2b3c4d5e6f7890abcdef1234567890abcd1234",
    joinedAt: "2026-01-15",
    description: "Real-time DeFi analytics agent specializing in whale tracking, liquidity pool analysis, and market sentiment aggregation across major L2 chains.",
    tags: ["DeFi & Trading", "Data & Analytics", "Research & Report"],
    stats: { totalOrders: 2847, totalVolume: 142350, completionRate: 98.7, avgDeliveryTime: "< 15min" },
    services: [
      {
        id: "off-001a",
        name: "Daily DeFi Whale Report",
        description: "Monitors and reports top 100 whale wallet movements across Ethereum, Base, and Arbitrum. Includes inflow/outflow analysis and trend signals.",
        price: 5.0,
        sla: "< 1h",
        deliverableType: "text",
        requirements: "Specify chains and minimum whale threshold (default: $1M+)",
        deliverable: "Comprehensive markdown report with wallet addresses, transaction links, and trend analysis",
      },
      {
        id: "off-001b",
        name: "On-demand Token Analysis",
        description: "Deep-dive analysis of any ERC-20 token including holder distribution, smart money movements, and liquidity metrics.",
        price: 2.5,
        sla: "< 30min",
        deliverableType: "schema",
        requirements: { token_address: "string", chain: "string (base|ethereum|arbitrum)", depth: "string (basic|detailed)" },
        deliverable: { token_name: "string", holder_count: "number", top_holders: "array", liquidity_score: "number", risk_level: "string", analysis: "string" },
      },
    ],
    lowestPrice: 2.5,
  },
  {
    id: "agent-002",
    name: "CodeReviewer",
    avatar: avatarUrls[1],
    status: "online",
    wallet: "0x2b3c4d5e6f7890abcdef1234567890abcd123456",
    joinedAt: "2026-02-03",
    description: "Automated smart contract auditor powered by formal verification. Analyzes Solidity code for vulnerabilities, gas optimization opportunities, and best practice violations.",
    tags: ["Development & Code", "Automation & Workflow"],
    stats: { totalOrders: 1523, totalVolume: 76150, completionRate: 99.2, avgDeliveryTime: "< 45min" },
    services: [
      {
        id: "off-002a",
        name: "Smart Contract Audit",
        description: "Full security audit of Solidity smart contracts with vulnerability classification (Critical/High/Medium/Low/Info).",
        price: 25.0,
        sla: "< 2h",
        deliverableType: "schema",
        requirements: { contract_source: "string (Solidity code or verified address)", compiler_version: "string" },
        deliverable: { vulnerabilities: "array", gas_optimizations: "array", overall_score: "number", recommendation: "string" },
      },
    ],
    lowestPrice: 25.0,
  },
  {
    id: "agent-003",
    name: "ContentForge",
    avatar: avatarUrls[2],
    status: "online",
    wallet: "0x3c4d5e6f7890abcdef1234567890abcd12345678",
    joinedAt: "2026-01-28",
    description: "Web3-native content creation agent. Generates blog posts, Twitter threads, and community announcements tailored for crypto audiences.",
    tags: ["Content & Creative", "Social & Community"],
    stats: { totalOrders: 3456, totalVolume: 34560, completionRate: 97.8, avgDeliveryTime: "< 20min" },
    services: [
      {
        id: "off-003a",
        name: "Twitter Thread Generator",
        description: "Creates engaging Twitter/X threads about any Web3 topic with relevant data points and hooks.",
        price: 1.0,
        sla: "< 10min",
        deliverableType: "text",
        requirements: "Topic, tone (professional/casual/degen), and key points to cover",
        deliverable: "Thread with 5-15 tweets, formatted and ready to post",
      },
      {
        id: "off-003b",
        name: "Blog Post Writer",
        description: "Long-form blog content (1500-3000 words) with SEO optimization for Web3 projects.",
        price: 8.0,
        sla: "< 2h",
        deliverableType: "text",
        requirements: "Topic, target audience, desired length, and any reference materials",
        deliverable: "Full blog post in markdown format with meta description and suggested images",
      },
    ],
    lowestPrice: 1.0,
  },
  {
    id: "agent-004",
    name: "WhaleTracker",
    avatar: avatarUrls[3],
    status: "online",
    wallet: "0x4d5e6f7890abcdef1234567890abcd1234567890",
    joinedAt: "2026-02-14",
    description: "Tracks and alerts on significant whale movements in real-time. Monitors wallets holding $10M+ across DeFi protocols.",
    tags: ["DeFi & Trading", "Data & Analytics"],
    stats: { totalOrders: 5621, totalVolume: 281050, completionRate: 99.5, avgDeliveryTime: "< 5min" },
    services: [
      {
        id: "off-004a",
        name: "Whale Alert Snapshot",
        description: "Instant snapshot of whale activity in the last 24h for specified tokens or protocols.",
        price: 0.5,
        sla: "< 5min",
        deliverableType: "schema",
        requirements: { tokens: "string[] (token symbols)", min_amount: "number (USD threshold)" },
        deliverable: { alerts: "array", total_volume: "number", top_movers: "array", trend: "string" },
      },
    ],
    lowestPrice: 0.5,
  },
  {
    id: "agent-005",
    name: "NFTValuator",
    avatar: avatarUrls[4],
    status: "offline",
    wallet: "0x5e6f7890abcdef1234567890abcd12345678abcd",
    joinedAt: "2026-03-01",
    description: "NFT collection valuation and rarity analysis agent. Uses machine learning to estimate fair market value based on traits, sales history, and market trends.",
    tags: ["Data & Analytics", "Research & Report"],
    stats: { totalOrders: 892, totalVolume: 44600, completionRate: 96.3, avgDeliveryTime: "< 1h" },
    services: [
      {
        id: "off-005a",
        name: "Collection Valuation Report",
        description: "Comprehensive valuation of any NFT collection including floor price prediction, rarity analysis, and market sentiment.",
        price: 15.0,
        sla: "< 3h",
        deliverableType: "schema",
        requirements: { collection_address: "string", chain: "string" },
        deliverable: { floor_price: "number", predicted_floor_7d: "number", rarity_distribution: "object", market_sentiment: "string", recommendation: "string" },
      },
    ],
    lowestPrice: 15.0,
  },
  {
    id: "agent-006",
    name: "GasOptimizer",
    avatar: avatarUrls[5],
    status: "online",
    wallet: "0x6f7890abcdef1234567890abcd12345678abcdef",
    joinedAt: "2026-02-20",
    description: "Optimizes smart contract gas consumption through bytecode analysis and storage pattern recommendations. Typically achieves 15-40% gas reduction.",
    tags: ["Development & Code", "Automation & Workflow"],
    stats: { totalOrders: 678, totalVolume: 33900, completionRate: 98.1, avgDeliveryTime: "< 1h" },
    services: [
      {
        id: "off-006a",
        name: "Gas Optimization Report",
        description: "Analyzes contract bytecode and suggests optimizations with estimated gas savings per function.",
        price: 10.0,
        sla: "< 1h",
        deliverableType: "schema",
        requirements: { contract_address: "string", chain: "string" },
        deliverable: { current_gas_costs: "object", optimized_gas_costs: "object", savings_percentage: "number", recommendations: "array" },
      },
    ],
    lowestPrice: 10.0,
  },
  {
    id: "agent-007",
    name: "SocialSentinel",
    avatar: avatarUrls[6],
    status: "online",
    wallet: "0x7890abcdef1234567890abcd12345678abcdef01",
    joinedAt: "2026-01-10",
    description: "Monitors social media sentiment for crypto projects. Aggregates data from Twitter, Discord, Telegram, and Reddit to provide actionable intelligence.",
    tags: ["Social & Community", "Research & Report", "Data & Analytics"],
    stats: { totalOrders: 4210, totalVolume: 63150, completionRate: 97.5, avgDeliveryTime: "< 30min" },
    services: [
      {
        id: "off-007a",
        name: "Sentiment Analysis Report",
        description: "24-hour social sentiment analysis for any crypto project or token across major platforms.",
        price: 3.0,
        sla: "< 30min",
        deliverableType: "text",
        requirements: "Project name or token symbol, optional specific focus areas",
        deliverable: "Detailed report covering sentiment score, key influencer mentions, trending topics, and risk signals",
      },
    ],
    lowestPrice: 3.0,
  },
  {
    id: "agent-008",
    name: "YieldHunter",
    avatar: avatarUrls[7],
    status: "online",
    wallet: "0x890abcdef1234567890abcd12345678abcdef0123",
    joinedAt: "2026-02-08",
    description: "DeFi yield farming optimizer that scans protocols across multiple chains to find the best risk-adjusted returns for your portfolio size.",
    tags: ["DeFi & Trading", "Automation & Workflow"],
    stats: { totalOrders: 1876, totalVolume: 93800, completionRate: 99.0, avgDeliveryTime: "< 20min" },
    services: [
      {
        id: "off-008a",
        name: "Yield Strategy Report",
        description: "Personalized yield farming strategy based on your risk tolerance and portfolio size.",
        price: 5.0,
        sla: "< 30min",
        deliverableType: "text",
        requirements: "Portfolio size (USDC), risk tolerance (low/medium/high), preferred chains",
        deliverable: "Strategy report with specific pool recommendations, expected APY, and risk analysis",
      },
    ],
    lowestPrice: 5.0,
  },
  {
    id: "agent-009",
    name: "DocuMint",
    avatar: avatarUrls[8],
    status: "online",
    wallet: "0x90abcdef1234567890abcd12345678abcdef01234",
    joinedAt: "2026-03-05",
    description: "Automated technical documentation generator for smart contracts and dApps. Produces clear, developer-friendly docs from code analysis.",
    tags: ["Development & Code", "Content & Creative"],
    stats: { totalOrders: 456, totalVolume: 13680, completionRate: 98.9, avgDeliveryTime: "< 45min" },
    services: [
      {
        id: "off-009a",
        name: "Smart Contract Documentation",
        description: "Auto-generates NatSpec-compliant documentation for Solidity contracts with function descriptions, parameter explanations, and usage examples.",
        price: 8.0,
        sla: "< 1h",
        deliverableType: "text",
        requirements: "Contract source code or verified contract address",
        deliverable: "Complete documentation in markdown format with function signatures, descriptions, and examples",
      },
    ],
    lowestPrice: 8.0,
  },
  {
    id: "agent-010",
    name: "BridgeBot",
    avatar: avatarUrls[9],
    status: "online",
    wallet: "0xabcdef1234567890abcd12345678abcdef0123456",
    joinedAt: "2026-02-25",
    description: "Cross-chain bridge route optimizer. Finds the cheapest and fastest path to move assets between chains, considering gas costs, slippage, and bridge risks.",
    tags: ["DeFi & Trading", "Automation & Workflow"],
    stats: { totalOrders: 3210, totalVolume: 32100, completionRate: 99.3, avgDeliveryTime: "< 10min" },
    services: [
      {
        id: "off-010a",
        name: "Bridge Route Optimization",
        description: "Find the optimal route to bridge tokens between any two supported chains.",
        price: 0.5,
        sla: "< 5min",
        deliverableType: "schema",
        requirements: { from_chain: "string", to_chain: "string", token: "string", amount: "number" },
        deliverable: { routes: "array", recommended_route: "object", estimated_cost: "number", estimated_time: "string" },
      },
    ],
    lowestPrice: 0.5,
  },
  {
    id: "agent-011",
    name: "AuditGuard",
    avatar: avatarUrls[10],
    status: "online",
    wallet: "0xbcdef1234567890abcd12345678abcdef01234567",
    joinedAt: "2026-01-22",
    description: "Continuous smart contract monitoring agent. Watches deployed contracts for suspicious transactions, governance attacks, and fund movement anomalies.",
    tags: ["Development & Code", "Data & Analytics"],
    stats: { totalOrders: 1045, totalVolume: 104500, completionRate: 99.8, avgDeliveryTime: "< 10min" },
    services: [
      {
        id: "off-011a",
        name: "Contract Health Check",
        description: "Quick security assessment of any deployed smart contract including balance analysis and recent transaction patterns.",
        price: 3.0,
        sla: "< 15min",
        deliverableType: "schema",
        requirements: { contract_address: "string", chain: "string" },
        deliverable: { health_score: "number", risk_factors: "array", balance: "number", recent_anomalies: "array", recommendation: "string" },
      },
    ],
    lowestPrice: 3.0,
  },
  {
    id: "agent-012",
    name: "TrendSpotter",
    avatar: avatarUrls[11],
    status: "offline",
    wallet: "0xcdef1234567890abcd12345678abcdef012345678",
    joinedAt: "2026-03-10",
    description: "Identifies emerging trends in the crypto ecosystem by analyzing on-chain data, social signals, and developer activity across GitHub repositories.",
    tags: ["Research & Report", "Social & Community", "Data & Analytics"],
    stats: { totalOrders: 234, totalVolume: 7020, completionRate: 95.7, avgDeliveryTime: "< 2h" },
    services: [
      {
        id: "off-012a",
        name: "Weekly Trend Report",
        description: "Comprehensive weekly analysis of emerging trends including new protocols, developer activity spikes, and social momentum shifts.",
        price: 12.0,
        sla: "< 4h",
        deliverableType: "text",
        requirements: "Focus area (DeFi/NFT/Gaming/Infrastructure/All), preferred chains",
        deliverable: "Detailed trend report with supporting data, charts description, and opportunity assessment",
      },
    ],
    lowestPrice: 12.0,
  },
];

export const ecosystemStats = {
  totalAgents: 1247,
  totalOrders: 89432,
  totalVolume: 4523100,
};

export const mockActivity: ActivityEvent[] = [
  {
    id: "act-1",
    type: "order_completed",
    agentName: "DataPulse",
    agentId: "agent-001",
    agentAvatar: avatarUrls[0],
    serviceName: "Daily DeFi Whale Report",
    orderId: "#89432",
    amount: 5.0,
    timestamp: "2026-03-23T08:55:00Z",
    relativeTime: "2m ago",
    orderStatus: "success",
    duration: "15min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T08:40:00Z", detail: "Escrow locked 5.00 USDC", txHash: "0xa1b2c3d4e5f6...7890" },
      { phase: "deliver", timestamp: "2026-03-23T08:52:00Z", detail: "Result delivered (text)", txHash: "0xf1e2d3c4b5a6...1234" },
      { phase: "clear", timestamp: "2026-03-23T08:55:00Z", detail: "5.00 USDC released to provider", txHash: "0x9876abcdef01...5678" },
    ],
  },
  {
    id: "act-2",
    type: "order_completed",
    agentName: "WhaleTracker",
    agentId: "agent-004",
    agentAvatar: avatarUrls[3],
    serviceName: "Whale Alert Snapshot",
    orderId: "#89431",
    amount: 0.5,
    timestamp: "2026-03-23T08:50:00Z",
    relativeTime: "7m ago",
    orderStatus: "success",
    duration: "12min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T08:38:00Z", detail: "Escrow locked 0.50 USDC", txHash: "0xb2c3d4e5f6a1...2345" },
      { phase: "deliver", timestamp: "2026-03-23T08:47:00Z", detail: "Result delivered (schema)", txHash: "0xe2d3c4b5a6f1...6789" },
      { phase: "clear", timestamp: "2026-03-23T08:50:00Z", detail: "0.50 USDC released to provider", txHash: "0x8765bcdef012...3456" },
    ],
  },
  {
    id: "act-3",
    type: "agent_joined",
    agentName: "AlphaSignal",
    agentId: "agent-new-1",
    agentAvatar: avatarUrls[10],
    timestamp: "2026-03-23T08:42:00Z",
    relativeTime: "15m ago",
  },
  {
    id: "act-4",
    type: "order_completed",
    agentName: "ContentForge",
    agentId: "agent-003",
    agentAvatar: avatarUrls[2],
    serviceName: "Twitter Thread Generator",
    orderId: "#89430",
    amount: 1.0,
    timestamp: "2026-03-23T08:30:00Z",
    relativeTime: "27m ago",
    orderStatus: "failed",
    duration: "12min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T08:18:00Z", detail: "Escrow locked 1.00 USDC", txHash: "0xc3d4e5f6a1b2...4567" },
      { phase: "deliver", timestamp: "2026-03-23T08:27:00Z", detail: "Result delivered (text)", txHash: "0xd3c4b5a6f1e2...7890" },
      { phase: "deliver_failed", timestamp: "2026-03-23T08:30:00Z", detail: "Delivery verification failed — 1.00 USDC refunded", txHash: "0x7654cdef0123...8901" },
    ],
  },
  {
    id: "act-5",
    type: "order_completed",
    agentName: "BridgeBot",
    agentId: "agent-010",
    agentAvatar: avatarUrls[9],
    serviceName: "Bridge Route Optimization",
    orderId: "#89429",
    amount: 0.5,
    timestamp: "2026-03-23T08:15:00Z",
    relativeTime: "42m ago",
    orderStatus: "success",
    duration: "10min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T08:05:00Z", detail: "Escrow locked 0.50 USDC", txHash: "0xd4e5f6a1b2c3...5678" },
      { phase: "deliver", timestamp: "2026-03-23T08:12:00Z", detail: "Result delivered (schema)", txHash: "0xc4b5a6f1e2d3...8901" },
      { phase: "clear", timestamp: "2026-03-23T08:15:00Z", detail: "0.50 USDC released to provider", txHash: "0x6543def01234...9012" },
    ],
  },
  {
    id: "act-6",
    type: "order_completed",
    agentName: "YieldHunter",
    agentId: "agent-008",
    agentAvatar: avatarUrls[7],
    serviceName: "Yield Strategy Report",
    orderId: "#89428",
    amount: 5.0,
    timestamp: "2026-03-23T08:00:00Z",
    relativeTime: "57m ago",
    orderStatus: "success",
    duration: "25min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T07:35:00Z", detail: "Escrow locked 5.00 USDC", txHash: "0xe5f6a1b2c3d4...6789" },
      { phase: "deliver", timestamp: "2026-03-23T07:55:00Z", detail: "Result delivered (text)", txHash: "0xb5a6f1e2d3c4...9012" },
      { phase: "clear", timestamp: "2026-03-23T08:00:00Z", detail: "5.00 USDC released to provider", txHash: "0x5432ef012345...0123" },
    ],
  },
  {
    id: "act-7",
    type: "agent_joined",
    agentName: "ChainGuard",
    agentId: "agent-new-2",
    agentAvatar: avatarUrls[11],
    timestamp: "2026-03-23T07:45:00Z",
    relativeTime: "1h ago",
  },
  {
    id: "act-8",
    type: "order_completed",
    agentName: "SocialSentinel",
    agentId: "agent-007",
    agentAvatar: avatarUrls[6],
    serviceName: "Sentiment Analysis Report",
    orderId: "#89427",
    amount: 3.0,
    timestamp: "2026-03-23T07:30:00Z",
    relativeTime: "1h ago",
    orderStatus: "success",
    duration: "30min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T07:00:00Z", detail: "Escrow locked 3.00 USDC", txHash: "0xf6a1b2c3d4e5...7890" },
      { phase: "deliver", timestamp: "2026-03-23T07:25:00Z", detail: "Result delivered (text)", txHash: "0xa6f1e2d3c4b5...0123" },
      { phase: "clear", timestamp: "2026-03-23T07:30:00Z", detail: "3.00 USDC released to provider", txHash: "0x4321f0123456...1234" },
    ],
  },
  {
    id: "act-9",
    type: "order_completed",
    agentName: "CodeReviewer",
    agentId: "agent-002",
    agentAvatar: avatarUrls[1],
    serviceName: "Smart Contract Audit",
    orderId: "#89426",
    amount: 25.0,
    timestamp: "2026-03-23T07:15:00Z",
    relativeTime: "1h ago",
    orderStatus: "not_passed",
    duration: "2hr 5min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T05:10:00Z", detail: "Escrow locked 25.00 USDC", txHash: "0xa7b2c3d4e5f6...8901" },
      { phase: "deliver", timestamp: "2026-03-23T07:05:00Z", detail: "Result delivered (schema)", txHash: "0xf7e2d3c4b5a6...2345" },
      { phase: "deliver_failed", timestamp: "2026-03-23T07:15:00Z", detail: "Audit result did not meet buyer criteria — 25.00 USDC refunded", txHash: "0x3210a1234567...2345" },
    ],
  },
  {
    id: "act-10",
    type: "order_completed",
    agentName: "AuditGuard",
    agentId: "agent-011",
    agentAvatar: avatarUrls[10],
    serviceName: "Contract Health Check",
    orderId: "#89425",
    amount: 3.0,
    timestamp: "2026-03-23T07:00:00Z",
    relativeTime: "2h ago",
    orderStatus: "success",
    duration: "18min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T06:42:00Z", detail: "Escrow locked 3.00 USDC", txHash: "0xb8c3d4e5f6a1...9012" },
      { phase: "deliver", timestamp: "2026-03-23T06:55:00Z", detail: "Result delivered (schema)", txHash: "0xe8d3c4b5a6f1...3456" },
      { phase: "clear", timestamp: "2026-03-23T07:00:00Z", detail: "3.00 USDC released to provider", txHash: "0x2109b2345678...3456" },
    ],
  },
  {
    id: "act-11",
    type: "order_expired",
    agentName: "NFTValuator",
    agentId: "agent-005",
    agentAvatar: avatarUrls[4],
    serviceName: "Collection Valuation Report",
    orderId: "#89424",
    amount: 15.0,
    timestamp: "2026-03-23T06:30:00Z",
    relativeTime: "2h ago",
    orderStatus: "not_passed",
    duration: "3hr",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T03:30:00Z", detail: "Escrow locked 15.00 USDC", txHash: "0xc9d4e5f6a1b2...0123" },
      { phase: "expired", timestamp: "2026-03-23T06:30:00Z", detail: "Order expired — SLA exceeded, 15.00 USDC refunded", txHash: "0xd9e5f6a1b2c3...4567" },
    ],
  },
  {
    id: "act-12",
    type: "order_completed",
    agentName: "GasOptimizer",
    agentId: "agent-006",
    agentAvatar: avatarUrls[5],
    serviceName: "Gas Optimization Report",
    orderId: "#89423",
    amount: 10.0,
    timestamp: "2026-03-23T06:00:00Z",
    relativeTime: "3h ago",
    orderStatus: "success",
    duration: "1hr 10min",
    timeline: [
      { phase: "lock", timestamp: "2026-03-23T04:50:00Z", detail: "Escrow locked 10.00 USDC", txHash: "0xdae5f6a1b2c3...1234" },
      { phase: "deliver", timestamp: "2026-03-23T05:50:00Z", detail: "Result delivered (schema)", txHash: "0xeaf1e2d3c4b5...5678" },
      { phase: "clear", timestamp: "2026-03-23T06:00:00Z", detail: "10.00 USDC released to provider", txHash: "0x1098c3456789...4567" },
    ],
  },
];

export const mockOrders: Order[] = [
  {
    id: "#89432",
    agentName: "DataPulse",
    agentId: "agent-001",
    serviceName: "Daily DeFi Whale Report",
    amount: 5.0,
    status: "completed",
    buyerWallet: "0xa1b2c3d4e5f67890abcdef1234567890abcdef12",
    createdAt: "2026-03-23T08:40:00Z",
    relativeTime: "2h ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 23, 08:40", detail: "5.00 USDC escrowed", txHash: "0xa1b2c3d4e5f6...7890" },
      { phase: "deliver", timestamp: "Mar 23, 08:52", detail: "Result delivered" },
      { phase: "clear", timestamp: "Mar 23, 08:55", detail: "5.00 USDC settled to Provider", txHash: "0x9876abcdef01...5678" },
    ],
  },
  {
    id: "#89428",
    agentName: "DataPulse",
    agentId: "agent-001",
    serviceName: "On-demand Token Analysis",
    amount: 2.5,
    status: "in_progress",
    buyerWallet: "0xc3d4e5f67890abcdef1234567890abcdef123456",
    createdAt: "2026-03-23T07:35:00Z",
    relativeTime: "3h ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 23, 07:35", detail: "2.50 USDC escrowed", txHash: "0xe5f6a1b2c3d4...6789" },
    ],
  },
  {
    id: "#89420",
    agentName: "DataPulse",
    agentId: "agent-001",
    serviceName: "Daily DeFi Whale Report",
    amount: 5.0,
    status: "completed",
    buyerWallet: "0xd5e6f78901abcdef234567890abcdef1234567890",
    createdAt: "2026-03-22T14:20:00Z",
    relativeTime: "18h ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 22, 14:20", detail: "5.00 USDC escrowed", txHash: "0xf1a2b3c4d5e6...1234" },
      { phase: "deliver", timestamp: "Mar 22, 14:45", detail: "Result delivered" },
      { phase: "clear", timestamp: "Mar 22, 14:48", detail: "5.00 USDC settled to Provider", txHash: "0x2345bcde6789...5678" },
    ],
  },
  {
    id: "#89415",
    agentName: "DataPulse",
    agentId: "agent-001",
    serviceName: "On-demand Token Analysis",
    amount: 2.5,
    status: "completed",
    buyerWallet: "0xe6f789012abcdef34567890abcdef12345678abcd",
    createdAt: "2026-03-22T10:00:00Z",
    relativeTime: "22h ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 22, 10:00", detail: "2.50 USDC escrowed", txHash: "0xa3b4c5d6e7f8...2345" },
      { phase: "deliver", timestamp: "Mar 22, 10:18", detail: "Result delivered" },
      { phase: "clear", timestamp: "Mar 22, 10:20", detail: "2.50 USDC settled to Provider", txHash: "0x3456cdef7890...6789" },
    ],
  },
  {
    id: "#89408",
    agentName: "DataPulse",
    agentId: "agent-001",
    serviceName: "Daily DeFi Whale Report",
    amount: 5.0,
    status: "expired",
    buyerWallet: "0xf78901234abcdef567890abcdef12345678abcdef",
    createdAt: "2026-03-21T20:00:00Z",
    relativeTime: "1d ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 21, 20:00", detail: "5.00 USDC escrowed", txHash: "0xb4c5d6e7f8a9...3456" },
      { phase: "expired", timestamp: "Mar 22, 02:00", detail: "SLA timeout — 5.00 USDC refunded to Buyer", txHash: "0x4567def89012...7890" },
    ],
  },
  {
    id: "#89400",
    agentName: "DataPulse",
    agentId: "agent-001",
    serviceName: "On-demand Token Analysis",
    amount: 2.5,
    status: "completed",
    buyerWallet: "0x0189012345abcdef67890abcdef12345678abcdef",
    createdAt: "2026-03-21T15:30:00Z",
    relativeTime: "1d ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 21, 15:30", detail: "2.50 USDC escrowed", txHash: "0xc5d6e7f8a9b0...4567" },
      { phase: "deliver", timestamp: "Mar 21, 15:50", detail: "Result delivered" },
      { phase: "clear", timestamp: "Mar 21, 15:52", detail: "2.50 USDC settled to Provider", txHash: "0x5678ef901234...8901" },
    ],
  },
  {
    id: "#89390",
    agentName: "DataPulse",
    agentId: "agent-001",
    serviceName: "Daily DeFi Whale Report",
    amount: 5.0,
    status: "completed",
    buyerWallet: "0x23abcdef4567890abcdef1234567890abcdef1234",
    createdAt: "2026-03-21T08:00:00Z",
    relativeTime: "2d ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 21, 08:00", detail: "5.00 USDC escrowed", txHash: "0xd6e7f8a9b0c1...5678" },
      { phase: "deliver", timestamp: "Mar 21, 08:40", detail: "Result delivered" },
      { phase: "clear", timestamp: "Mar 21, 08:42", detail: "5.00 USDC settled to Provider", txHash: "0x6789f0123456...9012" },
    ],
  },
  {
    id: "#89426",
    agentName: "CodeReviewer",
    agentId: "agent-002",
    serviceName: "Smart Contract Audit",
    amount: 25.0,
    status: "completed",
    buyerWallet: "0xab12cd34ef5678901234567890abcdef12345678",
    createdAt: "2026-03-23T05:10:00Z",
    relativeTime: "5h ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 23, 05:10", detail: "25.00 USDC escrowed", txHash: "0xa7b2c3d4e5f6...8901" },
      { phase: "deliver", timestamp: "Mar 23, 07:05", detail: "Result delivered" },
      { phase: "clear", timestamp: "Mar 23, 07:15", detail: "25.00 USDC settled to Provider", txHash: "0x3210a1234567...2345" },
    ],
  },
  {
    id: "#89418",
    agentName: "CodeReviewer",
    agentId: "agent-002",
    serviceName: "Smart Contract Audit",
    amount: 25.0,
    status: "completed",
    buyerWallet: "0xcd34ef56789012345678abcdef1234567890abcd",
    createdAt: "2026-03-22T12:00:00Z",
    relativeTime: "20h ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 22, 12:00", detail: "25.00 USDC escrowed", txHash: "0xb8c9d0e1f2a3...9012" },
      { phase: "deliver", timestamp: "Mar 22, 13:30", detail: "Result delivered" },
      { phase: "clear", timestamp: "Mar 22, 13:35", detail: "25.00 USDC settled to Provider", txHash: "0xc9d0e1f2a3b4...0123" },
    ],
  },
  {
    id: "#89410",
    agentName: "CodeReviewer",
    agentId: "agent-002",
    serviceName: "Smart Contract Audit",
    amount: 25.0,
    status: "deliver_failed",
    buyerWallet: "0xef5678901234567890abcdef1234567890abcdef",
    createdAt: "2026-03-21T18:00:00Z",
    relativeTime: "1d ago",
    timeline: [
      { phase: "lock", timestamp: "Mar 21, 18:00", detail: "25.00 USDC escrowed", txHash: "0xd0e1f2a3b4c5...0123" },
      { phase: "deliver_failed", timestamp: "Mar 21, 19:30", detail: "Delivery verification failed — 25.00 USDC refunded", txHash: "0xe1f2a3b4c5d6...1234" },
    ],
  },
];

export const featuredServices = [
  { ...mockAgents[3].services[0], agentName: "WhaleTracker", agentId: "agent-004", agentAvatar: avatarUrls[3] },
  { ...mockAgents[0].services[0], agentName: "DataPulse", agentId: "agent-001", agentAvatar: avatarUrls[0] },
  { ...mockAgents[2].services[0], agentName: "ContentForge", agentId: "agent-003", agentAvatar: avatarUrls[2] },
  { ...mockAgents[9].services[0], agentName: "BridgeBot", agentId: "agent-010", agentAvatar: avatarUrls[9] },
  { ...mockAgents[6].services[0], agentName: "SocialSentinel", agentId: "agent-007", agentAvatar: avatarUrls[6] },
  { ...mockAgents[4].services[0], agentName: "AuditGuard", agentId: "agent-005", agentAvatar: avatarUrls[4] },
  { ...mockAgents[5].services[0], agentName: "YieldHunter", agentId: "agent-006", agentAvatar: avatarUrls[5] },
  { ...mockAgents[7].services[0], agentName: "CodeReviewer", agentId: "agent-008", agentAvatar: avatarUrls[7] },
  { ...mockAgents[1].services[0], agentName: "WhaleTracker", agentId: "agent-002", agentAvatar: avatarUrls[1] },
  { ...mockAgents[8].services[0], agentName: "NFTValuator", agentId: "agent-009", agentAvatar: avatarUrls[8] },
  { ...mockAgents[10].services[0], agentName: "AlphaSignal", agentId: "agent-011", agentAvatar: avatarUrls[10] },
  { ...mockAgents[11].services[0], agentName: "ChainGuard", agentId: "agent-012", agentAvatar: avatarUrls[11] },
];

export const categoryOptions = [
  "All",
  "Data & Analytics",
  "Content & Creative",
  "Development & Code",
  "DeFi & Trading",
  "Research & Report",
  "Social & Community",
  "Automation & Workflow",
];

export const priceRangeOptions = [
  { label: "All", min: 0, max: Infinity },
  { label: "< $1", min: 0, max: 1 },
  { label: "$1 - $10", min: 1, max: 10 },
  { label: "$10 - $100", min: 10, max: 100 },
  { label: "> $100", min: 100, max: Infinity },
];

export const statusOptions = ["All", "Online", "Offline"];

export const sortOptions = [
  { label: "Most Orders", value: "popular" },
  { label: "Highest Volume", value: "volume" },
  { label: "Newest", value: "newest" },
  { label: "Lowest Price", value: "price_asc" },
  { label: "Highest Completion Rate", value: "completion" },
];

export { formatVolume, formatNumber, truncateAddress } from "@/lib/formatters";

export interface UserProfile {
  id: string;
  loginMethod: "wallet" | "google" | "email";
  identifier: string;
  avatar: string;
  mainWallet: { address: string; balance: number; inEscrow: number };
  ownerWallet: { address: string; managedByCroo: boolean };
  joinedAt: string;
}

export interface MyAgent {
  id: string;
  name: string;
  /** Agent profile copy from API — list views may omit; configure uses for form */
  description?: string;
  avatar: string;
  status: "online" | "offline" | "draft";
  offline_reason?: "owner_paused" | "platform_banned";
  wallet: { address: string; balance: number };
  tags: string[];
  totalOrders: number;
  totalVolume: number;
  completionRate: number;
  avgDeliveryTime: string;
  totalEarned: number;
  source: string;
  joinedAt: string;
  services: MyAgentService[];
  apiKey?: string;
  lastHeartbeat?: string;
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  /** Optional human-readable description shown to buyers / Navigator users */
  description?: string;
  /** Sub-type for string fields: plain text / URL / wallet address — enables input-level validation */
  stringSubtype?: "plain" | "url" | "address";
  /** Element type for array fields — only primitive types allowed */
  itemType?: "string" | "number" | "boolean";
  /** Sub-fields for object types — max one level deep; sub-fields cannot themselves nest */
  fields?: SchemaField[];
}

export interface MyAgentService {
  id: string;
  name: string;
  description: string;
  price: number;
  requireFundTransfer?: boolean;
  priceModel?: "flat" | "percentage";
  feePercentage?: number;
  slaHours: number;
  slaMinutes: number;
  deliverableType: "text" | "schema";
  deliverableSchema?: SchemaField[];
  deliverableText?: string;
  requirementsType: "text" | "schema";
  requirementsSchema?: SchemaField[];
  /** Requirement prompt when type is `text` */
  requirementsText?: string;
}

export interface Transaction {
  id: string;
  type: "topup" | "withdraw" | "order_pay" | "earnings";
  direction: "in" | "out";
  amount: number;
  status: "completed" | "pending" | "failed";
  wallet: string;
  timestamp: string;
  txHash?: string;
  relatedOrderId?: string;
  relatedAgentName?: string;
}

export interface MyOrder {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  serviceName: string;
  price: number;
  gas: number;
  total: number;
  status:
    | "in_progress"
    | "completed"
    | "deliver_failed"
    | "expired"
    | "lock_failed";
  createdAt: string;
  relativeTime: string;
  timeline: OrderEvent[];
  requirements: Record<string, string>;
  /** Parsed or raw requirements from API for detail display. */
  requirementsDisplay?: unknown;
  deliverResult?: string;
  deliverableType?: "text" | "schema";
}

export const mockUser: UserProfile = {
  id: "user-1",
  loginMethod: "wallet",
  identifier: "0x1a2b3c4d5e6f7890abcdef1234567890abcd3c4d",
  avatar: "https://api.dicebear.com/9.x/identicon/svg?seed=user1",
  mainWallet: {
    address: "0xaaaa1111bbbb2222cccc3333dddd4444eeee5555",
    balance: 150.0,
    inEscrow: 23.5,
  },
  ownerWallet: {
    address: "0x1a2b3c4d5e6f7890abcdef1234567890abcd3c4d",
    managedByCroo: false,
  },
  joinedAt: "2026-01-15T10:00:00Z",
};

export const mockMyAgents: MyAgent[] = [
  {
    id: "agent-001",
    name: "WhaleTracker",
    avatar:
      "https://api.dicebear.com/9.x/bottts/svg?seed=WhaleTracker&backgroundColor=b6e3f4",
    status: "online",
    wallet: {
      address: "0xbbbb1111cccc2222dddd3333eeee4444ffff5555",
      balance: 12.5,
    },
    tags: ["DeFi & Trading", "Data & Analytics", "Research & Report"],
    totalOrders: 1234,
    totalVolume: 45600,
    completionRate: 98.5,
    avgDeliveryTime: "< 30min",
    totalEarned: 1234.0,
    source: "OpenClaw",
    joinedAt: "2026-02-15T10:00:00Z",
    services: [
      {
        id: "off-1",
        name: "Daily Whale Alert Report",
        description: "Comprehensive daily report of whale movements",
        price: 3.0,
        slaHours: 0,
        slaMinutes: 30,
        deliverableType: "text",
        requirementsType: "text",
      },
      {
        id: "off-2",
        name: "On-demand Token Analysis",
        description: "Real-time token analysis",
        price: 1.5,
        slaHours: 0,
        slaMinutes: 5,
        deliverableType: "schema",
        deliverableSchema: [
          { name: "token_symbol", type: "string", required: true },
          { name: "price_usd", type: "number", required: true },
          { name: "volume_24h", type: "number", required: true },
          { name: "sentiment_score", type: "number", required: false },
        ],
        requirementsType: "schema",
        requirementsSchema: [
          { name: "token_address", type: "string", required: true },
          { name: "chain", type: "string", required: true },
        ],
      },
    ],
    apiKey: "croo_sk_****a1b2",
  },
  {
    id: "agent-002",
    name: "DataPulse",
    avatar:
      "https://api.dicebear.com/9.x/bottts/svg?seed=DataPulse&backgroundColor=c0aede",
    status: "offline",
    offline_reason: "owner_paused",
    wallet: {
      address: "0xdddd1111eeee2222ffff3333aaaa4444bbbb5555",
      balance: 3.0,
    },
    tags: ["Data & Analytics", "Automation & Workflow"],
    totalOrders: 567,
    totalVolume: 12300,
    completionRate: 95.2,
    avgDeliveryTime: "< 10min",
    totalEarned: 567.0,
    source: "Hermes",
    joinedAt: "2026-03-01T10:00:00Z",
    services: [
      {
        id: "off-3",
        name: "Market Sentiment Score",
        description: "AI-powered market sentiment analysis",
        price: 2.0,
        slaHours: 0,
        slaMinutes: 10,
        deliverableType: "schema",
        deliverableSchema: [
          { name: "sentiment", type: "string", required: true },
          { name: "score", type: "number", required: true },
          { name: "signals", type: "array", required: false },
        ],
        requirementsType: "text",
      },
    ],
    apiKey: "croo_sk_****8f3a",
    lastHeartbeat: "2 min ago",
  },
  {
    id: "agent-003",
    name: "CodeReviewer",
    avatar:
      "https://api.dicebear.com/9.x/bottts/svg?seed=CodeReviewer&backgroundColor=d1d4f9",
    status: "online",
    wallet: {
      address: "0xffff1111aaaa2222bbbb3333cccc4444dddd5555",
      balance: 70.0,
    },
    tags: ["Development & Code", "Data & Analytics"],
    totalOrders: 890,
    totalVolume: 89000,
    completionRate: 99.1,
    avgDeliveryTime: "< 2hr",
    totalEarned: 8900.0,
    source: "SDK",
    joinedAt: "2026-01-20T10:00:00Z",
    services: [
      {
        id: "off-4",
        name: "Code Review Service",
        description: "Automated code review with security analysis",
        price: 10.0,
        slaHours: 2,
        slaMinutes: 0,
        deliverableType: "text",
        requirementsType: "text",
      },
      {
        id: "off-5",
        name: "Gas Optimization Report",
        description: "Gas optimization for Solidity contracts",
        price: 15.0,
        slaHours: 4,
        slaMinutes: 0,
        deliverableType: "text",
        requirementsType: "text",
      },
    ],
    apiKey: "croo_sk_****2b7c",
    lastHeartbeat: "30 sec ago",
  },
  {
    id: "agent-new",
    name: "AlphaBot",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=AlphaBot&backgroundColor=ffdfbf",
    status: "draft",
    wallet: { address: "0xnew0000aaaa1111bbbb2222cccc3333dddd4444", balance: 0 },
    tags: [],
    totalOrders: 0,
    totalVolume: 0,
    completionRate: 0,
    avgDeliveryTime: "—",
    totalEarned: 0,
    source: "sdk",
    joinedAt: new Date().toISOString(),
    services: [],
    apiKey: "croo_sk_****vtxy",
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    type: "topup",
    direction: "in",
    amount: 100.0,
    status: "completed",
    wallet: "Main Wallet",
    timestamp: "Mar 21, 14:00",
    txHash: "0xabc123def456",
  },
  {
    id: "tx-2",
    type: "order_pay",
    direction: "out",
    amount: 5.0,
    status: "completed",
    wallet: "Main Wallet",
    timestamp: "Mar 21, 13:30",
    relatedOrderId: "#45891",
  },
  {
    id: "tx-3",
    type: "earnings",
    direction: "in",
    amount: 3.0,
    status: "completed",
    wallet: "WhaleTracker",
    timestamp: "Mar 21, 12:00",
    relatedAgentName: "WhaleTracker",
    txHash: "0x789abc",
  },
  {
    id: "tx-4",
    type: "withdraw",
    direction: "out",
    amount: 50.0,
    status: "completed",
    wallet: "Main Wallet",
    timestamp: "Mar 20, 18:00",
    txHash: "0xdef789",
  },
  {
    id: "tx-5",
    type: "topup",
    direction: "in",
    amount: 200.0,
    status: "completed",
    wallet: "Main Wallet",
    timestamp: "Mar 20, 10:00",
    txHash: "0x111222",
  },
  {
    id: "tx-6",
    type: "earnings",
    direction: "in",
    amount: 10.0,
    status: "completed",
    wallet: "CodeReviewer",
    timestamp: "Mar 19, 16:00",
    relatedAgentName: "CodeReviewer",
    txHash: "0x333444",
  },
  {
    id: "tx-7",
    type: "order_pay",
    direction: "out",
    amount: 3.01,
    status: "completed",
    wallet: "Main Wallet",
    timestamp: "Mar 19, 14:33",
    relatedOrderId: "#45880",
  },
  {
    id: "tx-8",
    type: "withdraw",
    direction: "out",
    amount: 25.0,
    status: "pending",
    wallet: "WhaleTracker",
    timestamp: "Mar 19, 12:00",
    txHash: "0x555666",
  },
  {
    id: "tx-9",
    type: "topup",
    direction: "in",
    amount: 50.0,
    status: "completed",
    wallet: "DataPulse",
    timestamp: "Mar 18, 09:00",
    txHash: "0x777888",
  },
  {
    id: "tx-10",
    type: "order_pay",
    direction: "out",
    amount: 15.01,
    status: "failed",
    wallet: "Main Wallet",
    timestamp: "Mar 17, 11:00",
    relatedOrderId: "#0x5d19f6b3",
  },
];

export const mockMyOrders: MyOrder[] = [
  {
    id: "#0xa3f8c91d",
    agentId: "agent-001",
    agentName: "WhaleTracker",
    agentAvatar:
      "https://api.dicebear.com/9.x/bottts/svg?seed=WhaleTracker&backgroundColor=b6e3f4",
    serviceName: "Daily Whale Alert Report",
    price: 3.0,
    gas: 0.01,
    total: 3.01,
    status: "in_progress",
    createdAt: "2026-03-21T14:33:00Z",
    relativeTime: "2h ago",
    timeline: [
      {
        phase: "lock",
        timestamp: "14:33",
        detail: "$3.01 locked from Main Wallet",
        txHash: "0xabc123",
      },
    ],
    requirements: { wallet_address: "0x1a2b...3c4d", threshold_usdc: "100000" },
  },
  {
    id: "#0x7b2e04af",
    agentId: "agent-003",
    agentName: "CodeReviewer",
    agentAvatar:
      "https://api.dicebear.com/9.x/bottts/svg?seed=CodeReviewer&backgroundColor=d1d4f9",
    serviceName: "Code Review Service",
    price: 10.0,
    gas: 0.01,
    total: 10.01,
    status: "completed",
    createdAt: "2026-03-20T11:00:00Z",
    relativeTime: "1d ago",
    timeline: [
      {
        phase: "lock",
        timestamp: "11:00",
        detail: "$10.01 locked",
        txHash: "0xdef456",
      },
      {
        phase: "deliver",
        timestamp: "12:30",
        detail: "Code review report delivered",
      },
      {
        phase: "clear",
        timestamp: "12:30",
        detail: "$10.00 settled to CodeReviewer",
        txHash: "0x789abc",
      },
    ],
    requirements: { repo_url: "github.com/user/project", branch: "main" },
    deliverResult:
      "## Code Review Summary\n\nOverall Score: 8.5/10\n\n### Issues Found:\n1. Missing input validation\n2. Potential reentrancy\n3. Gas optimization needed",
    deliverableType: "text",
  },
  {
    id: "#0x5d19f6b3",
    agentId: "agent-002",
    agentName: "DataPulse",
    agentAvatar:
      "https://api.dicebear.com/9.x/bottts/svg?seed=DataPulse&backgroundColor=c0aede",
    serviceName: "Market Sentiment Score",
    price: 2.0,
    gas: 0.01,
    total: 2.01,
    status: "expired",
    createdAt: "2026-03-19T09:00:00Z",
    relativeTime: "2d ago",
    timeline: [
      {
        phase: "lock",
        timestamp: "09:00",
        detail: "$2.01 locked",
        txHash: "0xaaa111",
      },
      {
        phase: "expired",
        timestamp: "09:15",
        detail: "Agent failed to deliver within SLA",
        txHash: "0xbbb222",
      },
    ],
    requirements: { token: "ETH", timeframe: "24h" },
  },
  {
    id: "#0xe8c47a02",
    agentId: "agent-003",
    agentName: "CodeReviewer",
    agentAvatar:
      "https://api.dicebear.com/9.x/bottts/svg?seed=CodeReviewer&backgroundColor=d1d4f9",
    serviceName: "Code Review Service",
    price: 10.0,
    gas: 0.01,
    total: 10.01,
    status: "deliver_failed",
    createdAt: "2026-03-19T08:00:00Z",
    relativeTime: "2d ago",
    timeline: [
      {
        phase: "lock",
        timestamp: "08:00",
        detail: "$10.01 locked",
        txHash: "0xeee555",
      },
      {
        phase: "deliver_failed",
        timestamp: "09:45",
        detail: "Deliverable schema validation failed: missing required field 'score'",
        txHash: "0xfff666",
      },
    ],
    requirements: { repo_url: "github.com/user/defi-vault", branch: "develop" },
  },
  {
    id: "#0x12fd83ce",
    agentId: "agent-001",
    agentName: "WhaleTracker",
    agentAvatar:
      "https://api.dicebear.com/9.x/bottts/svg?seed=WhaleTracker&backgroundColor=b6e3f4",
    serviceName: "On-demand Token Analysis",
    price: 1.5,
    gas: 0.01,
    total: 1.51,
    status: "completed",
    createdAt: "2026-03-18T15:00:00Z",
    relativeTime: "3d ago",
    timeline: [
      {
        phase: "lock",
        timestamp: "15:00",
        detail: "$1.51 locked",
        txHash: "0xccc333",
      },
      {
        phase: "deliver",
        timestamp: "15:03",
        detail: "Token analysis delivered",
      },
      {
        phase: "clear",
        timestamp: "15:03",
        detail: "$1.50 settled",
        txHash: "0xddd444",
      },
    ],
    requirements: { token: "PEPE", include_holders: "true" },
    deliverResult:
      '{"sentiment": "bullish", "score": 78, "volume_24h": "$2.3M"}',
    deliverableType: "schema",
  },
];
