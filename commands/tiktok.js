const { ttdl } = require("ruhend-scraper");
const axios = require("axios");

const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        const msgId = message.key.id;
        if (processedMessages.has(msgId)) return;
        processedMessages.add(msgId);
        setTimeout(() => processedMessages.delete(msgId), 300000);

        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text;

        if (!text)
            return sock.sendMessage(chatId, { text: "❌ Send a TikTok link." });

        const url = text.split(" ").slice(1).join(" ").trim();
        if (!url)
            return sock.sendMessage(chatId, { text: "❌ Send a TikTok link." });

        if (!/tiktok\.com/.test(url))
            return sock.sendMessage(chatId, { text: "❌ Invalid TikTok URL." });

        await sock.sendMessage(chatId, {
            react: { text: "🔄", key: message.key },
        });

        let videoUrl = null;
        let title = "TikTok Video";

        /* ================= SIPUTZX API ================= */
        try {
            const api = `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(
                url
            )}`;

            const res = await axios.get(api, { timeout: 15000 });

            if (
                res.data &&
                (res.data.status || res.data.success) &&
                res.data.data
            ) {
                const d = res.data.data;
                videoUrl =
                    d.urls?.[0] ||
                    d.video_url ||
                    d.download_url ||
                    d.url ||
                    null;

                title = d.metadata?.title || title;
            }
        } catch (e) {
            console.error("Siputzx failed:", e.message);
        }

        /* ================= FALLBACK: TTDL ================= */
        if (!videoUrl) {
            try {
                const ttdlData = await ttdl(url);
                const media = ttdlData?.data?.find(
                    (m) => m.type === "video" || /\.mp4/i.test(m.url)
                );
                if (media) videoUrl = media.url;
            } catch (e) {
                console.error("ttdl failed:", e.message);
            }
        }

        if (!videoUrl)
            return sock.sendMessage(
                chatId,
                { text: "❌ Failed to download TikTok video." },
                { quoted: message }
            );

        /* ================= SEND VIDEO ================= */
        try {
            const videoRes = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 60000,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    Referer: "https://www.tiktok.com/",
                },
            });

            const buffer = Buffer.from(videoRes.data);

            if (buffer.length < 50 * 1024)
                throw new Error("Invalid video buffer");

            await sock.sendMessage(
                chatId,
                {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption: `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝐉𝐀𝐍𝐈𝐘𝐀 𝐕𝟏𝟐\n\n📝 ${title}`,
                },
                { quoted: message }
            );
        } catch (err) {
            console.error("Buffer send failed:", err.message);

            // URL fallback
            await sock.sendMessage(
                chatId,
                {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝐉𝐀𝐍𝐈𝐘𝐀 𝐕𝟏𝟐\n\n📝 ${title}`,
                },
                { quoted: message }
            );
        }
    } catch (err) {
        console.error("TikTok Command Error:", err);
        await sock.sendMessage(chatId, {
            text: "⚠️ Error processing TikTok video.",
        });
    }
}

module.exports = tiktokCommand;