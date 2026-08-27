/**
 * Endpoint de busca da consulta de instituições.
 *
 * - A base do BC fica no servidor; o navegador recebe só os resultados
 *   (máx. 20 por consulta) — nada de megabytes de base no cliente.
 * - O termo pesquisado NÃO é registrado em log nem enviado a analytics.
 * - Rate limit leve em memória (melhor esforço em serverless): protege
 *   contra abuso sem atrapalhar uso legítimo.
 * - Indisponibilidade da fonte retorna 503 "unavailable" — o cliente
 *   distingue obrigatoriamente de "não encontrado".
 */

import { NextResponse, type NextRequest } from "next/server";
import { getInstitutions } from "@/lib/bcb/institutions-service";
import {
  formatCnpj,
  isValidCnpj,
  looksLikeCnpj,
  searchInstitutions,
} from "@/lib/institutions/search";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 120;
const RATE_LIMIT = 30; // consultas por minuto por IP
const rateWindow = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateWindow.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    rateWindow.set(ip, { count: 1, windowStart: now });
    if (rateWindow.size > 5000) rateWindow.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  const raw = request.nextUrl.searchParams.get("q") ?? "";
   
  const query = raw.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 3) {
    return NextResponse.json({ status: "query_too_short" }, { status: 400 });
  }

  // CNPJ com dígitos verificadores inválidos: barrar antes da busca.
  if (looksLikeCnpj(query)) {
    const digits = query.toUpperCase().replace(/[.\-/\s]/g, "");
    if (digits.length === 14 && !isValidCnpj(digits)) {
      return NextResponse.json({ status: "invalid_cnpj" });
    }
    if (digits.length !== 14) {
      return NextResponse.json({ status: "incomplete_cnpj" });
    }
  }

  const data = await getInstitutions();
  if (data.status === "unavailable") {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }

  const { snapshot } = data;
  const outcome = searchInstitutions(snapshot.index, query);

  return NextResponse.json({
    status: "ok",
    mode: outcome.mode,
    partial: snapshot.partial,
    fetchedAt: snapshot.fetchedAt,
    totalRecords: snapshot.totalRecords,
    matches: outcome.matches.map((m) => ({
      id: m.record.id,
      name: m.record.name,
      shortName: m.record.shortName ?? null,
      cnpj:
        m.record.cnpjDigits && m.record.cnpjDigits.length === 14
          ? formatCnpj(m.record.cnpjDigits)
          : null,
      cnpjKind:
        m.record.cnpjDigits === null
          ? "none"
          : m.record.cnpjDigits.length === 14
            ? "full"
            : "root",
      type: m.record.type,
      uf: m.record.uf,
      municipio: m.record.municipio,
      situacao: m.record.situacao,
      sourceLabel: m.record.sourceLabel,
      quality: m.quality,
    })),
  });
}
