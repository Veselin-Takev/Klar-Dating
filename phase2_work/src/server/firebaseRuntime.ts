/** One project/database selection for the Admin SDK. Emulator data is isolated. */
export function resolveFirebaseRuntime(
  config: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): { projectId?: string; databaseId?: string } {
  const emulator = Boolean(
    env.FIRESTORE_EMULATOR_HOST
    || env.FIREBASE_AUTH_EMULATOR_HOST
    || env.FIREBASE_STORAGE_EMULATOR_HOST
  );
  // Deployment metadata and Firebase Admin identity must resolve to one project.
  // Normalize harmless surrounding whitespace, but reject blank or conflicting IDs.
  const projectEntries = [
    ['GCLOUD_PROJECT', env.GCLOUD_PROJECT],
    ['GOOGLE_CLOUD_PROJECT', env.GOOGLE_CLOUD_PROJECT],
    ['FIREBASE_PROJECT_ID', env.FIREBASE_PROJECT_ID],
  ] as const;
  const projectIds = projectEntries.flatMap(([key, value]) => {
    if (value === undefined) return [];
    const normalized = value.trim();
    if (!normalized) throw new Error(`Firebase runtime project ID ${key} must not be blank`);
    return [normalized];
  });
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
  const configProject = typeof config.projectId === "string" && config.projectId.trim()
    ? config.projectId.trim() : undefined;
  const configuredDatabaseId = typeof config.firestoreDatabaseId === "string" && config.firestoreDatabaseId.trim()
    ? config.firestoreDatabaseId.trim() : undefined;
  const explicitDatabaseId = env.FIRESTORE_DATABASE_ID?.trim();
  return {
    projectId: explicitProject || configProject,
    // The checked-in web config can name an unrelated project's Firestore DB.
    // Do not transfer that database ID to an explicitly selected staging project.
    databaseId: explicitDatabaseId || (
      !explicitProject || explicitProject === configProject ? configuredDatabaseId : undefined
    ),
  };
}
