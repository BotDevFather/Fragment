import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const { username } = req.query;
  if (!username)
    return res.status(400).json({ error: "Missing ?username= parameter" });

  const url = `https://fragment.com/username/${username}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(html);

    const data = {
      username: extractUsername($),
      current_high_bid: extractHighBid($),
      auction_end: extractAuctionEnd($),
      web_address: extractWebAddress($),
      ton_web3_address: extractTonWeb3Address($),
      status: extractStatus($),
      bid_history: extractBidHistory($),
      source: url,
      developer: "https://t.me/TryToLiveAlone",
    };

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
}

// --- Extraction Helpers ---

function extractUsername($) {
  try {
    const elem = $("span.tm-section-header-domain");
    if (elem.length) {
      const subdomain = elem.find("span.subdomain");
      if (subdomain.length) return `@${subdomain.text().trim()}`;
    }
    const h2 = $("h2").text();
    const match = h2.match(/@(\w+)/);
    if (match) return `@${match[1]}`;
    return null;
  } catch {
    return null;
  }
}

function extractHighBid($) {
  try {
    const elem = $("div.table-cell-value").filter((_, el) =>
      $(el).text().match(/\d/)
    );
    if (elem.length) return elem.first().text().trim();

    const th = $("th").filter((_, el) =>
      $(el).text().match(/Highest Bid/i)
    );
    if (th.length) {
      const row = th.first().closest("tr");
      const val = row.find("div.table-cell-value").text().trim();
      if (val) return val;
    }
    return null;
  } catch {
    return null;
  }
}

function extractAuctionEnd($) {
  try {
    const timeElem = $("div.js-timer-wrap time[datetime]").attr("datetime");
    if (timeElem) return timeElem;

    const alt = $("div.tm-section-countdown time").attr("datetime");
    return alt || null;
  } catch {
    return null;
  }
}

function extractWebAddress($) {
  try {
    let result = null;
    $("dl.tm-list-item").each((_, el) => {
      const title = $(el).find("dt.tm-list-item-title").text();
      if (title.includes("Web Address")) {
        result = $(el).find("dd.tm-list-item-value").text().trim();
      }
    });
    return result;
  } catch {
    return null;
  }
}

function extractTonWeb3Address($) {
  try {
    let result = null;
    $("dl.tm-list-item").each((_, el) => {
      const title = $(el).find("dt.tm-list-item-title").text();
      if (title.includes("TON Web 3.0 Address")) {
        result = $(el).find("dd.tm-list-item-value").text().trim();
      }
    });
    return result;
  } catch {
    return null;
  }
}

function extractStatus($) {
  try {
    const elem = $("span.tm-section-header-status");
    if (elem.length) return elem.text().trim();
    return null;
  } catch {
    return null;
  }
}

function extractBidHistory($) {
  try {
    const bids = [];
    const rows = $("table.tm-table tbody tr").slice(0, 10);

    rows.each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 3) {
        bids.push({
          price: $(cells[0]).text().trim(),
          date: $(cells[1]).text().trim(),
          from: $(cells[2]).text().trim(),
        });
      }
    });

    return bids;
  } catch {
    return [];
  }
}
