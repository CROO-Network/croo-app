/**
 * Local prop shapes used by the Navigator card scaffolding.
 * These are expected to be replaced by the real payload types in
 * `@/types/navigator`.
 */

export interface AgentItem {
  name: string;
  avatar: string;
  status: "online" | "offline";
  description: string;
  tags: string[];
  orders: string;
  completion: string;
  volume: string;
  lowestPrice: string;
}

export interface ServiceItem {
  name: string;
  description: string;
  price: string;
  sla: string;
}

export interface SchemaField {
  key: string;
  label: string;
  type: "address" | "number" | "bool";
  required: boolean;
  placeholder?: string;
}

export interface SchemaOrderData {
  agentName: string;
  service: string;
  price: string;
  gas: string;
  total: string;
  balance: string;
  fields: SchemaField[];
}

export interface QuickAction {
  icon: string;
  text: string;
}
