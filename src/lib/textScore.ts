import { get as levenshtein } from "fast-levenshtein"; //library for levenshtein distance, fuzzy string matching

// computes a score for textusl listings based on title and brand
export function computeTextScore(input: { title: string; brand?: string }): { score: number; reasons: string[] } {
  const reasons: string[] = []; //init array containing reasons for score
  const title = prepareForProcessing(input.title); //normalize the title for processing
  const target = "comfrt";

  let score = 0; //score init at 0, add to it based on criteria

  //check to see if the listing title contains "comfrt" exactly
  //highest weight for direct match to "comfrt"
  if (containsTarget(title, target)) {
    score += 0.55;
    reasons.push('Contains "comfrt" in the listing title');
  }

  //fuzzy match with "comfrt" using normalized Levenshtein distance
  const simComfort = normalizedLevenshtein(title, "comfrt");
  if (simComfort > 0.72) {
    score += 0.12;
    reasons.push(`Title similar to "comfort" (sim ${(simComfort * 100).toFixed(0)}%)`);
  }

  //listing contains common words that are often associated with comfrt products
  const apparel = ["hoodie", "sweatshirt", "sweatpants","jogger", "pullover"];
  const hit = apparel.filter((item) => title.includes(item));
  if (hit.length >= 1) {
    score += Math.min(0.15, 0.05 * hit.length); //cap of 0.15 added for multiple keywords in title
    reasons.push(`Apparel keywords: ${hit.slice(0, 3).join(", ")}`); //slice to max 3 keywords for reason
  }

  //slight penalty to score if the title contains the full word "comfort" to avoid generic product
  if (containsTarget(title, "comfort")) {
    score -= 0.05;
  }

  //return the clamped final textScore and correponsding reasons array
  return { 
    score: clamp(score), 
    reasons 
  };
}

//helper functions

//prepare title for processing: lowercase, remove special chars, extra spaces, etc.
function prepareForProcessing(title: string) {
  return (title ?? "").toLowerCase().replace(/[®™©]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

//check if title contains target word as a whole
function containsTarget(title: string, target: string) { 
  return (` ${title} `).includes(` ${target} `); 
}


//clamp score between 0 and 1
function clamp(x: number) { 
  return Math.max(0, Math.min(1, x)); 
}

//normalize Levenshtein distance between two strings
function normalizedLevenshtein(a: string, b: string) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const lev = levenshtein(a, b);
  return 1 - lev / Math.max(a.length, b.length);
}


