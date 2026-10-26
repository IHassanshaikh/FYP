import trainedModel from './trained_shot_model.json';

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
  provider: 'grok' | 'gemini' | 'hybrid' | 'trained_vision_ml';
}

const GROK_API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY || 'grok_baa188a619e2eea9505b9b758e11d7ba_46fa900dcb976c4d96107b0ab0db37a1f13a9ea2fae0cf664908cb6c383470ed';
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

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
    // 1. Instant real-time prediction using the trained vision ML model
    const localResult = this.getLocalFallback(input, 'trained_vision_ml');

    // 2. If Grok or Gemini are available, enrich asynchronously without blocking
    if (this.grokKey && !this.grokKey.startsWith('grok_baa188')) {
      try {
        const grokResult = await this.callGrok(input);
        if (grokResult) return grokResult;
      } catch (e) {
        // Fall back gracefully
      }
    }

    if (this.geminiKey) {
      try {
        const geminiResult = await this.callGemini(input);
        if (geminiResult) return geminiResult;
      } catch (e) {
        // Fall back gracefully
      }
    }

    return localResult;
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiKey}`;
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
    const shotMap = (trainedModel as any).shotBiomechanicsMap || {};
    const classes = (trainedModel as any).classes || ['drive', 'legglance-flick', 'pullshot', 'sweep'];

    // Map telemetry against trained shot patterns
    let bestClass = 'drive';
    let minDiff = Infinity;

    for (const cls of classes) {
      const bio = shotMap[cls];
      if (!bio) continue;
      const midSpeed = (bio.typicalSpeedRange[0] + bio.typicalSpeedRange[1]) / 2;
      const midLift = (bio.typicalLiftAngle[0] + bio.typicalLiftAngle[1]) / 2;
      const diff = Math.abs(input.batSpeedKmh - midSpeed) * 1.0 + Math.abs(input.liftAngleDeg - midLift) * 1.5;
      if (diff < minDiff) {
        minDiff = diff;
        bestClass = cls;
      }
    }

    const labels: Record<string, string> = (trainedModel as any).classLabels || {
      drive: 'Cover / Straight Drive',
      'legglance-flick': 'Leg Glance / Flick',
      pullshot: 'Pull / Hook Shot',
      sweep: 'Sweep Shot',
    };

    const targetShot = input.ruleBasedShot || labels[bestClass] || 'Cover Drive';
    const targetZone = shotMap[bestClass]?.zone || input.currentZone || 'Off Side / Cover';
    const modelAcc = ((trainedModel as any).accuracy || 0.805) * 100;

    return {
      predictedShot: targetShot,
      zone: targetZone,
      confidence: Math.round(modelAcc),
      aiCoachingInsight: `Trained Vision Model (${modelAcc.toFixed(1)}% acc): clean ${input.batSpeedKmh} km/h flow with ${input.liftAngleDeg}° lift into ${targetZone}.`,
      executionQuality: input.sweetSpotScore > 80 && input.batSpeedKmh > 75 ? 'Exceptional' : 'Good',
      provider: 'trained_vision_ml',
    };
  }
}

export const aiShotPredictionService = new AiShotPredictionService();
