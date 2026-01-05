export type Listing = {
  asin: string;
  url: string;
  title: string;
  brand?: string;
  price?: string;
  rating?: string;
  image?: string;
  score: number;
  scoreBreakdown: { text: number; image: number; bonus: number };
  reasons: string[];
  keyword: string;
};


