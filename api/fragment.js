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

    // 1️⃣ Fetch and scrape the Fragment.com page
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    const $ = cheerio.load(html);

    // 2️⃣ Extract data
    const data = {
      username: `@${username}`,
      current_high_bid:
        $(".table-cell-value").first().text().trim() || "Not found",
      auction_end:
        $("time").attr("datetime") ||
        $(".js-timer-wrap time").attr("datetime") ||
        "Unknown",
      web_address:
        $("dt:contains('Web Address')").next("dd").text().trim() || "N/A",
      ton_web3_address:
        $("dt:contains('TON Web 3.0 Address')")
          .next("dd")
          .text()
          .trim() || "N/A",
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

    // 3️⃣ Generate SVG overlay (text)
    const svg = `
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <style>
        .username { font: 600 32px Arial; fill: #ffffff; }
        .status { font: 600 23px Arial; fill: #5FE890; }
        .bid { font: 700 24px Arial; fill: #ffffff; }
        .label { font: 700 28px Arial; fill: #22A9D8; }
        .bidHistory { font: 600 24px Arial; fill: #FFD700; }
        .bidFrom { font: 500 20px Arial; fill: #AAAAAA; }
        .footer { font: 400 22px Arial; fill: #CCCCCC; }
      </style>
      <text x="50" y="90" class="username">${username}.t.me</text>
      <text x="300" y="80" class="status">${data.status}</text>
      <text x="325" y="280" class="bid">${data.current_high_bid}</text>
      <text x="1148" y="80" class="label">@${username}</text>
      <text x="1090" y="180" class="label">${data.web_address}</text>
      <text x="1090" y="270" class="label">${data.ton_web3_address}</text>
      <text x="60" y="400" class="label">Recent Bids:</text>
      ${data.bid_history
        .slice(0, 3)
        .map(
          (b, i) => `
          <text x="80" y="${440 + i * 70}" class="bidHistory">💰 ${b.price}</text>
          <text x="80" y="${470 + i * 70}" class="bidFrom">From: ${b.from}</text>
        `
        )
        .join("")}
      <text x="50" y="690" class="footer">Developer: https://t.me/TryToLiveAlone</text>
    </svg>
    `;

    // 4️⃣ Combine base + overlay with Sharp
    const baseBuffer = await (await fetch(baseImageUrl)).arrayBuffer();
    const buffer = await sharp(Buffer.from(baseBuffer))
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg()
      .toBuffer();

    // 5️⃣ Save temporarily and upload to tmpfiles.org
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

    // 6️⃣ Return JSON + image URL
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
