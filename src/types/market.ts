export interface Market {
  id: string;
  market_name: string;
  market_code: string;
  created_at: string;
}

export interface UserMarket {
  id: string;
  user_id: string;
  market_id: string;
}
