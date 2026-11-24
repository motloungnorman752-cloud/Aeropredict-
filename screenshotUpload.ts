import { RoundRecord, TrendAnalytics } from '../types';

export interface ScreenshotScanApiResponse {
  success: boolean;
  error?: string;
  rounds?: RoundRecord[];
  nextRoundNumber?: number;
  trends?: TrendAnalytics;
  appendedMultipliers?: number[];
  scan?: {
    ribbonLeftToRight: number[];
    activeCenterFlewAway: number | null;
    chronologicalMultipliers: number[];
    detectedPlatform: string;
    notes: string;
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export async function scanAviatorScreenshot(
  file: File,
  mode: 'SMART_MERGE' | 'REPLACE' = 'SMART_MERGE'
): Promise<ScreenshotScanApiResponse> {
  const imageBase64 = await fileToBase64(file);
  const res = await fetch('/api/aviator/scan-screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      mimeType: file.type || 'image/png',
      mode,
    }),
  });
  const data = (await res.json()) as ScreenshotScanApiResponse;
  if (!res.ok) {
    return {
      success: false,
      error: data?.error || `Scan failed (HTTP ${res.status})`,
    };
  }
  return data;
}
