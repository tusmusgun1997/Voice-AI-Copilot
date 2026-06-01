export function createServerConfig(env = process.env) {
  const localDataFile = env.LOCAL_DATA_FILE || env.APP_DATA_FILE || 'data/app-data.json';

  return {
    port: Number(env.PORT || 3001),
    localDataFile,
    highLevel: {
      token: env.GHL_PRIVATE_INTEGRATION_TOKEN,
      locationId: env.GHL_LOCATION_ID,
      version: env.GHL_API_VERSION,
      baseUrl: env.GHL_API_BASE_URL,
      callType: env.GHL_CALL_TYPE
    },
    oauth: {
      clientId: env.GHL_CLIENT_ID,
      clientSecret: env.GHL_CLIENT_SECRET,
      redirectUri: env.GHL_OAUTH_REDIRECT_URL,
      userType: env.GHL_OAUTH_USER_TYPE || 'Location',
      baseUrl: env.GHL_API_BASE_URL
    },
    openAi: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    analysis: {
      maxAttempts: env.ANALYSIS_JOB_MAX_ATTEMPTS,
      retryDelayMs: env.ANALYSIS_JOB_RETRY_DELAY_MS
    },
    dashboard: {
      useDemoDataWhenEmpty: String(env.USE_DEMO_DATA_WHEN_EMPTY || 'true') === 'true',
      showDeletedAgentCalls: String(env.SHOW_DELETED_AGENT_CALLS || 'false') === 'true'
    },
    database: {
      dataStore: env.DATA_STORE || 'json',
      supabaseUrl: env.SUPABASE_URL,
      supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseInstallationName: env.SUPABASE_INSTALLATION_NAME,
      supabaseIsSandbox: String(env.SUPABASE_IS_SANDBOX || 'true') === 'true'
    }
  };
}
