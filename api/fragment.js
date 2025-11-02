import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { createCanvas, loadImage, registerFont } from "canvas";
import FormData from "form-data";
import fs from "fs";

export default async function handler(req, res) {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: "Missing ?username=" });
    }

    const url = `https://fragment.com/username/${username.replace("@", "")}`;
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // ---- Extract basic data ----
    const usernameText = $("span.tm-section-header-domain span.subdomain").text().trim() || `@${username}`;
    const bid = $("div.table-cell-value").first().text().trim() || "N/A";
    const status = $("span.tm-section-header-status").text().trim() || "N/A";
    const webAddress = $('dl.tm-list-item:contains("Web Address") dd.tm-list-item-value').text().trim() || `t.me/${username}`;
    const tonAddress = $('dl.tm-list-item:contains("TON Web 3.0 Address") dd.tm-list-item-value').text().trim() || `${username}.t.me`;

    // ---- Generate Image Card ----
    const templateURL = "https://i.ibb.co/qFW35Nn2/x.jpg";
    const base = await loadImage(templateURL);

    const width = base.width;
    const height = base.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(base, 0, 0, width, height);

    ctx.font = "bold 36px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";

    ctx.fillText(usernameText, 80, 80);
    ctx.fillText(`Status: ${status}`, 80, 130);
    ctx.fillText(`Min Bid: ${bid}`, 80, 180);
    ctx.fillText(`Web: ${webAddress}`, 80, 230);
    ctx.fillText(`TON: ${tonAddress}`, 80, 280);

    // Save temporary image
    const tmpFile = `/tmp/${username}.png`;
    const out = fs.createWriteStream(tmpFile);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    await new Promise((resolve) => out.on("finish", resolve));

    // ---- Upload to tmpfiles.org ----
    const formData = new FormData();
    formData.append("file", fs.createReadStream(tmpFile));
    const uploadRes = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    const imageUrl = uploadJson?.data?.url || null;

    // ---- Respond ----
    return res.status(200).json({
      username: usernameText,
      minimum_bid: bid,
      status,
      web_address: webAddress,
      ton_web3_address: tonAddress,
      image: imageUrl,
      source: url,
      developer: "https://t.me/TryToLiveAlone",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
  
