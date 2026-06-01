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
                'You are an observability evaluator for HighLevel Voice AI calls. Judge the call history/transcript against only the configured observability parameters and the current agent prompt. Return concise, evidence-backed JSON. You must return exactly one parameterResults item for every configured parameter id. Use status "passed" only when the transcript clearly satisfies that parameter, "failed" when it clearly misses it, "not_applicable" when it does not apply to this call, and "unknown" when evidence is insufficient. Create useActions only for failed or unknown parameters that need a human decision, caller follow-up, script training, agent profile update, or observability parameter update. Use category "customer" only for caller-facing actions such as contacting the customer, answering something the customer asked, callback, escalation, or follow-up. Use category "system" for internal setup improvements such as prompt updates, observability parameter updates, script training, or agent profile changes. Each action must include a concrete suggestion that a human can apply, ignore, or delete. If all parameters passed or are not applicable and no human work is needed, return useActions: []. Do not create praise or "continue doing this" items. Do not invent transcript evidence.'
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
      useActions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            parameterId: { type: 'string' },
            title: { type: 'string' },
            type: {
              type: 'string',
              enum: ['human_review', 'script_training', 'follow_up', 'prompt_update', 'parameter_update']
            },
            category: {
              type: 'string',
              enum: ['customer', 'system']
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
              enum: ['agent_profile', 'observability_parameter', 'human_follow_up']
            },
            targetId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['open']
            }
          },
          required: ['parameterId', 'title', 'type', 'category', 'reason', 'suggestion', 'snippet', 'severity', 'targetType', 'targetId', 'status']
        }
      }
    },
    required: ['stage', 'score', 'summary', 'parameterResults', 'useActions']
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
    useActions: normalizeUseActions(analysis.useActions ?? [], parameterResults, parameters)
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

function normalizeUseActions(actions, parameterResults, parameters) {
  const parametersById = new Map(parameters.map((parameter) => [parameter.id, parameter]));
  const resultById = new Map(parameterResults.map((result) => [result.parameterId, result]));
  const normalized = (actions ?? [])
    .filter((action) => {
      const result = resultById.get(action.parameterId);
      const status = String(result?.status || '').toLowerCase();
      return ['failed', 'unknown'].includes(status);
    })
    .map((action) => normalizeAction(action, parametersById.get(action.parameterId)));

  const actionParameterIds = new Set(normalized.map((action) => action.parameterId));
  const fallbackActions = parameterResults
    .filter((result) => ['failed', 'unknown'].includes(String(result.status || '').toLowerCase()))
    .filter((result) => !actionParameterIds.has(result.parameterId))
    .map((result) => fallbackActionForResult(result, parametersById.get(result.parameterId)));

  return [...normalized, ...fallbackActions];
}

function normalizeAction(action, parameter = {}) {
  const type = normalizeActionType(action.type, parameter);
  const targetType = normalizeTargetType(action.targetType, parameter);

  return {
    parameterId: action.parameterId || parameter.id || '',
    title: action.title || parameter.title || 'Human review needed',
    type,
    category: normalizeActionCategory(action.category, type, targetType),
    reason: action.reason || 'This call needs human review before changing the agent setup.',
    suggestion: action.suggestion || parameter.promptGuidance || parameter.recommendation || 'Review the call and decide whether to update the agent prompt or observability parameter.',
    snippet: action.snippet || '',
    severity: normalizeSeverity(action.severity),
    targetType,
    targetId: action.targetId || parameter.id || '',
    status: 'open'
  };
}

function fallbackActionForResult(result, parameter = {}) {
  const isUnknown = result.status === 'unknown';

  return {
    parameterId: result.parameterId,
    title: isUnknown ? `Review ${result.title}` : `Fix ${result.title}`,
    type: parameter.requiresHumanReview ? parameter.useActionType || 'human_review' : 'script_training',
    category: actionCategoryFromSignals(
      parameter.requiresHumanReview ? parameter.useActionType || 'human_review' : 'script_training',
      parameter.promptGuidance ? 'agent_profile' : 'observability_parameter'
    ),
    reason: result.reasoningSummary || result.evidence || 'The LLM flagged this parameter for review.',
    suggestion: parameter.promptGuidance || parameter.recommendation || 'Review the transcript and update the prompt or checklist if the miss is valid.',
    snippet: result.evidence || '',
    severity: isUnknown ? 'warning' : 'critical',
    targetType: parameter.promptGuidance ? 'agent_profile' : 'observability_parameter',
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
  if (['agent_profile', 'observability_parameter', 'human_follow_up'].includes(targetType)) return targetType;
  if (parameter.requiresHumanReview) return 'human_follow_up';
  return parameter.promptGuidance ? 'agent_profile' : 'observability_parameter';
}

function normalizeActionType(type, parameter = {}) {
  const value = String(type || '').toLowerCase();
  if (['human_review', 'script_training', 'follow_up', 'prompt_update', 'parameter_update'].includes(value)) return value;

  const configured = String(parameter.useActionType || '').toLowerCase().replace(/\s+/g, '_');
  if (['human_review', 'script_training', 'follow_up', 'prompt_update', 'parameter_update'].includes(configured)) {
    return configured;
  }

  if (parameter.requiresHumanReview) return 'human_review';
  return parameter.promptGuidance ? 'prompt_update' : 'parameter_update';
}

function normalizeActionCategory(category, type, targetType) {
  if (['customer', 'system'].includes(category)) return category;
  return actionCategoryFromSignals(type, targetType);
}

function actionCategoryFromSignals(type, targetType) {
  if (targetType === 'human_follow_up' || type === 'follow_up') return 'customer';
  return 'system';
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
