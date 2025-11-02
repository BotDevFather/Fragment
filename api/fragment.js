import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const username = (req.query.username || "heartless").replace("@", "");
    const url = `https://fragment.com/username/${username}`;
    const baseImageUrl = "https://i.ibb.co/qFW35Nn2/x.jpg";

    // 1️⃣ Fetch page HTML
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // 2️⃣ Scrape key data
    const data = {
      username: `@${username}`,
      current_high_bid:
        $(".table-cell-value").first().text().trim() || "Not found",
      auction_end:
        $("time").attr("datetime") ||
        $(".js-timer-wrap time").attr("datetime") ||
        "Unknown",
      web_address:
        $("dt:contains('Web Address')").next("dd").text().trim() || null,
      ton_web3_address:
        $("dt:contains('TON Web 3.0 Address')")
          .next("dd")
          .text()
          .trim() || null,
      status: $(".tm-section-header-status").text().trim() || "Unknown",
      bid_history: [],
      source: url,
      developer: "https://t.me/TryToLiveAlone",
    };

    // Bid history
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

    // 3️⃣ Draw on base template
    const base = await loadImage(baseImageUrl);
    const canvas = createCanvas(base.width, base.height);
    const ctx = canvas.getContext("2d");

    // Background image
    ctx.drawImage(base, 0, 0, base.width, base.height);

    // Styles
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "36px Arial";
    ctx.textAlign = "left";

    // Write main info
    ctx.fillText(`Username: ${data.username}`, 50, 100);
    ctx.fillText(`Status: ${data.status}`, 50, 150);
    ctx.fillText(`High Bid: ${data.current_high_bid}`, 50, 200);
    ctx.fillText(`Auction End: ${data.auction_end}`, 50, 250);

    ctx.font = "28px Arial";
    ctx.fillText("Recent Bids:", 50, 320);

    data.bid_history.slice(0, 3).forEach((bid, i) => {
      const y = 370 + i * 60;
      ctx.fillText(`${bid.price} — ${bid.from}`, 70, y);
      ctx.fillText(`${bid.date}`, 70, y + 30);
    });

    ctx.font = "22px Arial";
    ctx.fillStyle = "#CCCCCC";
    ctx.fillText(`Developer: https://t.me/TryToLiveAlone`, 50, base.height - 40);

    // 4️⃣ Save temp and upload to tmpfiles.org
    const buffer = await canvas.encode("jpeg");
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

    // 5️⃣ Final JSON output
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
