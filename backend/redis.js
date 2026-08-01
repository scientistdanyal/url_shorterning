import { createClient } from "redis";

import dotenv from "dotenv";


dotenv.config();



// create a client pointed at your radis server

const redis = createClient({
    url: process.env.REDIS_URL,
});

redis.on("error", (err) => {
    console.error("Redis connection error:", err.message);
});

await redis.connect();
console.log("Connected to Redis");


export default redis;