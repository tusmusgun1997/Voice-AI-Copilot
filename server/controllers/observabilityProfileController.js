import {
  getAgentObservabilityProfile,
  listSavedObservabilityProfiles,
  saveAgentObservabilityProfile
} from '../observabilityProfiles.js';

export function createObservabilityProfileController({ localDataFile }) {
  async function listProfiles(_request, response) {
    const result = await listSavedObservabilityProfiles(localDataFile);
    response.json(result);
  }

  async function getProfile(request, response) {
    const profile = await getAgentObservabilityProfile(
      {
        id: request.params.agentId,
        name: request.query.agentName
      },
      localDataFile,
      localDataFile
    );

    response.json({ profile });
  }

  async function saveProfile(request, response) {
    const profile = await saveAgentObservabilityProfile(
      request.params.agentId,
      request.body,
      localDataFile,
      localDataFile
    );

    response.json({
      saved: true,
      profile
    });
  }

  return {
    listProfiles,
    getProfile,
    saveProfile
  };
}
