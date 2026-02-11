import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { adjustValuationFromPhotoAnalysis, computeValuation } from '@/lib/valuation';

type VisionResult = {
  conditionScore: number;
  confidence: number;
  updateLevel: string;
  rehabTier: string;
  observedKitchen: 'updated' | 'average' | 'dated' | 'unknown';
  observedOverall: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  observedWaterIssues: 'yes' | 'no' | 'unknown';
  observedSystemRisk: 'none' | 'minor' | 'major' | 'unknown';
  observations: string[];
  flags: Record<string, unknown>;
};

const normalizeValuation = (valuation: any) => {
  if (!valuation) return null;
  return {
    ...valuation,
    baseline_market_value: Number(valuation.baseline_market_value),
    cash_offer_low: Number(valuation.cash_offer_low),
    cash_offer_high: Number(valuation.cash_offer_high),
    confidence: Number(valuation.confidence),
    pursue_score: Number(valuation.pursue_score),
    listing_net_estimate: Number(valuation.listing_net_estimate),
    explanation_bullets: Array.isArray(valuation.explanation_bullets)
      ? valuation.explanation_bullets
      : []
  };
};

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

function heuristicFromPhotoCount(photoCount: number): VisionResult {
  const conditionScore = Math.max(45, Math.min(95, 68 + photoCount * 2));
  const confidence = Math.min(0.92, 0.55 + photoCount * 0.04);
  const updateLevel =
    conditionScore > 85 ? 'Light cosmetics' : conditionScore > 70 ? 'Moderate refresh' : 'Full renovation';
  const rehabTier = conditionScore > 80 ? 'Tier 1' : conditionScore > 65 ? 'Tier 2' : 'Tier 3';

  return {
    conditionScore,
    confidence,
    updateLevel,
    rehabTier,
    observedKitchen: 'unknown',
    observedOverall: 'unknown',
    observedWaterIssues: 'unknown',
    observedSystemRisk: 'unknown',
    flags: {
      limited_photos: photoCount < 6,
      exterior_only_risk: photoCount > 0 && photoCount < 4,
      model: 'heuristic'
    },
    observations: [
      `Analyzed ${photoCount} photos from the latest upload batch.`,
      'Fallback heuristic used (no vision model configured).'
    ]
  };
}

