import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redis from "../redis.js";





export const shortenLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,



    // cusotm json body when blocked

message: {
    error: "Too many requests, please try again later."
},
 

store: new RedisStore({
    //sendCommand talks to your node-redis client
    sendCommand: (...args) => redis.sendCommand(args),
    prefix: "rl:shorten:" // redis key prefix for this limiter
}),


})




