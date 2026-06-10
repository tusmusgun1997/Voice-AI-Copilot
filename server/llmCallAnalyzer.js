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
      systemImprovements: []
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
      agentPrompt: agent?.agentPrompt || agent?.description || '',
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
      transcript: call.transcript,
      history: {
        summary: call.summary || '',
        transcript: call.transcript || ''
      }
    },
    parameters: parameters.map((parameter) => ({
      id: parameter.id,
      title: parameter.title,
      descriptionForLLM: parameter.description,
      successSignalHints: parameter.successSignals ?? [],
      failureSignalHints: parameter.failureSignals ?? [],
      recommendationWhenMissed: parameter.recommendation,
      promptGuidance: parameter.promptGuidance,
      requiresHumanReview: Boolean(parameter.requiresHumanReview)
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
                'You are an observability evaluator for HighLevel Voice AI calls. Judge the call history/transcript against only the configured observability parameters and the current agent prompt. Return concise, evidence-backed JSON. You must return exactly one parameterResults item for every configured parameter id. Use status "passed" only when the transcript clearly satisfies that parameter, "failed" when it clearly misses it, "not_applicable" when it does not apply to this call, and "unknown" when evidence is insufficient. Do not create customer follow-up actions. Do not tell a human to call, email, or reply to the customer. If a failed or unknown parameter indicates the agent setup should be improved, create a systemImprovements item linked to the agent setup only, such as prompt update, agent profile update, script training, observability parameter update, or new parameter creation. If all parameters passed or are not applicable and no system change is needed, return systemImprovements: []. Do not create praise or "continue doing this" items. Do not invent transcript evidence.'
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

  return normalizeAnalysis(analysis, parameters);
}

function analysisSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      stage: {
        type: 'string',
        enum: ['healthy', 'monitor', 'needs_review', 'script_training']
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
      systemImprovements: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            parameterId: { type: 'string' },
            title: { type: 'string' },
            type: {
              type: 'string',
              enum: ['prompt_update', 'agent_profile_update', 'script_training', 'parameter_update', 'parameter_create', 'parameter_version_change']
            },
            reason: { type: 'string' },
            suggestion: { type: 'string' },
            snippet: { type: 'string' },
            severity: {
              type: 'string',
              enum: ['critical', 'warning', 'info']
            },
            targetType: {
              type: 'string',
              enum: ['agent_profile', 'observability_parameter']
            },
            targetId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['open']
            }
          },
          required: ['parameterId', 'title', 'type', 'reason', 'suggestion', 'snippet', 'severity', 'targetType', 'targetId', 'status']
        }
      }
    },
    required: ['stage', 'score', 'summary', 'parameterResults', 'systemImprovements']
  };
}

function normalizeAnalysis(analysis, parameters = []) {
  const parameterResults = completeParameterResults(analysis.parameterResults ?? [], parameters);

  return {
    status: 'succeeded',
    stage: analysis.stage,
    score: analysis.score,
    summary: analysis.summary,
    parameterResults,
    recommendations: [],
    useActions: [],
    systemImprovements: normalizeSystemImprovements(analysis.systemImprovements ?? [], parameterResults, parameters)
  };
}

function completeParameterResults(results, parameters) {
  const byId = new Map((results ?? []).map((result) => [result.parameterId, result]));

  return parameters.map((parameter) => {
    const result = byId.get(parameter.id);

    return {
      parameterId: parameter.id,
      title: result?.title || parameter.title || parameter.id,
      status: normalizeParameterStatus(result?.status),
      confidence: normalizeConfidence(result?.confidence),
      evidence: result?.evidence || '',
      reasoningSummary: result?.reasoningSummary || 'No parameter-level judgment was returned by the LLM.'
    };
  });
}

function normalizeSystemImprovements(improvements, parameterResults, parameters) {
  const parametersById = new Map(parameters.map((parameter) => [parameter.id, parameter]));
  const resultById = new Map(parameterResults.map((result) => [result.parameterId, result]));
  const normalized = (improvements ?? [])
    .filter((improvement) => {
      const result = resultById.get(improvement.parameterId);
      const status = String(result?.status || '').toLowerCase();
      return ['failed', 'unknown'].includes(status);
    })
    .map((improvement) => normalizeImprovement(improvement, parametersById.get(improvement.parameterId)));

  const improvementParameterIds = new Set(normalized.map((improvement) => improvement.parameterId));
  const fallbackImprovements = parameterResults
    .filter((result) => ['failed', 'unknown'].includes(String(result.status || '').toLowerCase()))
    .filter((result) => !improvementParameterIds.has(result.parameterId))
    .map((result) => fallbackImprovementForResult(result, parametersById.get(result.parameterId)));

  return [...normalized, ...fallbackImprovements];
}

function normalizeImprovement(improvement, parameter = {}) {
  const targetType = normalizeTargetType(improvement.targetType, parameter);

  return {
    parameterId: improvement.parameterId || parameter.id || '',
    title: improvement.title || parameter.title || 'System improvement needed',
    type: normalizeImprovementType(improvement.type, parameter, targetType),
    reason: improvement.reason || 'This call suggests the agent setup may need review.',
    suggestion: improvement.suggestion || parameter.promptGuidance || parameter.recommendation || 'Review the call and decide whether to update the agent prompt or observability parameter.',
    snippet: improvement.snippet || '',
    severity: normalizeSeverity(improvement.severity),
    targetType,
    targetId: improvement.targetId || parameter.id || '',
    status: 'open'
  };
}

function fallbackImprovementForResult(result, parameter = {}) {
  const isUnknown = result.status === 'unknown';
  const targetType = parameter.promptGuidance ? 'agent_profile' : 'observability_parameter';

  return {
    parameterId: result.parameterId,
    title: isUnknown ? `Review ${result.title}` : `Improve ${result.title}`,
    type: targetType === 'agent_profile' ? 'prompt_update' : 'parameter_update',
    reason: result.reasoningSummary || result.evidence || 'The LLM flagged this parameter for setup review.',
    suggestion: parameter.promptGuidance || parameter.recommendation || 'Review the transcript and update the agent prompt or observability parameter if the miss is valid.',
    snippet: result.evidence || '',
    severity: isUnknown ? 'warning' : 'critical',
    targetType,
    targetId: parameter.id || result.parameterId,
    status: 'open'
  };
}

function normalizeParameterStatus(status) {
  return ['passed', 'failed', 'not_applicable', 'unknown'].includes(status) ? status : 'unknown';
}

function normalizeConfidence(confidence) {
  return ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium';
}

function normalizeSeverity(severity) {
  return ['critical', 'warning', 'info'].includes(severity) ? severity : 'warning';
}

function normalizeTargetType(targetType, parameter = {}) {
  if (['agent_profile', 'observability_parameter'].includes(targetType)) return targetType;
  return parameter.promptGuidance ? 'agent_profile' : 'observability_parameter';
}

function normalizeImprovementType(type, parameter = {}, targetType = '') {
  const value = String(type || '').toLowerCase();
  if (['prompt_update', 'agent_profile_update', 'script_training', 'parameter_update', 'parameter_create', 'parameter_version_change'].includes(value)) {
    return value;
  }

  if (targetType === 'observability_parameter') return 'parameter_update';
  if (parameter.promptGuidance) return 'prompt_update';
  return 'agent_profile_update';
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
