/**
 * camera.service.js — ONE connection to the phone, shared by every viewer.
 *
 * DroidCam serves a single MJPEG stream and refuses a second client ("busy"),
 * so the backend is the only client. Browsers get frames from here and never
 * talk to the phone. The phone connection opens when the first viewer arrives
 * and closes shortly after the last one leaves.
 */

const http = require("http");

const SOURCE_URL =
  process.env.CAMERA_SOURCE_URL || "http://10.199.134.199:4747/video";
const BOUNDARY = "plcframe";
const IDLE_GRACE_MS = 10_000; // keep the phone connection this long after the last viewer leaves
const RETRY_MS = 3_000; // wait between reconnect attempts while someone is watching
const STALL_MS = 8_000; // no bytes from the phone for this long = dead connection
const MAX_BUFFER_BYTES = 5 * 1024 * 1024; // guard against a runaway buffer

const SOI = Buffer.from([0xff, 0xd8]); // JPEG start marker
const EOI = Buffer.from([0xff, 0xd9]); // JPEG end marker

const viewers = new Set(); // Express response objects
let upstream = null; // the one request to the phone
let state = "idle"; // idle | connecting | live | offline
let buffer = Buffer.alloc(0);
let lastFrame = null;
let retryTimer = null;
let idleTimer = null;
let lastFailReason = "";

// ---------- frames -----------------------------------------------------------

function writeFrame(res, frame) {
  if (res.writableNeedDrain) return; // slow viewer: drop this frame, don't queue memory
  res.write(
    `--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`,
  );
  res.write(frame);
  res.write("\r\n");
}

/** Cut the phone's byte stream into complete JPEG frames and hand each to every viewer. */
function onChunk(chunk) {
  buffer = Buffer.concat([buffer, chunk]);

  for (;;) {
    const start = buffer.indexOf(SOI);
    if (start === -1) {
      buffer = buffer.subarray(Math.max(0, buffer.length - 1)); // keep a possible half marker
      return;
    }
    const end = buffer.indexOf(EOI, start + 2);
    if (end === -1) {
      buffer = buffer.subarray(start); // drop junk before the frame start
      if (buffer.length > MAX_BUFFER_BYTES) buffer = Buffer.alloc(0);
      return;
    }

    const frame = Buffer.from(buffer.subarray(start, end + 2));
    buffer = buffer.subarray(end + 2);

    lastFrame = frame;
    state = "live";
    lastFailReason = "";
    for (const res of viewers) writeFrame(res, frame);
  }
}

// ---------- connection to the phone -----------------------------------------

function connect() {
  if (upstream || !SOURCE_URL) return;
  state = "connecting";
  buffer = Buffer.alloc(0);

  const req = http.get(SOURCE_URL, (res) => {
    const type = String(res.headers["content-type"] || "");
    // The "busy" page comes back as HTML, not as a video stream.
    if (res.statusCode !== 200 || !/multipart|image\//i.test(type)) {
      res.resume();
      dead(
        `no video stream (HTTP ${res.statusCode}, ${type || "no content-type"}) - busy?`,
      );
      return;
    }
    res.on("data", onChunk);
    res.on("end", () => dead("stream ended"));
    res.on("error", (err) => dead(err.message));
  });

  // Only react to failures of THIS request, never of an older, replaced one.
  const dead = (reason) => {
    if (upstream === req) fail(reason);
  };

  req.setTimeout(STALL_MS, () =>
    req.destroy(new Error("no data from the camera")),
  );
  req.on("error", (err) => dead(err.message));
  upstream = req;
}

function fail(reason) {
  if (upstream) {
    upstream.destroy();
    upstream = null;
  }
  state = "offline";
  lastFrame = null;
  if (reason !== lastFailReason) {
    console.warn(`[camera] upstream lost: ${reason}`);
    lastFailReason = reason;
  }
  scheduleRetry();
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  if (viewers.size === 0) return; // nobody watching: stay disconnected
  retryTimer = setTimeout(connect, RETRY_MS);
}

function disconnect() {
  clearTimeout(retryTimer);
  if (upstream) {
    upstream.destroy();
    upstream = null;
  }
  state = "idle";
  lastFrame = null;
  buffer = Buffer.alloc(0);
}

// ---------- viewers ------------------------------------------------------------

function removeViewer(res) {
  viewers.delete(res);
  if (viewers.size === 0) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(disconnect, IDLE_GRACE_MS);
  }
}

/** GET /camera/stream — keep the response open and push frames into it. */
function attach(req, res) {
  if (!SOURCE_URL) {
    res.status(503).json({ error: "CAMERA_SOURCE_URL is not set" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  viewers.add(res);
  clearTimeout(idleTimer);
  if (lastFrame) writeFrame(res, lastFrame); // show something immediately
  if (!upstream) {
    clearTimeout(retryTimer);
    connect();
  }

  req.on("close", () => removeViewer(res));
  res.on("error", () => removeViewer(res));
}

function getStatus() {
  return { configured: Boolean(SOURCE_URL), state, viewers: viewers.size };
}

function stop() {
  clearTimeout(idleTimer);
  disconnect();
  for (const res of viewers) res.end();
  viewers.clear();
}

module.exports = { attach, getStatus, stop };
