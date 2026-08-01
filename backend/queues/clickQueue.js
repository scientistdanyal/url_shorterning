import { Queue } from "bullmq";


// redis connection settings for BullMQ


const connection = {
    host: "localhost",
    port: 6379,
}

// named queue: all click-log jobs go into "click-logs"
export const clickQueue = new Queue("click-logs", { connection});



// helper used by the redirect rout to enqueue one click event

export async function enqueueClick(clickData) {

    await clickQueue.add("click-log", clickData, {
        removeOnComplete: true, // delete job after completion
        removeOnFail: 100, // keep last 100 failed jobs for debugging
    });
}
