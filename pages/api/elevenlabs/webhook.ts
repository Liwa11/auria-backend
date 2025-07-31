import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,   // server-side
  { auth: { persistSession: false } }
);

export const config = {
  api: { bodyParser: false }   // nodig voor raw body signature-check
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ---------- CORS ----------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")     return res.status(405).json({ error: "Method not allowed" });

  /* --------- HMAC-signature controleren --------- */
  const rawBody = await getRawBody(req);
  const sig = (req.headers["x-elevenlabs-signature"] as string || "").replace("SHA256=", "");
  const hmac = crypto.createHmac("sha256", process.env.ELEVENLABS_WEBHOOK_SECRET!)
                     .update(rawBody)
                     .digest("hex");
  if (sig !== hmac) return res.status(401).end("invalid signature");

  /* --------- Payload verwerken --------- */
  const payload = JSON.parse(rawBody.toString());

  // We verwerken alleen het einde-event; andere events kun je negeren OF loggen
  if (payload.event_type !== "conversation_completed")
    return res.status(200).json({ ignored: payload.event_type });

  const {
    call_sid,                      // ← komt uit ElevenLabs
    conversation_id,
    customer_name,
    to_number,
    transcript,                    // of payload.transcript_text
    result_code                    // als je dit al doorgeeft
  } = payload;

  // 1️⃣  Sla ruwe log altijd op (optioneel):
  await supabase.from("logs").insert({
    type:        "elevenlabs",
    status:      "webhook",
    message:     "conversation_completed",
    data:        payload,
    twilio_sid:  call_sid
  });

  // 2️⃣  Upsert in gesprekken / verkoop_resultaten
  //     → zoek gesprek op twilio_sid (= call_sid) of op klant_id
  const { data: gesprek } = await supabase
    .from("gesprekken")
    .select("id")
    .eq("twilio_sid", call_sid)
    .single();

  if (gesprek) {
    await supabase.from("gesprekken")
      .update({
        status:        "afgerond",
        resultaatcode: result_code ?? null,
        opmerkingen:   transcript
      })
      .eq("id", gesprek.id);
  } else {
    // fallback – nieuw gesprekrecord
    await supabase.from("gesprekken").insert({
      twilio_sid:    call_sid,
      datum:         new Date(),
      resultaatcode: result_code ?? null,
      opmerkingen:   transcript,
      status:        "afgerond"
    });
  }

  return res.status(200).json({ stored: true });
}

/* ---------- helper ---------- */
import getRaw from "raw-body";
function getRawBody(req: NextApiRequest) {
  return getRaw(req);
}