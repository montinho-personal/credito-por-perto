/**
 * Gera public/search-index.json com os documentos da busca client-side.
 * Roda no build (pnpm search:index) — novos artigos e guias publicados
 * entram automaticamente. Nada é enviado a servidor em tempo de busca.
 */
import fs from "node:fs";
import path from "node:path";
import { buildSearchDocs } from "../src/lib/search/build-docs";

const docs = buildSearchDocs();
const outPath = path.join(process.cwd(), "public", "search-index.json");
fs.writeFileSync(outPath, JSON.stringify(docs));
const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
console.log(
  `Índice de busca: ${docs.length} documentos, ${sizeKb} KB em ${outPath}`,
);
