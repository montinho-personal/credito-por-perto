import path from "node:path";

export const CONTENT_ROOT = path.join(process.cwd(), "content");

export const ARTICLES_DIR = path.join(CONTENT_ROOT, "articles");
export const LOCAL_GUIDES_DIR = path.join(CONTENT_ROOT, "local-guides");
export const AUTHORS_DIR = path.join(CONTENT_ROOT, "authors");
export const BRIEFINGS_DIR = path.join(CONTENT_ROOT, "briefings");
export const SOURCE_LEDGERS_DIR = path.join(CONTENT_ROOT, "sources");
export const LOCAL_DOSSIERS_DIR = path.join(CONTENT_ROOT, "local-dossiers");
export const DATA_DIR = path.join(process.cwd(), "data");
