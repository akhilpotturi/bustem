import pLimit from "p-limit";
import { aHashFromUrl, hamming } from "./hash";
import { computeTextScore } from "./textScore";
import type { Listing } from "./types";
import { scrapeAmazonListings } from "./scraper";

//progress update obj
type Progress = { 
  type: "progress"; 
  message: string; 
  scanned: number; 
  hits: number 
};

//options for running the scan
type ScanOpts = {
  pagesPerKeyword: number;
  maxPerPage: number;
  minScore: number;
  onProgress: (p: Progress) => void; //callback for progress updates
  onResult: (r: Listing) => void; //callback for results that meet minScore
};

//best seller items for comfrt clothing (hoodies and sweatspants)
const COMFRT_REFERENCE_IMAGES: string[] = [
  "https://comfrt.com/fast-image/c_limit,w_1200,fl_progressive:steep/comfrt/files/1_81.jpg?v=1764113204",
  "https://comfrt.com/fast-image/c_limit,w_1200,fl_progressive:steep/comfrt/files/3_1ce6eea1-f976-43bc-8ee2-65a0be725df6.jpg?v=1754947738",
  "https://comfrt.com/fast-image/comfrt/files/4_039ca4f1-1650-4681-8790-68d40298f48c.jpg?v=1767136765",
  "https://comfrt.com/fast-image/comfrt/files/1_4ab93fe8-5e1b-405c-b872-5ff73ef75076.jpg?v=1741350002",
];

//keywords to search on amazon, corresponds to comfrt products and their naming
const KEYWORDS = [
  "comfrt hoodie",
  "comfrt sweatshirt",
  "comfrt sweatpants",
  "comfrt joggers",
  "comfrt pants",
  "airplane mode hoodie",
  "hoodie",
  "sweatshirt",
  "sweatpants",
  "joggers"
];

//main scan function
export async function runScan(opts: ScanOpts) {
  const pageLimit = pLimit(6);
  const imgLimit = pLimit(10);

  opts.onProgress({ 
    type: "progress", 
    message: "Hashing reference images…", 
    scanned: 0, 
    hits: 0 
  });
  const refHashes = (await Promise.all(COMFRT_REFERENCE_IMAGES.map((u) => imgLimit(() => aHashFromUrl(u)))))
    .filter((x): x is bigint => x !== null);

  if (refHashes.length === 0) throw new Error("Could not hash reference images (network/format issue).");

  const seenAsins = new Set<string>();
  let hits = 0;
  let scanned = 0;

  const tasks: Array<Promise<void>> = [];

  //iterate through keywords and pages to build task list
  for (const keyword of KEYWORDS) {
    for (let page = 1; page <= opts.pagesPerKeyword; page++) {
      tasks.push(pageLimit(async () => {
        opts.onProgress({ 
          type: "progress", 
          message: `Searching: "${keyword}" (page ${page})…`, 
          scanned, 
          hits 
        }); //progress update

        //scrape amazon listings for the keyword + page and limit to maxPerPage
        let results = await scrapeAmazonListings(keyword, page);
        if (results.length > opts.maxPerPage) results = results.slice(0, opts.maxPerPage);

        //iterate through found item and score on text and image similarity
        const perItem = results.map((r) => imgLimit(async () => {
          if (seenAsins.has(r.asin)) return;
          seenAsins.add(r.asin);

          const title = r.name;
          const text = computeTextScore({ title }); //score for text matching

          const img = r.image ? await aHashFromUrl(r.image) : null;
          let imageScore = 0;
          let imageReason: string | null = null;

          //compute image similarity score if image hash is available
          if (img) {
            const bestDist = Math.min(...refHashes.map((h) => hamming(img, h)));
            const sim = Math.max(0, 1 - bestDist / 64);
            imageScore = sim;
            if (sim > 0.7) imageReason = `Image hash similar to reference (${Math.round(sim * 100)}%)`;
          }

          //slight bonus score addition for certain apparel items with score over 0.4
          let bonus = 0;
          if (text.score > 0.40 && /hoodie|sweat|jogger|pullover|crewneck/i.test(title)) {
            bonus = 0.06;
          }

          const score = combineScores(text.score, imageScore, bonus); //total score

          //add reasons for scoring to listing
          const reasons = [...text.reasons];
          if (imageReason) {
            reasons.push(imageReason);
          }

          //new listing object based on scraped data and computed scores
          const item: Listing = {
            asin: r.asin,
            url: r.url,
            title,
            price: r.price_string,
            rating: typeof r.stars === "number" ? String(r.stars) : undefined,
            image: r.image,
            score,
            scoreBreakdown: { 
              text: text.score, 
              image: imageScore, 
              bonus 
            },
            reasons,
            keyword
          };

          scanned++; //increment scanned count
          if (score >= opts.minScore) {
            hits++; //increment hits
            opts.onResult(item); //update with found listing match
          }

          if (scanned % 25 === 0) {
            opts.onProgress({ 
              type: "progress", 
              message: `Scanned ${scanned} listings, found ${hits}…`, 
              scanned, 
              hits 
            });
          }
        }));

        await Promise.allSettled(perItem);
      }));
    }
  }

  await Promise.all(tasks); //all tasks to complete
  opts.onProgress({ type: "progress", message: `Done. Scanned ${scanned} unique listings, found ${hits} possible matches.`, scanned, hits }); //progress update for completed scan
}

/*
function to make a final score with weights attached to different components
+weights the text score highest, image score next, and bonus last
+uses a logistic function to smooth out the final score distribution
*/
function combineScores(text: number, image: number, bonus: number) {
  const z = 1.45 * text + 1.1 * image + 0.8 * bonus - 0.55;
  const s = 1 / (1 + Math.exp(-z * 2.1));
  return clamp(s);
}

//clamp score between 0 and 1
function clamp(x: number) { 
  return Math.max(0, Math.min(1, x)); 
}
