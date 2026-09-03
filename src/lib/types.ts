export type ProviderClass = "online" | "offline" | "hybrid";

export type ModelRef = {
  id: string;
  name?: string;
};

export type ProviderPublic = {
  opr_version: number;
  id: string;
  display_name: string;
  class: ProviderClass;
  base_url: string;
  api_format: string;
  keyless: boolean;
  tags: string[];
  models: ModelRef[];
  homepage?: string;
  contact?: string;
  created_at: string;
  updated_at: string;
};

export type ProviderWrite = {
  opr_version?: number;
  id: string;
  display_name?: string;
  class: ProviderClass;
  base_url: string;
  api_format?: string;
  keyless?: boolean;
  tags?: string[];
  models?: ModelRef[] | string[];
  homepage?: string;
  contact?: string;
};
