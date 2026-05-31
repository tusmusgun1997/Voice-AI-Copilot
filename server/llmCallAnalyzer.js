const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export async function analyzeCallWithOpenAI({ apiKey, model = DEFAULT_OPENAI_MODEL, call, agent, profile }) {
  if (!apiKey) {
    const error = new Error('Missing OPENAI_API_KEY');
    error.status = 503;
    throw error;
  }

  const parameters = (profile?.parameters ?? []).filter((parameter) => parameter.enabled !== false);

  if (parameters.length === 0) {
    return {
      status: 'skipped',
      stage: 'missing_parameters',
      score: null,
      summary: 'No observability parameters are configured for this agent.',
      parameterResults: [],
      recommendations: [],
      useActions: []
    };
  }

  const payload = {
    agent: {
      id: agent?.id || call.agentId,
      name: agent?.name || call.agentName,
      objective: profile?.scriptSummary || '',
      goals: profile?.goals ?? [],
      riskSignals: profile?.negativeSignals ?? []
    },
    call: {
      id: call.id,
      createdAt: call.createdAt,
      durationSeconds: call.durationSeconds,
      summary: call.summary,
      transcript: call.transcript
    },
    parameters: parameters.map((parameter) => ({
      id: parameter.id,
      title: parameter.title,
      descriptionForLLM: parameter.description,
      successSignalHints: parameter.successSignals ?? [],
      failureSignalHints: parameter.failureSignals ?? [],
      recommendationWhenMissed: parameter.recommendation,
      promptGuidance: parameter.promptGuidance,
      requiresHumanReview: Boolean(parameter.requiresHumanReview),
      useActionType: parameter.useActionType
    }))
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You are an observability evaluator for HighLevel Voice AI calls. Judge the transcript only against the configured parameters. Return concise, evidence-backed JSON. Do not invent transcript evidence.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(payload)
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'voice_ai_call_observability_analysis',
          strict: true,
          schema: analysisSchema()
        }
      }
    })
  });

  const bodyText = await response.text();
  const body = parseJson(bodyText);

  if (!response.ok) {
    const detail = body?.error?.message || body?.message || bodyText || response.statusText;
    const error = new Error(`OpenAI API ${response.status}: ${detail}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  const outputText = extractOutputText(body);
  const analysis = parseJson(outputText);

  if (!analysis) {
    throw new Error('OpenAI response did not contain valid JSON analysis.');
  }

  return normalizeAnalysis(analysis);
}

function analysisSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      stage: {
        type: 'string',
        enum: ['healthy', 'monitor', 'needs_review', 'human_follow_up', 'script_training']
      },
      score: {
        type: 'integer',
        minimum: 0,
        maximum: 100
      },
      summary: {
        type: 'string'
      },
      parameterResults: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            parameterId: { type: 'string' },
            title: { type: 'string' },
            status: {
              type: 'string',
              enum: ['passed', 'failed', 'not_applicable', 'unknown']
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low']
            },
            evidence: { type: 'string' },
            reasoningSummary: { type: 'string' }
          },
          required: ['parameterId', 'title', 'status', 'confidence', 'evidence', 'reasoningSummary']
        }
      },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            parameterId: { type: 'string' },
            title: { type: 'string' },
            detail: { type: 'string' },
            severity: {
              type: 'string',
              enum: ['critical', 'warning', 'info']
            },
            promptGuidance: { type: 'string' }
          },
          required: ['parameterId', 'title', 'detail', 'severity', 'promptGuidance']
        }
      },
      useActions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            parameterId: { type: 'string' },
            type: {
              type: 'string',
              enum: ['human_review', 'script_training', 'follow_up']
            },
            reason: { type: 'string' },
            snippet: { type: 'string' },
            severity: {
              type: 'string',
              enum: ['critical', 'warning', 'info']
            }
          },
          required: ['parameterId', 'type', 'reason', 'snippet', 'severity']
        }
      }
    },
    required: ['stage', 'score', 'summary', 'parameterResults', 'recommendations', 'useActions']
  };
}

function normalizeAnalysis(analysis) {
  return {
    status: 'succeeded',
    stage: analysis.stage,
    score: analysis.score,
    summary: analysis.summary,
    parameterResults: analysis.parameterResults ?? [],
    recommendations: analysis.recommendations ?? [],
    useActions: analysis.useActions ?? []
  };
}

function extractOutputText(body) {
  if (typeof body?.output_text === 'string') return body.output_text;

  for (const item of body?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return '';
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
