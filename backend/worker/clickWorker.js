import { Worker } from "bullmq";
import { query } from "../db.js";


const connection = {
    host: "localhost",
    port: 6379,
};


const worker = new Worker(
    "click-logs",
    async (job) => {
        const { short_code, ip, user_agent, referrer, country, clicked_at } = job.data;

        await query(
            `INSERT INTO clicks (short_code, ip, user_agent, referrer, country, clicked_at) VALUES ($1, $2, $3, $4, $5, $6)`,
            [short_code, ip, user_agent, referrer, country, clicked_at]
        );

    },
    { connection }
);


worker.on("completed", (job) => {
    console.log(`Click job ${job.id} completed`);
});


worker.on("failed", (job, err) => {
    console.log(`Click job failed: ${job?.id}`, err.message);
});


console.log("Click worker is running...");