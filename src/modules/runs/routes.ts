import { Router } from 'express';
import { ValidationError } from '../../middleware/errorHandler.js';
import { createRunSchema, RUN_ERROR_CODES } from './schema.js';
import { closeRun, createRun, findRun, serializeRun } from './service.js';

export const runsRouter = Router();

/**
 * Replica-only extension (see constitution.md, .scratch/run-simulation/spec.md)
 * — no LN doc equivalent. Scoped to the authenticated client, the same
 * tenancy model every other resource in this app already uses. This module
 * only covers the run's own lifecycle (create/fetch/close) — the actual
 * response-simulation behavior against real traffic is a separate
 * middleware (see modules/runs's own ticket 03).
 */
runsRouter.post('/runs', async (req, res, next) => {
  const parsed = createRunSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, RUN_ERROR_CODES));
    return;
  }
  try {
    const { run, tally } = await createRun(req.client!.id, parsed.data);
    res.status(201).json({ data: serializeRun(run, tally) });
  } catch (error) {
    next(error);
  }
});

runsRouter.get('/runs/:id', async (req, res, next) => {
  try {
    const { run, tally } = await findRun(req.client!.id, req.params.id);
    res.status(200).json({ data: serializeRun(run, tally) });
  } catch (error) {
    next(error);
  }
});

runsRouter.post('/runs/:id/close', async (req, res, next) => {
  try {
    const { run, tally } = await closeRun(req.client!.id, req.params.id);
    res.status(200).json({ data: serializeRun(run, tally) });
  } catch (error) {
    next(error);
  }
});
