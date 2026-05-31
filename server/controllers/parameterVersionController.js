import { createParameterVersion, listParameterVersions, updateParameterVersion } from '../parameterVersions.js';

export function createParameterVersionController({ localDataFile }) {
  async function listVersions(_request, response) {
    const result = await listParameterVersions(localDataFile);
    response.json(result);
  }

  async function createVersion(request, response) {
    const version = await createParameterVersion(request.body, localDataFile);
    response.status(201).json({
      created: true,
      version
    });
  }

  async function updateVersion(request, response) {
    const version = await updateParameterVersion(
      request.params.versionId,
      request.body,
      localDataFile
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
