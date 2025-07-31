/*  /pages/api/elevenlabs/webhook.ts
 *  Post-call webhook van ElevenLabs
 *  - HMAC-controle
 *  - Transcript + resultaatcode in ❱  public.gesprekken
 *  - Log-record in ❱  public.logs
 *  (voeg later gerust meer kolommen/relaties toe)
 * ------------------------------------------------------------------ */

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import getRawBody from "raw-body";
import { createClient } from "@supabase/supabase-js";

/* ───────────────────────────────── helpers ──────────────────────── */

async function raw(req: NextApiRequest) {
  return getRawBody(req); // Buffer
}

function validSig(rawBody: Buffer, sigHdr: string | undefined, secret: string) {
  if (!sigHdr) return false;

  // header-vorm:  t=<unix>,v0=<hex>
  const hex    = sigHdr.split(",").find((p) => p.startsWith("v0="))?.slice(3);
  if (!hex) return false;

  const calc = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hex), Buffer.from(calc));
}

/* ─────────────────────────────── handler ────────────────────────── */

export default async function webhook(
  req: NextApiRequest,
  res: NextApiResponse
) {
  /* ── CORS / alleen POST ───────────────────────────────────────── */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  /* ── ruwe body + HMAC ─────────────────────────────────────────── */
  const rawBody  = await raw(req);
  const sig      = req.headers["elevenlabs-signature"] as string | undefined;
  const secret   = process.env.ELEVENLABS_WEBHOOK_SECRET!;

  if (!validSig(rawBody, sig, secret)) {
    console.error("❌  Webhook – ongeldige signature");
    return res.status(401).json({ error: "invalid signature" });
  }

  /* ── payload ──────────────────────────────────────────────────── */
  const p = JSON.parse(rawBody.toString());

  // We verwerken alleen het einde-event
  if (p.event_type !== "conversation_completed") {
    return res.status(200).json({ ignored: p.event_type });
  }

  /* ── Supabase client ──────────────────────────────────────────── */
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service-role → INSERT-rechten
    { auth: { persistSession: false } }
  );

  /* ── 1. gesprek wegschrijven ──────────────────────────────────── */
  const { data: gesprekRow, error: gErr } = await supabase
    .from("gesprekken")
    .insert({
      datum:          new Date(),         // date default ok, maar nu = start
      tijdslot:       new Date(),         // simple timestamp
      opmerkingen:    p.transcript_text ?? "",
      resultaatcode:  p.result_code ?? "",
      status:         "afgerond"
      // klant_id / verkoper_id / ...  kun je hier koppelen als je die info hebt
    })
    .select("id")        // we willen de PK terug
    .single();

  if (gErr) {
    console.error("❌  Supabase - gesprek INSERT", gErr);
    return res.status(500).json({ error: "db error (gesprekken)" });
  }

  /* ── 2. log-record (altijd handig) ─────────────────────────────── */
  await supabase.from("logs").insert({
    type:       "webhook",
    status:     "success",
    message:    "conversation_completed",
    data:       p,                       // volledige JSON-payload
    twilio_sid: p.call_sid ?? null
  });

  /* (optioneel) 3. verkoop_resultaten koppelen
   * ---------------------------------------------------------------
   * Resultaatcode staat al in gesprekken.resultaatcode.
   * Wil je ook een rij in  verkoop_resultaten, haal
   * hieronder de comments weg ↓
   */
  // if (p.result_code) {
  //   await supabase.from("verkoop_resultaten").insert({
  //     gesprek_id:   gesprekRow.id,
  //     resultaatcode:p.result_code,
  //     notitie:      null
  //   });
  // }

  return res.status(200).json({ ok: true, gesprek_id: gesprekRow.id });
}