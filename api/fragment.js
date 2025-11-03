import sharp from "sharp";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";
import * as cheerio from "cheerio";

const FONT_PATH = "./OpenSans-Regular.ttf"; // local font file
const TEMPLATE_URL = "https://i.ibb.co/qFW35Nn2/x.jpg"; // your base image

export default async function handler(req, res) {
  try {
    const username = (req.query.username || "heartless").replace("@", "");
    const url = `https://fragment.com/username/${username}`;

    // 🧠 Check font file
    if (!fs.existsSync(FONT_PATH)) throw new Error("Font not found: " + FONT_PATH);
    const fontBase64 = fs.readFileSync(FONT_PATH).toString("base64");

    // 🧠 Fetch template image
    const imgRes = await fetch(TEMPLATE_URL);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const meta = await sharp(imgBuffer).metadata();
    const width = meta.width;
    const height = meta.height;

    // 🧠 Scrape Fragment data
    const pageResponse = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
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
      ton_web3_address: $("dt:contains('TON Web 3.0 Address')").next("dd").text().trim() || "—",
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

    // 🧩 Text coordinates
    const fields = [
      { x: 50, y: 90, text: data.ton_web3_address, color: "#ffffff", size: 32, weight: "600" },
      { x: 300, y: 80, text: data.status, color: "#5FE890", size: 23, weight: "600" },
      { x: 325, y: 280, text: data.current_high_bid, color: "#ffffff", size: 24, weight: "700" },
      { x: 1148, y: 80, text: data.username, color: "#22A9D8", size: 28, weight: "600" },
      { x: 1090, y: 180, text: data.web_address, color: "#22A9D8", size: 28, weight: "700" },
      { x: 1090, y: 270, text: data.ton_web3_address, color: "#22A9D8", size: 28, weight: "600" },
    ];

    let y = 370;
    for (const bid of data.bid_history) {
      fields.push({
        x: 70,
        y,
        text: `${bid.price} — ${bid.from}`,
        color: "#FFD700",
        size: 22,
        weight: "600",
      });
      fields.push({
        x: 70,
        y: y + 25,
        text: bid.date,
        color: "#AAAAAA",
        size: 20,
        weight: "400",
      });
      y += 60;
    }

    // 🧩 Escape XML
    const escapeXml = (t) =>
      String(t)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    // 🧩 Create SVG overlay with same size as image
    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
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

    // 🧷 Combine the SVG overlay
    const buffer = await sharp(imgBuffer)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();

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
      const parts = uploadData.data.url.split("/").filter(Boolean);
      image_url = `https://tmpfiles.org/dl/${parts[2]}/${parts[3]}`;
    }

    // ✅ Return JSON
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
