import { Router } from 'express';
import { paginate, paginationQuerySchema, PAGINATION_ERROR_CODES } from '../../lib/pagination.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import { createScorecardSchema, SCORECARD_ERROR_CODES, updateScorecardSchema } from './schema.js';
import {
  createScorecard,
  deleteScorecard,
  findScorecard,
  listScorecards,
  publishScorecard,
  retireScorecard,
  serializeScorecard,
  updateScorecard,
} from './service.js';

export const scorecardsRouter = Router();

scorecardsRouter.post('/scorecards', async (req, res, next) => {
  const parsed = createScorecardSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, SCORECARD_ERROR_CODES));
    return;
  }
  try {
    const scorecard = await createScorecard(req.client!.id, parsed.data);
    res.status(201).json(serializeScorecard(scorecard));
  } catch (error) {
    next(error);
  }
});

scorecardsRouter.get('/scorecards', async (req, res, next) => {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, PAGINATION_ERROR_CODES));
    return;
  }
  try {
    const { page, per_page: perPage } = parsed.data;
    const { items, total } = await listScorecards(req.client!.id, page, perPage);
    res
      .status(200)
      .json(paginate(items.map(serializeScorecard), total, page, perPage, '/scorecards'));
  } catch (error) {
    next(error);
  }
});

scorecardsRouter.get('/scorecards/:id', async (req, res, next) => {
  try {
    const scorecard = await findScorecard(req.client!.id, req.params.id);
    res.status(200).json(serializeScorecard(scorecard));
  } catch (error) {
    next(error);
  }
});

scorecardsRouter.patch('/scorecards/:id', async (req, res, next) => {
  const parsed = updateScorecardSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, SCORECARD_ERROR_CODES));
    return;
  }
  try {
    const scorecard = await updateScorecard(req.client!.id, req.params.id, parsed.data);
    res.status(200).json(serializeScorecard(scorecard));
  } catch (error) {
    next(error);
  }
});

scorecardsRouter.delete('/scorecards/:id', async (req, res, next) => {
  try {
    await deleteScorecard(req.client!.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Replica-only extensions (see constitution.md) — not part of the documented API.
scorecardsRouter.post('/scorecards/:id/publish', async (req, res, next) => {
  try {
    const scorecard = await publishScorecard(req.client!.id, req.params.id);
    res.status(200).json(serializeScorecard(scorecard));
  } catch (error) {
    next(error);
  }
});

scorecardsRouter.post('/scorecards/:id/retire', async (req, res, next) => {
  try {
    const scorecard = await retireScorecard(req.client!.id, req.params.id);
    res.status(200).json(serializeScorecard(scorecard));
  } catch (error) {
    next(error);
  }
});
