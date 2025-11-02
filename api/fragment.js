import axios from "axios";
import * as cheerio from "cheerio";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";
import fs from "fs";

export default async function handler(req, res) {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Missing ?username= parameter" });

  const url = `https://fragment.com/username/${username}`;

  try {
    // --- 1. Scrape Data ---
    const { data: html } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const $ = cheerio.load(html);

    const data = {
      username: extractUsername($) || `@${username}`,
      status: extractStatus($) || "Unavailable",
      min_bid: extractHighBid($) || "N/A",
      web_address: extractWebAddress($) || `t.me/${username}`,
      ton_web3_address: extractTonWeb3Address($) || `${username}.t.me`,
      source: url,
      developer: "https://t.me/TryToLiveAlone",
    };

    // --- 2. Create Image ---
    const imgPath = `/tmp/${username}.png`;
    await generateImage(data, imgPath);

    // --- 3. Upload to tmpfiles.org ---
    const formData = new FormData();
    formData.append("file", fs.createReadStream(imgPath));
    const uploadRes = await axios.post("https://tmpfiles.org/api/v1/upload", formData, {
      headers: formData.getHeaders(),
    });

    const imageUrl = uploadRes.data.data.url;

    // --- 4. Respond with JSON ---
    res.status(200).json({
      ...data,
      image_url: imageUrl,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate image", details: err.message });
  }
}

// ---------------- Helper Functions ----------------
function extractUsername($) {
  const elem = $("span.tm-section-header-domain");
  if (elem.length) return elem.text().trim();
  const h2 = $("h2").text();
  const match = h2.match(/@(\w+)/);
  return match ? `@${match[1]}` : null;
}

function extractHighBid($) {
  const elem = $("div.table-cell-value").first();
  return elem.text().trim() || null;
}

function extractWebAddress($) {
  let result = null;
  $("dl.tm-list-item").each((_, el) => {
    const title = $(el).find("dt.tm-list-item-title").text();
    if (title.includes("Web Address")) {
      result = $(el).find("dd.tm-list-item-value").text().trim();
    }
  });
  return result;
}

function extractTonWeb3Address($) {
  let result = null;
  $("dl.tm-list-item").each((_, el) => {
    const title = $(el).find("dt.tm-list-item-title").text();
    if (title.includes("TON Web 3.0 Address")) {
      result = $(el).find("dd.tm-list-item-value").text().trim();
    }
  });
  return result;
}

function extractStatus($) {
  const elem = $("span.tm-section-header-status");
  return elem.text().trim() || null;
}

// ---------------- Image Generator ----------------
async function generateImage(data, outputPath) {
  const width = 1280;
  const height = 341;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, width, height);

  // Main Title
  ctx.font = "bold 48px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${data.ton_web3_address}`, 40, 80);

  // Status box
  ctx.fillStyle = data.status === "Available" ? "#2ecc71" : "#e74c3c";
  ctx.fillRect(360, 40, 200, 50);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  ctx.fillText(data.status, 380, 75);

  // Minimum Bid box
  ctx.fillStyle = "#1f2a33";
  ctx.fillRect(40, 120, 400, 150);
  ctx.font = "bold 28px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Minimum Bid", 60, 170);
  ctx.font = "bold 40px Arial";
  ctx.fillStyle = "#00aaff";
  ctx.fillText(data.min_bid, 60, 240);

  // Right details
  ctx.font = "bold 22px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Telegram Username", 480, 150);
  ctx.fillText("Web Address", 480, 210);
  ctx.fillText("TON Web 3.0 Address", 480, 270);

  ctx.font = "bold 22px Arial";
  ctx.fillStyle = "#00aaff";
  ctx.fillText(data.username, 780, 150);
  ctx.fillText(data.web_address, 780, 210);
  ctx.fillText(data.ton_web3_address, 780, 270);

  // Save to /tmp
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);
}
