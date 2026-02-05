import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import { FastifySSEPlugin } from "fastify-sse-v2";
import { streamer } from "./services/streamer";
import { worker } from "./services/worker";
import {
  incrementHeart,
  getActiveMappers,
  getRecentChangesets,
} from "./services/store";

let activeWatchers = 0;

const server = Fastify({
  logger: true,
});

const extractHashtag = (text: string | undefined) => {
  if (!text) return "";
  const match = text.match(/(^|\s)(#[A-Za-z0-9_-]+)/);
  return match ? match[2] : "";
};

const renderChangeset = (data: any) => {
  const hashtag = extractHashtag(data.summary);
  const comment = data.summary ? `<br>${data.summary}` : "";
  return `
        <div class="changeset" id="cs-${data.id}" data-lat="${data.lat}" data-lon="${data.lon}" data-hashtag="${hashtag}" data-user="${data.user}">
             <div class="info">
                <strong>${data.user}</strong> mapped <span class="time-ago" data-time="${data.processedAt}">just now</span> in ${data.location} <span class="hearts" id="hearts-${data.id}" onclick="thank(${data.id})">&#x2661; ${data.hearts}</span>${comment}
             </div>
        </div>
    `
    .replace(/\n/g, "")
    .trim();
};

server.register(FastifySSEPlugin);

server.register(fastifyStatic, {
  root: path.join(__dirname, "../src/public"),
  prefix: "/",
});

server.get("/stream", (req, res) => {
  activeWatchers++;
  res.sse({ event: "message", data: "Connected" });

  // Keep-alive heartbeat to prevent timeouts
  const keepAlive = setInterval(() => {
    res.sse({ event: "ping", data: "KA" });
  }, 15000);

  const onChangeset = (data: any) => {
    // Send HTML fragment for HTMX
    // Or just JSON if using client-side templating?
    // Prompt said "fastify on backend and htmx on frontend", implying HTML fragments are good.
    // But also "streams recent changesets to a list... New changesets stream and fade onto the page".
    const html = renderChangeset(data);
    // Sending as 'message' event.
    // HTMX sse extension expects the payload to be the HTML to swap?
    // If using sse-swap="message", yes.
    res.sse({ event: "message", data: html });
  };

  const recent = getRecentChangesets(40).slice().reverse();
  for (const cs of recent) {
    const html = renderChangeset(cs);
    res.sse({ event: "message", data: html });
  }

  streamer.on("changeset", onChangeset);

  req.raw.on("close", () => {
    activeWatchers--;
    clearInterval(keepAlive);
    streamer.off("changeset", onChangeset);
  });
});

server.get("/stats", () => {
  return { mappers: getActiveMappers(), watchers: activeWatchers };
});

server.post("/thank/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const hearts = incrementHeart(parseInt(id));
  // Return just the heart count / HTML update?
  // HTMX request.
  return `&#x2764; ${hearts}`;
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "3000", 10);
    const address = await server.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on ${address}`);
    worker.start();
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
