/** Port di persistenza per la chiusura del flywheel (finalize). */
export interface AgentFinalizePort {
  finalize(referenceId: string, update: Record<string, unknown>): Promise<void>;
}
