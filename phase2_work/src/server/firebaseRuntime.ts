/** One project/database selection for the Admin SDK. Emulator data is isolated. */
export function resolveFirebaseRuntime(
  config: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): { projectId?: string; databaseId?: string } {
  const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST);
  const explicitProject = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT;
  if (emulator) {
    const projectId = explicitProject || "demo-klar";
    if (!projectId.startsWith("demo-")) {
      throw new Error("Emulator mode requires a demo- project ID");
    }
    return { projectId };
  }
  return {
    projectId: explicitProject || (typeof config.projectId === "string" ? config.projectId : undefined),
    databaseId: env.FIRESTORE_DATABASE_ID || (
      typeof config.firestoreDatabaseId === "string" && config.firestoreDatabaseId
        ? config.firestoreDatabaseId : undefined
    ),
  };
}
