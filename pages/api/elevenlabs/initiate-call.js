// /pages/api/elevenlabs/initiate-call.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  
    const { klant_naam, klant_telefoon } = req.body;
  
    if (!klant_naam || !klant_telefoon) {
      return res.status(400).json({ message: 'Missing klant_naam or klant_telefoon' });
    }
  
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/conversation/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          agent_id: "YOUR_AGENT_ID", // ← Vul jouw eigen agent ID in
          phone_number: klant_telefoon,
          variables: {
            klant_naam: klant_naam
          },
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to initiate conversation');
      }
  
      return res.status(200).json({ message: 'Gesprek gestart', data });
    } catch (error) {
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  }