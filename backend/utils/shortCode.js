import crypto from "crypto";


const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 62 characters



export function generateShortCode(length = 7) {
    const bytes = crypto.randomBytes(length);
  
    let code = "";

    for (let i = 0; i < length; i++) {
        code += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return code;
}

