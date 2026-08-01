import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { query } from "./db.js";
import { generateShortCode } from "./utils/shortCode.js";
import redis from "./redis.js";
import { enqueueClick } from "./queues/clickQueue.js";
import { shortenLimiter } from "./middleware/rateLimit.js";

dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

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


        // try redis first
        let long_url = await redis.get(cacheKey);
        // if cache miss -> db
        if (!long_url) {
            const result = await query(
                `SELECT long_url from urls WHERE short_code = $1`,
                [shortCode]
            );

            if (result.rows.length == 0) {
                return res.status(404).json({error: "Short URL not found"});
            }

            long_url = result.rows[0].long_url;
            await redis.set(cacheKey, long_url, {EX: 60 * 60 * 24}); // cache for 1 hour
        };

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


        res.status(201).json({
            id: row.id,
            user_id: row.user_id,
            short_code: row.short_code,
            long_url: row.long_url,
            created_at: row.created_at,
            short_url: `${process.env.BASE_URL}/${short_code}`,
        })
        if (result.rows.length === 0) {
            return res.status(500).json({error: "Failed to shorten URL"});
        }

        const short_url = `${process.env.BASE_URL}/${short_code}`;
        res.json({short_url});
    } catch (error) {}
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});