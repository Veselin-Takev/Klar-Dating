/** One project/database selection for the Admin SDK. Emulator data is isolated. */
export function resolveFirebaseRuntime(
  config: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): { projectId?: string; databaseId?: string } {
  const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST);
  // Deployment metadata and Firebase Admin identity must resolve to one project.
  // Never silently prefer GCLOUD_PROJECT over a conflicting Google/Firebase ID.
  const projectIds = [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, env.FIREBASE_PROJECT_ID]
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (new Set(projectIds).size > 1) {
    throw new Error('Firebase runtime project IDs disagree');
  }
  const explicitProject = projectIds[0];
  if (emulator) {
    const projectId = explicitProject || "demo-klar";
    if (!projectId.startsWith("demo-")) {
      throw new Error("Emulator mode requires a demo- project ID");
    }
    return { projectId };
  }
  const configProject = typeof config.projectId === "string" ? config.projectId : undefined;
  const configuredDatabaseId = typeof config.firestoreDatabaseId === "string" && config.firestoreDatabaseId
    ? config.firestoreDatabaseId : undefined;
  return {
    projectId: explicitProject || configProject,
    // The checked-in web config can name an unrelated project's Firestore DB.
    // Do not transfer that database ID to an explicitly selected staging project.
    databaseId: env.FIRESTORE_DATABASE_ID || (
      !explicitProject || explicitProject === configProject ? configuredDatabaseId : undefined
    ),
  };
}
