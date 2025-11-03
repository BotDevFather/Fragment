import sharp from "sharp";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import FormData from "form-data";

export default async function handler(req, res) {
  try {
    const username = (req.query.username || "heartless").replace("@", "");
    const url = `https://fragment.com/username/${username}`;
    const baseImageUrl = "https://i.ibb.co/qFW35Nn2/x.jpg";

    // --- Helper: Escape special chars for SVG ---
    const escapeXML = (unsafe) =>
      unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    // 1️⃣ Fetch Fragment HTML
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    const $ = cheerio.load(html);

    // 2️⃣ Extract data
    const data = {
      username: `@${username}`,
      current_high_bid: $(".table-cell-value").first().text().trim() || "Not found",
      auction_end:
        $("time").attr("datetime") ||
        $(".js-timer-wrap time").attr("datetime") ||
        "Unknown",
      web_address: $("dt:contains('Web Address')").next("dd").text().trim() || "N/A",
      ton_web3_address:
        $("dt:contains('TON Web 3.0 Address')").next("dd").text().trim() || "N/A",
      status: $(".tm-section-header-status").text().trim() || "Unknown",
      bid_history: [],
      source: url,
      developer: "https://t.me/TryToLiveAlone",
    };

    $("table.tm-table tbody tr").each((i, el) => {
      if (i < 5) {
        const tds = $(el).find("td");
        data.bid_history.push({
          price: $(tds[0]).text().trim(),
          date: $(tds[1]).text().trim(),
          from: $(tds[2]).text().trim(),
        });
      }
    });

    // 3️⃣ Load base and get size
    const baseBuffer = await (await fetch(baseImageUrl)).arrayBuffer();
    const baseMeta = await sharp(Buffer.from(baseBuffer)).metadata();
    const { width, height } = baseMeta;

    // 4️⃣ Build SVG safely with escaped text
    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');
        text { font-family: 'Open Sans', sans-serif; }
        .username { font: 600 32px 'Open Sans'; fill: #ffffff; }
        .status { font: 600 23px 'Open Sans'; fill: #5FE890; }
        .bid { font: 700 24px 'Open Sans'; fill: #ffffff; }
        .label { font: 700 28px 'Open Sans'; fill: #22A9D8; }
        .bidHistory { font: 600 24px 'Open Sans'; fill: #FFD700; }
        .bidFrom { font: 500 20px 'Open Sans'; fill: #AAAAAA; }
        .footer { font: 400 22px 'Open Sans'; fill: #CCCCCC; }
      </style>

      <text x="50" y="90" class="username">${escapeXML(username)}.t.me</text>
      <text x="300" y="80" class="status">${escapeXML(data.status)}</text>
      <text x="325" y="280" class="bid">${escapeXML(data.current_high_bid)}</text>
      <text x="1148" y="80" class="label">@${escapeXML(username)}</text>
      <text x="1090" y="180" class="label">${escapeXML(data.web_address)}</text>
      <text x="1090" y="270" class="label">${escapeXML(data.ton_web3_address)}</text>

      <text x="60" y="400" class="label">Recent Bids:</text>
      ${data.bid_history
        .slice(0, 3)
        .map(
          (b, i) => `
            <text x="80" y="${440 + i * 70}" class="bidHistory">💰 ${escapeXML(b.price)}</text>
            <text x="80" y="${470 + i * 70}" class="bidFrom">From: ${escapeXML(b.from)}</text>
          `
        )
        .join("")}

      <text x="50" y="${height - 40}" class="footer">
        Developer: https://t.me/TryToLiveAlone
      </text>
    </svg>`;

    // 5️⃣ Combine base + overlay
    const buffer = await sharp(Buffer.from(baseBuffer))
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg()
      .toBuffer();

    // 6️⃣ Save + upload
    const tempPath = path.join("/tmp", `fragment_${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, buffer);

    const formData = new FormData();
    formData.append("file", fs.createReadStream(tempPath));
    const uploadRes = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });
    const uploadData = await uploadRes.json();
    fs.unlinkSync(tempPath);

    let image_url = null;
    if (uploadData?.data?.url) {
      const parts = uploadData.data.url.split("/").filter(Boolean);
      image_url = `https://tmpfiles.org/dl/${parts[2]}/${parts[3]}`;
    }

    // 7️⃣ Output JSON
    return res.status(200).json({
      status: "OK",
      ...data,
      image_url,
    });
  } catch (err) {
    return res.status(500).json({
      status: "ERROR",
      message: err.message,
      developer: "https://t.me/TryToLiveAlone",
    });
  }
}
