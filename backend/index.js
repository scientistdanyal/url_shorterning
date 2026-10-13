import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { query } from "./db.js";
import { generateShortCode } from "./utils/shortCode.js";
import redis from "./redis.js";
import { enqueueClick } from "./queues/clickQueue.js";
import { shortenLimiter } from "./middleware/rateLimit.js";

dotenv.config();

const TTL_SECONDS = 60;
const app = express();
app.set("trust proxy", 1); // behind Nginx: use X-Forwarded-For so rate limit is per real client IP
const PORT = process.env.PORT || 3000;

async function purgeExpiredUrls() {
    try {
        await query(`DELETE FROM urls WHERE created_at < NOW() - INTERVAL '1 minute'`);
    } catch (error) {
        console.error("Error purging expired URLs:", error.message);
    }
}

app.use(cors());
app.use(express.json());




app.get("/api/health",async(req, res) => {

    try {

        await query("SELECT 1");
        res.json({
            status: "ok",
            service: "url-shortener-api",
            timestamp: new Date().toISOString(),
        })
    }
    catch (error) {
        console.error("Error checking health:", error.message);
        res.status(500).json({
            status: "error",
            message:"Internal server error",
        });
    }
    
});




app.get("/:shortCode", async(req, res) => {
    try {
        const { shortCode } = req.params; 

        const cacheKey = `url:${shortCode}`; // redis key for this short code

        let long_url = await redis.get(cacheKey);

        if (!long_url) {
            const result = await query(
                `SELECT long_url, created_at FROM urls WHERE short_code = $1`,
                [shortCode]
            );

            if (result.rows.length == 0) {
                return res.status(404).json({error: "Short URL not found or expired"});
            }

            const { created_at } = result.rows[0];
            const remainingSeconds = TTL_SECONDS - Math.floor((Date.now() - new Date(created_at).getTime()) / 1000);

            if (remainingSeconds <= 0) {
                await query(`DELETE FROM urls WHERE short_code = $1`, [shortCode]);
                return res.status(410).json({error: "Short URL has expired"});
            }

            long_url = result.rows[0].long_url;
            await redis.set(cacheKey, long_url, { EX: remainingSeconds });
        }

        enqueueClick({
            short_code: shortCode,
            ip: req.ip,
            user_agent: req.get("user-agent") || null,
            referrer: req.get("referer") || null,
            country: req.get("cf-ipcountry") || null,
            clicked_at: new Date().toISOString(),
        }).catch((err) => console.error("Failed to enqueue click:", err.message));

        res.redirect(long_url);
    } catch (error) {
        console.error("Error redirecting to long URL:", error.message);
        res.status(500).json({error: "Internal server error"});
    }
})




app.post("/api/shorten", shortenLimiter, async(req, res) => {
    try { 
        const { long_url, user_id } = req.body; // long_url required; user_id is optional 

        if (!long_url || typeof long_url !== "string") {
            return res.status(400).json({error: "Invalid long_url"});
        }

        // must look like a real URL
        try {
            new URL(long_url);
        } catch (error) {return res.status(400).json({error: "long_url must be a valid URL"});}

        const short_code = generateShortCode(); // e.g. "aB3xY9"

        const result = await query(
            `INSERT INTO urls (user_id, short_code, long_url)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, short_code, long_url, created_at`,
            [user_id || null,  short_code, long_url]
        );

        const row = result.rows[0];
        const expires_at = new Date(new Date(row.created_at).getTime() + TTL_SECONDS * 1000).toISOString();

        await redis.set(`url:${short_code}`, long_url, { EX: TTL_SECONDS });

        res.status(201).json({
            id: row.id,
            user_id: row.user_id,
            short_code: row.short_code,
            long_url: row.long_url,
            created_at: row.created_at,
            expires_at,
            expires_in_seconds: TTL_SECONDS,
            short_url: `${process.env.BASE_URL}/${short_code}`,
        });
    } catch (error) {
        console.error("Error shortening URL:", error.message);
        res.status(500).json({error: "Internal server error"});
    }
})

purgeExpiredUrls();
setInterval(purgeExpiredUrls, 15_000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});