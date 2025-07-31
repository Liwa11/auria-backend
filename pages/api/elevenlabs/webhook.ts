/*  /pages/api/elevenlabs/webhook.ts
 *
 *  Post-call webhook van ElevenLabs
 *  - controleert HMAC-handtekening
 *  - leest JSON-payload
 *  - schrijft resultaat naar tabel “gesprekken” in Supabase
 *  - geeft 200 terug zodat ElevenLabs tevreden is
 * ------------------------------------------------------------------ */

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import getRawBody from "raw-body";
import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------- helpers -- */

async function getRaw(req: NextApiRequest) {
  // raw-body geeft een Buffer terug (hier niet gzip-gecomprimeerd)
  return await getRawBody(req);
}

/** Controleer de `elevenlabs-signature` header op geldige HMAC */
function verifySignature(
  rawBody: Buffer,
  sigHeader: string | undefined,
  secret: string
) {
  if (!sigHeader) return false;

  /* header-formaat:  t=<unix>,v0=<hex-hmac>  */
  const parts = sigHeader.split(",");
  const hex = parts.find((p) => p.startsWith("v0="))?.slice(3);
  if (!hex) return false;

  const calc = crypto
    .createHmac("sha256", secret)
    .update(rawBody) // belangrijk: ruwe body, NIET JSON.stringify
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hex), Buffer.from(calc));
}

/* ---------------------------------------------------- API-handler -- */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  /* CORS + alleen POST --------------------------------------------- */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  /* Ruwe body & header --------------------------------------------- */
  const rawBody = await getRaw(req);
  const sigHeader = req.headers["elevenlabs-signature"] as string | undefined;

  if (
    !verifySignature(
      rawBody,
      sigHeader,
      process.env.ELEVENLABS_WEBHOOK_SECRET!
    )
  ) {
    console.error("Invalid HMAC");
    return res.status(401).json({ error: "invalid signature" });
  }

  /* Payload parsen -------------------------------------------------- */
  const payload = JSON.parse(rawBody.toString());

  // We reageren alleen op het einde-event
  if (payload.event_type !== "conversation_completed") {
    return res.status(200).json({ ignored: payload.event_type });
  }

  /* Supabase client ------------------------------------------------- */
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service-role → mag altijd INSERT
    {
      auth: { persistSession: false }
    }
  );

  /* Data wegschrijven ---------------------------------------------- */
  const { error } = await supabase.from("gesprekken").insert({
    // === VELDEN AANPASSEN aan je eigen kolomnamen / relaties =========
    datum: new Date(),                         // of payload.start_time
    klant_id: null,                            // koppel als je kunt
    resultaatcode: payload.result_code ?? "",  // bv. "100"
    opmerkingen: payload.transcript_text ?? "",// volledig transcript
    status: "afgerond",
    twilio_sid: payload.call_sid ?? null,
    conversation_id: payload.conversation_id ?? null
  });

  if (error) {
    console.error("Supabase insert error", error);
    return res.status(500).json({ error: "db insert failed" });
  }

  return res.status(200).json({ ok: true });
}