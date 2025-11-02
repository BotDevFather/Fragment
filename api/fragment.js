import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const { username } = req.query;
  if (!username)
    return res.status(400).json({ error: "Missing ?username=" });

  try {
    const cleanName = username.replace("@", "");
    const url = `https://fragment.com/username/${cleanName}`;
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract data
    const usernameText =
      $("span.tm-section-header-domain span.subdomain").text().trim() ||
      `@${cleanName}`;
    const currentBid =
      $("div.table-cell-value").first().text().trim() || "N/A";
    const status =
      $("span.tm-section-header-status").text().trim() || "N/A";
    const auctionEnd =
      $("div.js-timer-wrap time").attr("datetime") ||
      $("div.tm-section-countdown time").attr("datetime") ||
      "N/A";
    const webAddress =
      $('dl.tm-list-item:contains("Web Address") dd.tm-list-item-value')
        .text()
        .trim() || `t.me/${cleanName}`;
    const tonAddress =
      $('dl.tm-list-item:contains("TON Web 3.0 Address") dd.tm-list-item-value')
        .text()
        .trim() || `${cleanName}.t.me`;

    // Bid history
    const bidHistory = [];
    $("table.tm-table tbody tr").each((i, el) => {
      if (i < 3) {
        const tds = $(el).find("td");
        bidHistory.push({
          price: $(tds[0]).text().trim(),
          date: $(tds[1]).text().trim(),
          from: $(tds[2]).text().trim(),
        });
      }
    });

    // 🖼 Base Template
    const templateURL = "https://i.ibb.co/S7MfSYQX/Untitled7-20251102195656.png";
    const base = await loadImage(templateURL);
    const width = base.width;
    const height = base.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0, width, height);

    // ✏️ Text Styles
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.font = "bold 38px Arial";

    // Header
    ctx.fillText(usernameText, 80, 120);

    ctx.font = "28px Arial";
    ctx.fillText(`Status: ${status}`, 80, 180);
    ctx.fillText(`High Bid: ${currentBid}`, 80, 230);
    ctx.fillText(`Ends: ${auctionEnd}`, 80, 280);
    ctx.fillText(`Web: ${webAddress}`, 80, 330);
    ctx.fillText(`TON: ${tonAddress}`, 80, 380);

    // 📜 Bid history (top 3)
    ctx.font = "bold 32px Arial";
    ctx.fillText("Top Bids:", 80, 450);

    ctx.font = "26px Arial";
    bidHistory.forEach((b, i) => {
      const y = 500 + i * 50;
      ctx.fillText(`${i + 1}. ${b.price} - ${b.from}`, 100, y);
    });

    // Save image
    const tmpPath = path.join("/tmp", `${Date.now()}-${cleanName}.jpg`);
    const buffer = canvas.toBuffer("image/jpeg");
    fs.writeFileSync(tmpPath, buffer);

    // Upload to tmpfiles.org
    const formData = new FormData();
    formData.append("file", fs.createReadStream(tmpPath));
    const uploadRes = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });
    const uploadData = await uploadRes.json();
    fs.unlinkSync(tmpPath);

    let imageUrl = null;
    if (uploadData?.data?.url) {
      const parts = uploadData.data.url.split("/").filter(Boolean);
      const id = parts[2];
      const file = parts[3];
      imageUrl = `https://tmpfiles.org/dl/${id}/${file}`;
    }

    // 🧾 Final JSON Response
    return res.status(200).json({
      username: usernameText,
      current_high_bid: currentBid,
      auction_end: auctionEnd,
      status,
      web_address: webAddress,
      ton_web3_address: tonAddress,
      bid_history: bidHistory,
      image_url: imageUrl,
      source: url,
      developer: "https://t.me/TryToLiveAlone",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
}
