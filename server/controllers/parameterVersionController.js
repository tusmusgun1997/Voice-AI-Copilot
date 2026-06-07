import { createParameterVersion, listParameterVersions, updateParameterVersion } from '../parameterVersions.js';
import { extractLocationId } from '../utils/http.js';

export function createParameterVersionController({ localDataFile }) {
  async function listVersions(request, response) {
    const locationId = extractLocationId(request);
    const result = await listParameterVersions(localDataFile, locationId);
    response.json(result);
  }

  async function createVersion(request, response) {
    const locationId = extractLocationId(request);
    const version = await createParameterVersion(request.body, localDataFile, locationId);
    response.status(201).json({
      created: true,
      version
    });
  }

  async function updateVersion(request, response) {
    const locationId = extractLocationId(request);
    const version = await updateParameterVersion(
      request.params.versionId,
      request.body,
      localDataFile,
      locationId
    );
    response.json({
      saved: true,
      version
    });
  }

  return {
    listVersions,
    createVersion,
    updateVersion
  };
}
