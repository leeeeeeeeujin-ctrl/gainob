const crypto = require("node:crypto");

const SESSION_COOKIE_NAME = "gainob_session";

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString("hex"));
    });
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt);

  return `${salt}:${hash}`;
}

async function verifyPassword(password, storedValue) {
  const [salt, expectedHash] = String(storedValue || "").split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const passwordHash = await scryptAsync(password, salt);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const passwordBuffer = Buffer.from(passwordHash, "hex");

  if (expectedBuffer.length !== passwordBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, passwordBuffer);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, chunk) => {
    const [rawName, ...rest] = chunk.trim().split("=");

    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

function getSessionTokenFromRequest(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || null;
}

function buildSessionCookie(token, secure) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000"
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function buildExpiredSessionCookie(secure) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function shouldUseSecureCookies(request) {
  return request.secure || request.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
}

module.exports = {
  SESSION_COOKIE_NAME,
  hashToken,
  hashPassword,
  verifyPassword,
  createSessionToken,
  getSessionTokenFromRequest,
  buildSessionCookie,
  buildExpiredSessionCookie,
  shouldUseSecureCookies
};
