export type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateFlagPayload = {
  name: string;
  key: string;
  description: string;
  enabled: boolean;
};

export type FlagListResponse = {
  data: FeatureFlag[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, string>;
  };
};
