import {
  getAgentObservabilityProfile,
  listSavedObservabilityProfiles,
  saveAgentObservabilityProfile
} from '../observabilityProfiles.js';
import { extractLocationId } from '../utils/http.js';

export function createObservabilityProfileController({ localDataFile }) {
  async function listProfiles(request, response) {
    const locationId = extractLocationId(request);
    const result = await listSavedObservabilityProfiles(localDataFile, locationId);
    response.json(result);
  }

  async function getProfile(request, response) {
    const locationId = extractLocationId(request);
    const profile = await getAgentObservabilityProfile(
      {
        id: request.params.agentId,
        name: request.query.agentName
      },
      localDataFile,
      localDataFile,
      locationId
    );

    response.json({ profile });
  }

  async function saveProfile(request, response) {
    const locationId = extractLocationId(request);
    const profile = await saveAgentObservabilityProfile(
      request.params.agentId,
      request.body,
      localDataFile,
      localDataFile,
      locationId
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
