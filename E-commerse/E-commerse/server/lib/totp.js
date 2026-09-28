/* TOTP (RFC 6238) built on Node's crypto only — no external package needed. */
const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function randomBase32Secret(bytes = 15) {
    const buf = crypto.randomBytes(bytes);
    let bits = "";
    for (const b of buf) bits += b.toString(2).padStart(8, "0");
    let out = "";
    for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
    return out;
}

function base32Decode(input) {
    const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = "";
    for (const ch of clean) bits += BASE32_ALPHABET.indexOf(ch).toString(2).padStart(5, "0");
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(bytes);
}

function hotp(secretBuf, counter) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac("sha1", secretBuf).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    return String(code % 1000000).padStart(6, "0");
}

/* Accepts a code valid for the current 30s window or one step either side, to allow for clock drift. */
function verify(base32Secret, code, step = 30, window = 1) {
    const clean = String(code || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(clean)) return false;
    const secretBuf = base32Decode(base32Secret);
    const counter = Math.floor(Date.now() / 1000 / step);
    for (let i = -window; i <= window; i++) {
        if (hotp(secretBuf, counter + i) === clean) return true;
    }
    return false;
}

function otpauthUrl(secret, email, issuer = "ShopEase") {
    const label = encodeURIComponent(`${issuer}:${email}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/* Free public QR image renderer — just an <img src>, no package or account needed. */
function qrImageUrl(otpauth) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauth)}`;
}

/* Generates the current 6-digit code for a secret. Useful for tests. */
function currentCode(base32Secret, step = 30) {
    return hotp(base32Decode(base32Secret), Math.floor(Date.now() / 1000 / step));
}

module.exports = { randomBase32Secret, verify, otpauthUrl, qrImageUrl, currentCode };
