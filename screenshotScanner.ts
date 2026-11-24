import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

function getGenAiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ScreenshotScanResult {
  ribbonLeftToRight: number[];
  activeCenterFlewAway: number | null;
  chronologicalMultipliers: number[];
  detectedPlatform: string;
  notes: string;
}

function sanitizeMultList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 1.0 && n <= 10000)
    .map((n) => Number(n.toFixed(2)));
}

export async function extractMultipliersFromScreenshot(
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<ScreenshotScanResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }

  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const safeMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/png';

  const prompt = `Analyze this crash game screenshot (e.g., [REDACTED_PROVIDER], [REDACTED_PROVIDER_2], [REDACTED_PROVIDER_6], [REDACTED_PROVIDER_3], [REDACTED_PROVIDER], or a cropped history bar).

Extract every visible crash multiplier accurately:
1. ribbonLeftToRight: Read the horizontal top history bar strictly from LEFT to RIGHT (ignore any AeroPredict panel on the left in split-screen; focus ONLY on the real casino game frame). On [REDACTED_PROVIDER]/[REDACTED_PROVIDER], left is newest, right is older.
2. activeCenterFlewAway: If the main center canvas shows "FLEW AWAY!" with a finished crash number (e.g. 7.41x), return that number; otherwise null.
3. chronologicalMultipliers: Order the extracted casino multipliers strictly OLDEST to NEWEST.
4. detectedPlatform: Casino name if visible (e.g. "[REDACTED_PROVIDER]", "[REDACTED_PROVIDER_2]", "[REDACTED_PROVIDER]").
5. notes: Brief 1-sentence summary of what you read.`;

  const requestConfig = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        ribbonLeftToRight: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
        },
        activeCenterFlewAway: {
          type: Type.NUMBER,
          nullable: true,
        },
        chronologicalMultipliers: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
        },
        detectedPlatform: { type: Type.STRING },
        notes: { type: Type.STRING },
      },
      required: ['ribbonLeftToRight', 'chronologicalMultipliers', 'detectedPlatform', 'notes'],
    },
  };

  const parts = [
    {
      inlineData: {
        mimeType: safeMime,
        data: cleanBase64,
      },
    },
    { text: prompt },
  ];

  const ai = getGenAiClient();
  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: { parts },
      config: {
        ...requestConfig,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
  } catch {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        ...requestConfig,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  }

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text);

  const ribbon = sanitizeMultList(parsed.ribbonLeftToRight);
  const centerVal =
    parsed.activeCenterFlewAway !== null &&
    parsed.activeCenterFlewAway !== undefined &&
    Number.isFinite(Number(parsed.activeCenterFlewAway)) &&
    Number(parsed.activeCenterFlewAway) >= 1.0
      ? Number(Number(parsed.activeCenterFlewAway).toFixed(2))
      : null;

  let chrono = sanitizeMultList(parsed.chronologicalMultipliers);
  if (chrono.length === 0 && ribbon.length > 0) {
    chrono = [...ribbon].reverse();
  }

  return {
    ribbonLeftToRight: ribbon,
    activeCenterFlewAway: centerVal,
    chronologicalMultipliers: chrono,
    detectedPlatform: String(parsed.detectedPlatform || '[REDACTED_PROVIDER]'),
    notes: String(parsed.notes || 'Extracted visible casino history multipliers.'),
  };
}
