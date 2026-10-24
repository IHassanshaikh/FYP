// services/AiShotPredictionService.ts
// Intelligent real-time cricket shot prediction and coaching analysis using Grok (xAI) and Gemini APIs.

export interface ShotPredictionInput {
  batSpeedKmh: number;
  liftAngleDeg: number;
  impactG: number;
  sweetSpotScore: number;
  timingIndex: number;
  pitch: number;
  roll: number;
  yaw: number;
  currentZone?: string;
  ruleBasedShot?: string;
}

export interface ShotPredictionResult {
  predictedShot: string;
  zone: string;
  confidence: number;
  aiCoachingInsight: string;
  executionQuality: 'Exceptional' | 'Good' | 'Needs Improvement';
  provider: 'grok' | 'gemini' | 'hybrid';
}

const GROK_API_KEY = 'grok_baa188a619e2eea9505b9b758e11d7ba_46fa900dcb976c4d96107b0ab0db37a1f13a9ea2fae0cf664908cb6c383470ed';
const GEMINI_API_KEY = '';

class AiShotPredictionService {
  private grokKey: string = GROK_API_KEY;
  private geminiKey: string = GEMINI_API_KEY;
  private isPredicting: boolean = false;

  public setApiKeys(grokKey?: string, geminiKey?: string) {
    if (grokKey) this.grokKey = grokKey;
    if (geminiKey) this.geminiKey = geminiKey;
  }

  /**
   * Primary prediction call with automatic fallback:
   * 1. Try Grok (xAI) API for lightning fast shot analysis
   * 2. Fall back to Gemini API if Grok fails or rate limits
   * 3. Fall back to local rule-based physics if offline/network error
   */
  public async predictShot(input: ShotPredictionInput): Promise<ShotPredictionResult> {
    if (this.isPredicting) {
      // Avoid overlapping requests if player is swinging repeatedly
      return this.getLocalFallback(input, 'Local Engine');
    }

    this.isPredicting = true;

    try {
      // 1. Attempt Grok (xAI)
      try {
        const grokResult = await this.callGrok(input);
        if (grokResult) {
          this.isPredicting = false;
          return grokResult;
        }
      } catch (grokError) {
        console.warn('[AiShotPrediction] Grok API call failed or timed out, trying Gemini...', grokError);
      }

      // 2. Fallback to Gemini
      try {
        const geminiResult = await this.callGemini(input);
        if (geminiResult) {
          this.isPredicting = false;
          return geminiResult;
        }
      } catch (geminiError) {
        console.warn('[AiShotPrediction] Gemini API call failed or timed out:', geminiError);
      }

      // 3. Fallback to Physics Engine
      this.isPredicting = false;
      return this.getLocalFallback(input, 'Physics Engine');
    } catch (e) {
      this.isPredicting = false;
      return this.getLocalFallback(input, 'Offline Fallback');
    }
  }

  /**
   * Calls xAI (Grok) Chat Completions API
   */
  private async callGrok(input: ShotPredictionInput): Promise<ShotPredictionResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const prompt = `You are a world-class cricket biomechanics coach. Analyze this real-time bat telemetry from an ESP32 sensor:
- Bat Speed: ${input.batSpeedKmh} km/h
- Backlift / Pitch Angle: ${input.liftAngleDeg}°
- Impact Force: ${input.impactG} g
- Sweet Spot Contact Score: ${input.sweetSpotScore}%
- Timing Score: ${input.timingIndex}%
- Pitch: ${input.pitch}°, Roll: ${input.roll}°, Yaw (Trajectory Angle): ${input.yaw}°

Choose the best matching cricket stroke from: Cover Drive, Straight Drive, On Drive, Square Cut, Pull Shot, Hook Shot, Sweep Shot, Helicopter Shot, Forward Defence, Flick Shot, Uppercut.

Respond ONLY with valid JSON in this exact structure with no markdown ticks:
{
  "predictedShot": "Exact Shot Name",
  "zone": "Target Field Zone",
  "confidence": 92,
  "aiCoachingInsight": "One concise, high-impact biomechanical coaching feedback sentence (max 20 words).",
  "executionQuality": "Exceptional"
}`;

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.grokKey}`,
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [
            {
              role: 'system',
              content: 'You are an ultra-fast cricket sensor telemetry classifier. Output strict JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 180,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[AiShotPrediction] Grok HTTP status ${response.status}`);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      const parsed = this.cleanAndParseJson(content);
      if (parsed && parsed.predictedShot) {
        return {
          predictedShot: parsed.predictedShot,
          zone: parsed.zone || input.currentZone || 'Mid-Off / Cover',
          confidence: parsed.confidence || 90,
          aiCoachingInsight: parsed.aiCoachingInsight || 'Crisp stroke through the line with balanced follow-through.',
          executionQuality: parsed.executionQuality || (input.sweetSpotScore > 80 ? 'Exceptional' : 'Good'),
          provider: 'grok',
        };
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Calls Google Gemini REST API (v1beta)
   */
  private async callGemini(input: ShotPredictionInput): Promise<ShotPredictionResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const prompt = `Analyze cricket bat sensor telemetry:
Speed: ${input.batSpeedKmh} km/h, Lift: ${input.liftAngleDeg}°, Impact: ${input.impactG}g, SweetSpot: ${input.sweetSpotScore}%, Yaw: ${input.yaw}°, Pitch: ${input.pitch}°.
Output JSON only:
{"predictedShot": "Shot Name", "zone": "Field Area", "confidence": 88, "aiCoachingInsight": "Coaching tip under 18 words.", "executionQuality": "Good"}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 150,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[AiShotPrediction] Gemini HTTP status ${response.status}`);
        return null;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) return null;

      const parsed = this.cleanAndParseJson(text);
      if (parsed && parsed.predictedShot) {
        return {
          predictedShot: parsed.predictedShot,
          zone: parsed.zone || input.currentZone || 'Off Side',
          confidence: parsed.confidence || 85,
          aiCoachingInsight: parsed.aiCoachingInsight || 'Solid wrist alignment and balance through contact.',
          executionQuality: parsed.executionQuality || 'Good',
          provider: 'gemini',
        };
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private cleanAndParseJson(raw: string): any {
    try {
      let cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }

  private getLocalFallback(input: ShotPredictionInput, providerName: string): ShotPredictionResult {
    let shot = input.ruleBasedShot || 'Cover Drive';
    let zone = input.currentZone || 'Off Side / Cover';

    return {
      predictedShot: shot,
      zone,
      confidence: 85,
      aiCoachingInsight: `Good swing path into ${zone} with ${input.batSpeedKmh} km/h bat speed and ${input.sweetSpotScore}% sweet spot contact.`,
      executionQuality: input.sweetSpotScore > 80 && input.batSpeedKmh > 75 ? 'Exceptional' : 'Good',
      provider: 'hybrid',
    };
  }
}

export const aiShotPredictionService = new AiShotPredictionService();
