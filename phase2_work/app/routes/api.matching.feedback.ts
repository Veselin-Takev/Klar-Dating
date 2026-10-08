/** This prototype is not mounted by Express; no verified feedback service is configured. */
export async function action(): Promise<Response> {
  return Response.json({ error: 'Matching feedback is not configured' }, { status: 501 });
}
