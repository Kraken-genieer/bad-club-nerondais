#!/usr/bin/env node
// Robot FFBad - recupere les dernieres actualites (titre + lien + extrait)
// depuis https://www.ffbad.org/actualites et ecrit ffbad-actus.json.
// Aucune dependance : Node 18+ (fetch integre). Lance 1x/jour par GitHub Actions.
// Voir README-deploiement.md pour la mise en place.

import { writeFileSync } from "node:fs";

const SOURCE = "https://www.ffbad.org/actualites";
const BASE = "https://www.ffbad.org";
const OUT = process.env.FFBAD_OUT || "ffbad-actus.json"; // adapter au dossier publie du site
const MAX = 6;

// Nettoyage du HTML -> texte lisible (retire les balises, decode les entites courantes)
function clean(s) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const res = await fetch(SOURCE, { headers: { "User-Agent": "BCN18-actus-bot/1.0" } });
  if (!res.ok) throw new Error(`FFBad a repondu ${res.status}`);
  // FFBad renvoie de l'UTF-8 mais un Content-Type sans charset fiable : on force l'UTF-8
  // (sinon les accents ressortent en mojibake type "PalmarÃ¨s").
  const html = new TextDecoder("utf-8").decode(await res.arrayBuffer());

  // Chaque article apparait plusieurs fois (image, titre, extrait) avec la meme URL.
  // On capture toutes les ancres pointant vers /actualites/.../ANNEE/slug puis on regroupe par URL.
  const re =
    /<a[^>]*href="([^"]*\/actualites\/(?:actualites\/)?20\d\d\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const map = new Map();
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const txt = clean(m[2]);
    if (!map.has(href)) map.set(href, []);
    if (txt) map.get(href).push(txt);
  }

  const articles = [];
  for (const [href, texts] of map) {
    if (articles.length >= MAX) break;
    if (texts.length === 0) continue;
    // Le titre = le 1er texte court (<=140), l'extrait = le 1er texte long (>140)
    const titre = texts.find((t) => t.length <= 140) || texts[0];
    const long = texts.find((t) => t.length > 140) || "";
    const extrait = long ? long.slice(0, 200).trim() + (long.length > 200 ? "…" : "") : "";
    const lien = href.startsWith("http") ? href : BASE + href;
    articles.push({ titre, extrait, lien, source: "FFBad" });
  }

  if (articles.length === 0) {
    throw new Error("Aucun article extrait - la structure du site FFBad a peut-etre change.");
  }

  const payload = { maj: new Date().toISOString(), source: SOURCE, articles };
  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`OK - ${articles.length} actualites ecrites dans ${OUT}`);
}

main().catch((e) => {
  console.error("Echec du robot FFBad :", e.message);
  process.exit(1);
});
