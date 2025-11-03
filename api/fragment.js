import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";
import * as cheerio from "cheerio";
import { createCanvas, loadImage, registerFont } from "canvas";

const FONT_PATH = path.resolve("./fonts/OpenSans-Regular.ttf");
registerFont(FONT_PATH, { family: "OpenSans" });

const TEMPLATE_URL = "https://i.ibb.co/qFW35Nn2/x.jpg";

export default async function handler(req, res) {
  try {
    const username = (req.query.username || "heartless").replace("@", "");
    const url = `https://fragment.com/username/${username}`;

    // 🧠 Fetch template
    const imgRes = await fetch(TEMPLATE_URL);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const template = await loadImage(imgBuffer);

    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.drawImage(template, 0, 0, template.width, template.height);

    // 🧠 Scrape fragment data
    const pageResponse = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await pageResponse.text();
    const $ = cheerio.load(html);

    const data = {
      username: `@${username}`,
      current_high_bid: $(".table-cell-value").first().text().trim() || "Unknown",
      auction_end:
        $("time").attr("datetime") ||
        $(".js-timer-wrap time").attr("datetime") ||
        "Unknown",
      web_address: $("dt:contains('Web Address')").next("dd").text().trim() || "—",
      ton_web3_address:
        $("dt:contains('TON Web 3.0 Address')").next("dd").text().trim() || "—",
      status: $(".tm-section-header-status").text().trim() || "Unknown",
      bid_history: [],
      source: url,
      developer: "https://t.me/TryToLiveAlone",
    };

    $("table.tm-table tbody tr").each((i, el) => {
      if (i < 3) {
        const tds = $(el).find("td");
        data.bid_history.push({
          price: $(tds[0]).text().trim(),
          date: $(tds[1]).text().trim(),
          from: $(tds[2]).text().trim(),
        });
      }
    });

    // 🧩 Draw text
    const drawText = (text, x, y, size, color, weight = "normal") => {
      ctx.font = `${weight} ${size}px OpenSans`;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    drawText(data.ton_web3_address, 50, 90, 32, "#ffffff", "600");
    drawText(data.status, 300, 80, 23, "#5FE890", "600");
    drawText(data.current_high_bid, 325, 280, 24, "#ffffff", "700");
    drawText(data.username, 1950, 80, 28, "#22A9D8", "600");
    drawText(data.web_address, 1055, 180, 28, "#22A9D8", "700");
    drawText(data.ton_web3_address, 1055, 270, 28, "#22A9D8", "600");

    // 🧩 Draw bid history
    let y = 370;
    for (const bid of data.bid_history) {
      drawText(`${bid.price} — ${bid.from}`, 70, y, 22, "#FFD700", "600");
      drawText(bid.date, 70, y + 25, 20, "#AAAAAA", "400");
      y += 60;
    }

    // 🧷 Export as PNG
    const buffer = canvas.toBuffer("image/png");

    // ☁️ Upload to tmpfiles.org
    const tempPath = path.join("/tmp", `fragment_${Date.now()}.png`);
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
      image_url = uploadData.data.url.replace(
        "tmpfiles.org/",
        "tmpfiles.org/dl/"
      );
    }

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
