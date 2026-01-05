//cleaned amazon scraped search result
export type StructuredAmazonSearchItem = {
  asin: string;
  name: string;
  image?: string;
  url: string;
  price_string?: string;
  stars?: number;
};

//raw data returned by ScraperAPI
type StructuredAmazonSearchResponse = {
  results?: Array<any>;
};

//function to fetch structured amazon search results using ScraperAPI and return cleaned data
export async function scrapeAmazonListings(query: string, page = 1, timeoutMs = 35000): Promise<StructuredAmazonSearchItem[]> {
  const endpoint = new URL("https://api.scraperapi.com/structured/amazon/search/v1");
  endpoint.searchParams.set("api_key", String(process.env.SCRAPER_API_KEY));
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("tld", "com");
  endpoint.searchParams.set("page", String(page));

  const ctrl = new AbortController();
  const t= setTimeout(() => ctrl.abort(), timeoutMs);

  //make API request
  try {
    const res = await fetch(endpoint.toString(), {
      signal: ctrl.signal,
      cache: "no-store",
    });

    //error handling
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ScraperAPI error ${res.status}: ${text.slice(0, 200)}`);
    }

    //throw data into formatted structure
    const data = (await res.json()) as StructuredAmazonSearchResponse;
    const results = Array.isArray(data.results) ? data.results : [];

    const items: StructuredAmazonSearchItem[] = [];

    //iterate through response, clean and push to items array
    for (const result of results) {
      if (!result) continue;
      if (result.type && result.type !== "search_product") continue;
      if (!result.asin || !result.name || !result.url) continue;

      items.push({
        asin: String(result.asin),
        name: String(result.name),
        image: result.image ? String(result.image) : undefined,
        url: String(result.url),
        price_string: result.price_string ? String(result.price_string) : undefined,
        stars: typeof result.stars === "number" ? result.stars : undefined
      });
    }
    return items;
  } finally {
    clearTimeout(t);
  }
}
