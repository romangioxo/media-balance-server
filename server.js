// server.js
import express from "express";
import Parser from "rss-parser";
import pg from "pg";

const app = express();
const parser = new Parser();
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

app.get("/health", (_, res) => res.send("ok"));

app.get("/", (_, res) => res.send("Media Balance backend работает."));

app.get("/catalog", async (_, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM articles_catalog ORDER BY created_at DESC LIMIT 20"
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "catalog_failed" });
  }
});

async function ingestFeeds() {
  const feeds = [
    { name: "MIT Sloan", url: "https://sloanreview.mit.edu/feed/" },
    { name: "The Atlantic", url: "https://www.theatlantic.com/feed/all/" },
    { name: "Aeon", url: "https://aeon.co/feed.rss" }
  ];
  for (const f of feeds) {
    const feed = await parser.parseURL(f.url);
    for (const item of (feed.items || []).slice(0, 5)) {
      await db.query(
        `INSERT INTO articles_catalog (url, title, source, summary, read_time_min)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (url) DO NOTHING`,
        [item.link, item.title, f.name, item.contentSnippet ?? "", 5]
      );
    }
  }
}

// поддерживаем и POST, и GET для удобства
app.post("/ingest", async (_, res) => {
  try {
    await ingestFeeds();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "ingest_failed" });
  }
});

app.get("/ingest", async (_, res) => {
  try {
    await ingestFeeds();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "ingest_failed" });
  }
});

const PORT = process.env.PORT || 3000; // важно для Render
app.listen(PORT, () => console.log(`Media Balance listening on ${PORT}`));

