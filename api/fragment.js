import sharp from "sharp";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";
import * as cheerio from "cheerio";

const FONT_PATH = "https://github.com/TryToLiveAlon/api-wrappe/blob/main/fonts/OpenSans-Regular.ttf";
const TEMPLATE_PATH = "https://i.ibb.co/qFW35Nn2/x.jpg";

export default async function handler(req, res) {
  try {
    const username = (req.query.username || "heartless").replace("@", "");
    const url = `https://fragment.com/username/${username}`;

    // 1️⃣ Fetch HTML
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    const $ = cheerio.load(html);

    // 2️⃣ Scrape data
    const data = {
      username: `@${username}`,
      current_high_bid: $(".table-cell-value").first().text().trim() || "Unknown",
      auction_end:
        $("time").attr("datetime") ||
        $(".js-timer-wrap time").attr("datetime") ||
        "Unknown",
      web_address:
        $("dt:contains('Web Address')").next("dd").text().trim() || "—",
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

    // 3️⃣ Validate assets
    if (!fs.existsSync(TEMPLATE_PATH)) throw new Error("template.png not found!");
    if (!fs.existsSync(FONT_PATH)) throw new Error("Font not found: OpenSans-Regular.ttf");

    const metadata = await sharp(TEMPLATE_PATH).metadata();
    const fontBase64 = fs.readFileSync(FONT_PATH).toString("base64");

    // 4️⃣ Text layout
    const fields = [
      { x: 50, y: 90, text: data.ton_web3_address, color: "#ffffff", size: 32, weight: "600" },
      { x: 300, y: 80, text: data.status, color: "#5FE890", size: 23, weight: "600" },
      { x: 325, y: 280, text: data.current_high_bid, color: "#ffffff", size: 24, weight: "700" },
      { x: 1148, y: 80, text: data.username, color: "#22A9D8", size: 28, weight: "600" },
      { x: 1090, y: 180, text: data.web_address, color: "#22A9D8", size: 28, weight: "700" },
      { x: 1090, y: 270, text: data.ton_web3_address, color: "#22A9D8", size: 28, weight: "600" },
    ];

    // Add top 3 bid lines
    let yStart = 370;
    data.bid_history.forEach((bid, i) => {
      fields.push({
        x: 70,
        y: yStart + i * 60,
        text: `${bid.price} — ${bid.from}`,
        color: "#FFD700",
        size: 22,
        weight: "600",
      });
      fields.push({
        x: 70,
        y: yStart + i * 60 + 25,
        text: bid.date,
        color: "#AAAAAA",
        size: 20,
        weight: "400",
      });
    });

    const escapeXml = (t) =>
      String(t)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    // 5️⃣ SVG overlay (no external fonts)
    const svgOverlay = `
    <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        @font-face {
          font-family: 'OpenSans';
          src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
        }
      </style>
      ${fields
        .map(
          (f) =>
            `<text x="${f.x}" y="${f.y}" font-family="OpenSans" font-size="${f.size}" font-weight="${f.weight}" fill="${f.color}">${escapeXml(f.text)}</text>`
        )
        .join("\n")}
    </svg>`;

    // 6️⃣ Compose and upload
    const buffer = await sharp(TEMPLATE_PATH)
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .png()
      .toBuffer();

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
      const parts = uploadData.data.url.split("/").filter(Boolean);
      image_url = `https://tmpfiles.org/dl/${parts[2]}/${parts[3]}`;
    }

    // ✅ Final JSON
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