async function runVisionAnalysis(imageUrls: string[]): Promise<VisionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || imageUrls.length === 0) return null;

  const inputContent: any[] = [
    {
      type: 'input_text',
      text:
        'You are a residential real-estate condition analyst. Score visible condition from photos only. Return strict JSON only.'
    },
    {
      type: 'input_text',
      text:
        'Return JSON fields: conditionScore (0-100), confidence (0-1), updateLevel ("Light cosmetics"|"Moderate refresh"|"Full renovation"), rehabTier ("Tier 1"|"Tier 2"|"Tier 3"), observedKitchen ("updated"|"average"|"dated"|"unknown"), observedOverall ("excellent"|"good"|"fair"|"poor"|"unknown"), observedWaterIssues ("yes"|"no"|"unknown"), observedSystemRisk ("none"|"minor"|"major"|"unknown"), observations (string[] up to 6), and flags object with booleans: limited_photos, poor_lighting, mostly_exterior, severe_damage_visible.'
    }
  ];

  for (const url of imageUrls) {
    inputContent.push({ type: 'input_image', image_url: url });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: inputContent
        }
      ],
      max_output_tokens: 500,
      text: {
        format: {
          type: 'json_schema',
          name: 'photo_condition_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              conditionScore: { type: 'number' },
              confidence: { type: 'number' },
              updateLevel: {
                type: 'string',
                enum: ['Light cosmetics', 'Moderate refresh', 'Full renovation']
              },
              rehabTier: {
                type: 'string',
                enum: ['Tier 1', 'Tier 2', 'Tier 3']
              },
              observations: {
                type: 'array',
                items: { type: 'string' },
                maxItems: 6
              },
              observedKitchen: {
                type: 'string',
                enum: ['updated', 'average', 'dated', 'unknown']
              },
              observedOverall: {
                type: 'string',
                enum: ['excellent', 'good', 'fair', 'poor', 'unknown']
              },
              observedWaterIssues: {
                type: 'string',
                enum: ['yes', 'no', 'unknown']
              },
              observedSystemRisk: {
                type: 'string',
                enum: ['none', 'minor', 'major', 'unknown']
              },
              flags: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  limited_photos: { type: 'boolean' },
                  poor_lighting: { type: 'boolean' },
                  mostly_exterior: { type: 'boolean' },
                  severe_damage_visible: { type: 'boolean' }
                },
                required: ['limited_photos', 'poor_lighting', 'mostly_exterior', 'severe_damage_visible']
              }
            },
            required: ['conditionScore', 'confidence', 'updateLevel', 'rehabTier', 'observations', 'observedKitchen', 'observedOverall', 'observedWaterIssues', 'observedSystemRisk', 'flags']
          }
        }
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision API failed: ${errText}`);
  }

  const data = await response.json();
  const raw = data?.output_text;
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  const observedKitchen = ['updated', 'average', 'dated', 'unknown'].includes(parsed.observedKitchen)
    ? parsed.observedKitchen
    : 'unknown';
  const observedOverall = ['excellent', 'good', 'fair', 'poor', 'unknown'].includes(parsed.observedOverall)
    ? parsed.observedOverall
    : 'unknown';
  const observedWaterIssues = ['yes', 'no', 'unknown'].includes(parsed.observedWaterIssues)
    ? parsed.observedWaterIssues
    : 'unknown';
  const observedSystemRisk = ['none', 'minor', 'major', 'unknown'].includes(parsed.observedSystemRisk)
    ? parsed.observedSystemRisk
    : 'unknown';

  return {
    conditionScore: clamp(Number(parsed.conditionScore ?? 0), 0, 100),
    confidence: clamp(Number(parsed.confidence ?? 0), 0, 1),
    updateLevel: String(parsed.updateLevel ?? 'Moderate refresh'),
    rehabTier: String(parsed.rehabTier ?? 'Tier 2'),
    observedKitchen,
    observedOverall,
    observedWaterIssues,
    observedSystemRisk,
    observations: Array.isArray(parsed.observations) ? parsed.observations.slice(0, 6).map(String) : [],
    flags: {
      ...(parsed.flags ?? {}),
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini'
    }
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leadId = String(body.leadId ?? '');
    if (!leadId) return new NextResponse('Missing leadId', { status: 400 });

    const supabase = createSupabaseServerClient();

    const { data: photos } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    const photoPaths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
    const photoCount = photoPaths.length;
    if (photoCount === 0) {
      return new NextResponse('No photos found for this lead', { status: 400 });
    }

    const samplePaths = photoPaths.slice(0, 10);
    const signed = await Promise.all(
      samplePaths.map(async (path) => {
        const { data, error } = await supabase.storage.from('lead-photos').createSignedUrl(path, 10 * 60);
        if (error || !data?.signedUrl) return null;

        try {
          const head = await fetch(data.signedUrl, { method: 'HEAD' });
          const length = Number(head.headers.get('content-length') ?? '0');
          const type = head.headers.get('content-type') ?? '';
          if (!head.ok || length <= 0 || !type.startsWith('image/')) return null;
        } catch {
          return null;
        }

        return data.signedUrl;
      })
    );
    const imageUrls = signed.filter(Boolean) as string[];

    let result: VisionResult;
    try {
      const vision = await runVisionAnalysis(imageUrls);
      result = vision ?? heuristicFromPhotoCount(photoCount);
      if (vision) {
        result.observations.unshift(`Vision model reviewed ${imageUrls.length} photo(s).`);
      }
    } catch (visionErr) {
      console.error('Vision analysis failed, falling back to heuristic', visionErr);
      result = heuristicFromPhotoCount(photoCount);
      result.observations.unshift('Vision model unavailable; used fallback heuristic.');
    }

    const { error: analysisError } = await supabase.from('photo_analysis').insert({
      lead_id: leadId,
      condition_score: result.conditionScore,
      update_level: result.updateLevel,
      rehab_tier: result.rehabTier,
      confidence: result.confidence,
      flags: {
        ...result.flags,
        observed_kitchen: result.observedKitchen,
        observed_overall: result.observedOverall,
        observed_water_issues: result.observedWaterIssues,
        observed_system_risk: result.observedSystemRisk
      },
      observations: result.observations
    });

    if (analysisError) throw analysisError;

    const { data: valuation } = await supabase
      .from('valuations')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    const { data: intake } = await supabase
      .from('intake_answers')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    const normalizedValuation = normalizeValuation(valuation);

    if (normalizedValuation) {
      let baseForAdjustment = normalizedValuation;
      const conflictNotes: string[] = [];
      const appliedOverrides: string[] = [];

      if (intake) {
        const highConfidence = result.confidence >= 0.75;
        const effectiveAnswers: any = {
          ...intake,
          kitchen_baths:
            highConfidence && result.observedKitchen !== 'unknown'
              ? result.observedKitchen
              : intake.kitchen_baths,
          condition_overall:
            highConfidence && result.observedOverall !== 'unknown'
              ? result.observedOverall
              : intake.condition_overall,
          water_issues:
            highConfidence && result.observedWaterIssues !== 'unknown'
              ? result.observedWaterIssues
              : intake.water_issues
        };

        if (highConfidence && result.observedKitchen !== 'unknown' && intake.kitchen_baths !== result.observedKitchen) {
          conflictNotes.push(
            `Photo evidence overrode intake kitchen rating: ${String(intake.kitchen_baths)} → ${result.observedKitchen}.`
          );
          appliedOverrides.push('kitchen_baths');
        }

        if (
          highConfidence &&
          result.observedOverall !== 'unknown' &&
          intake.condition_overall !== result.observedOverall
        ) {
          conflictNotes.push(
            `Photo evidence overrode overall condition: ${String(intake.condition_overall)} → ${result.observedOverall}.`
          );
          appliedOverrides.push('condition_overall');
        }

        if (
          highConfidence &&
          result.observedWaterIssues !== 'unknown' &&
          intake.water_issues !== result.observedWaterIssues
        ) {
          conflictNotes.push(
            `Photo evidence overrode water-issue indicator: ${String(intake.water_issues)} → ${result.observedWaterIssues}.`
          );
          appliedOverrides.push('water_issues');
        }

        if (highConfidence && result.observedSystemRisk === 'major') {
          if (effectiveAnswers.electrical !== 'major') {
            conflictNotes.push(`Photo evidence flagged major system risk; electrical set to major.`);
          }
          if (effectiveAnswers.plumbing !== 'major') {
            conflictNotes.push(`Photo evidence flagged major system risk; plumbing set to major.`);
          }
          if (effectiveAnswers.foundation !== 'major') {
            conflictNotes.push(`Photo evidence flagged major system risk; foundation set to major.`);
          }
          effectiveAnswers.electrical = 'major';
          effectiveAnswers.plumbing = 'major';
          effectiveAnswers.foundation = 'major';
        } else if (highConfidence && result.observedSystemRisk === 'minor') {
          if (effectiveAnswers.electrical === 'new' || effectiveAnswers.electrical === 'modern') {
            effectiveAnswers.electrical = 'serviceable';
          }
          if (effectiveAnswers.plumbing === 'new' || effectiveAnswers.plumbing === 'modern') {
            effectiveAnswers.plumbing = 'serviceable';
          }
          if (effectiveAnswers.foundation === 'solid') {
            effectiveAnswers.foundation = 'minor';
          }
          conflictNotes.push('Photo evidence flagged minor system risk; system assumptions were made more conservative.');
        }

        baseForAdjustment = computeValuation({
          baselineMarketValue: normalizedValuation.baseline_market_value,
          answers: effectiveAnswers
        });

        if (conflictNotes.length) {
          baseForAdjustment.explanation_bullets = [
            ...conflictNotes,
            ...baseForAdjustment.explanation_bullets
          ];
        }

        if (appliedOverrides.length) {
          result.observations.unshift(`Overrides applied: ${appliedOverrides.join(', ')}.`);
        }
      }

      const adjusted = adjustValuationFromPhotoAnalysis(
        baseForAdjustment,
        result.conditionScore,
        result.confidence
      );

      const { error: updateError } = await supabase
        .from('valuations')
        .update({
          cash_offer_low: adjusted.cash_offer_low,
          cash_offer_high: adjusted.cash_offer_high,
          pursue_score: adjusted.pursue_score,
          confidence: adjusted.confidence,
          explanation_bullets: adjusted.explanation_bullets
        })
        .eq('lead_id', leadId);

      if (updateError) throw updateError;
    }

    return NextResponse.json({
      ok: true,
      mode: result.flags.model === 'heuristic' ? 'heuristic' : 'vision',
      conditionScore: result.conditionScore,
      confidence: result.confidence,
      observedKitchen: result.observedKitchen,
      observedOverall: result.observedOverall,
      observedWaterIssues: result.observedWaterIssues,
      observedSystemRisk: result.observedSystemRisk
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}
