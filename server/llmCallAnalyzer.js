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
      highLevelProfile: {
        businessName: agent?.businessName || '',
        welcomeMessage: agent?.welcomeMessage || '',
        agentPrompt: agent?.agentPrompt || agent?.description || '',
        language: agent?.language || '',
        timezone: agent?.timezone || '',
        maxCallDuration: agent?.maxCallDuration ?? null
      },
      highLevelGoals: (agent?.actions ?? []).map((action) => ({
        id: action.id || '',
        name: action.name || '',
        actionType: action.actionType || action.type || '',
        description:
          action.actionParameters?.description ||
          action.actionParameters?.triggerPrompt ||
          action.actionParameters?.message ||
          action.actionParameters?.stopBotTriggerCondition ||
          ''
      })),
      observabilityProfile: {
        label: profile?.name || '',
        objective: profile?.scriptSummary || '',
        successGoals: profile?.goals ?? [],
        riskSignals: profile?.negativeSignals ?? []
      }
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
                'You are an observability evaluator for HighLevel Voice AI calls. Judge the transcript against the agent profile, HighLevel goals/actions, and configured observability parameters. Return concise, evidence-backed JSON. Recommendations are an exception queue: only include a recommendation when a parameter failed/unknown, the agent setup has a material gap, or a human should review a concrete change. Do not create praise, confirmation, "continue doing this", or best-practice recommendations when the call was handled well. If no change is needed, return recommendations: [] and useActions: []. Recommend adding/updating observability parameters when the evaluation checklist is incomplete, adding/updating HighLevel goals when the agent action setup should change, and updating the agent profile when the role/objective/script needs clearer guidance. Do not invent transcript evidence.'
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
              enum: ['critical', 'warning']
            },
            promptGuidance: { type: 'string' }
            ,
            targetType: {
              type: 'string',
              enum: ['agent_profile', 'highlevel_goal', 'observability_parameter']
            },
            targetAction: {
              type: 'string',
              enum: ['add', 'update']
            },
            targetId: { type: 'string' },
            suggestedChange: { type: 'string' },
            reviewStatus: {
              type: 'string',
              enum: ['needs_human_review']
            }
          },
          required: [
            'parameterId',
            'title',
            'detail',
            'severity',
            'promptGuidance',
            'targetType',
            'targetAction',
            'targetId',
            'suggestedChange',
            'reviewStatus'
          ]
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
  const parameterResults = analysis.parameterResults ?? [];
  const parameterStatusById = new Map(
    parameterResults.map((result) => [result.parameterId, String(result.status || '').toLowerCase()])
  );
  const hasProblemResult = parameterResults.some((result) =>
    ['failed', 'unknown'].includes(String(result.status || '').toLowerCase())
  );

  return {
    status: 'succeeded',
    stage: analysis.stage,
    score: analysis.score,
    summary: analysis.summary,
    parameterResults,
    recommendations: (analysis.recommendations ?? [])
      .filter((recommendation) =>
        shouldKeepRecommendation(recommendation, {
          hasProblemResult,
          parameterStatusById,
          stage: analysis.stage
        })
      )
      .map((recommendation) => ({
        ...recommendation,
        targetType: recommendation.targetType || 'observability_parameter',
        targetAction: recommendation.targetAction || 'update',
        targetId: recommendation.targetId || recommendation.parameterId || '',
        suggestedChange: recommendation.suggestedChange || recommendation.promptGuidance || recommendation.detail || '',
        reviewStatus: recommendation.reviewStatus || 'needs_human_review'
      })),
    useActions: analysis.useActions ?? []
  };
}

function shouldKeepRecommendation(recommendation, context) {
  const severity = String(recommendation?.severity || '').toLowerCase();
  if (!['critical', 'warning'].includes(severity)) return false;

  const parameterStatus = context.parameterStatusById.get(recommendation?.parameterId);
  if (parameterStatus === 'passed') return false;

  if (context.stage === 'healthy' && !context.hasProblemResult) return false;

  return Boolean(recommendation?.title || recommendation?.detail || recommendation?.suggestedChange);
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
