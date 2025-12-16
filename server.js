import express from "express";
import Parser from "rss-parser";
import pg from "pg";

const app = express();
const parser = new Parser();
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// 1️⃣ Главная проверка
app.get("/", (_, res) => res.send("Media Balance backend работает."));

// 2️⃣ Просмотр каталога
app.get("/catalog", async (_, res) => {
  const { rows } = await db.query("SELECT * FROM articles_catalog ORDER BY created_at DESC LIMIT 20");
  res.json(rows);
});

// 3️⃣ Загрузка статей из RSS
app.post("/ingest", async (_, res) => {
  const feeds = [
    { name: "MIT Sloan", url: "https://sloanreview.mit.edu/feed/" },
    { name: "The Atlantic", url: "https://www.theatlantic.com/feed/all/" },
    { name: "Aeon", url: "https://aeon.co/feed.rss" }
  ];

  for (const f of feeds) {
    const feed = await parser.parseURL(f.url);
    for (const item of feed.items.slice(0, 5)) {
      await db.query(
        `INSERT INTO articles_catalog (url, title, source, summary, read_time_min)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (url) DO NOTHING`,
        [item.link, item.title, f.name, item.contentSnippet ?? "", 5]
      );
    }
  }

  res.json({ success: true });
});

app.listen(3000, () => console.log("✅ Media Balance backend запущен"));
