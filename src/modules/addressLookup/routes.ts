import { Router } from 'express';
import { ValidationError } from '../../middleware/errorHandler.js';
import { ADDRESS_LOOKUP_ERROR_CODES, addressLookupSchema } from './schema.js';
import { decodeReference, lookupAddresses } from './service.js';

export const addressLookupRouter = Router();

function runLookup(
  candidateInput: unknown,
  res: import('express').Response,
  next: import('express').NextFunction,
): void {
  const parsed = addressLookupSchema.safeParse(candidateInput);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, ADDRESS_LOOKUP_ERROR_CODES));
    return;
  }
  res.status(200).json({ data: lookupAddresses(parsed.data) });
}

// Doc-compliant endpoint — POST /address-lookup.
addressLookupRouter.post('/address-lookup', (req, res, next) => {
  runLookup(req.body, res, next);
});

// Replica-only extension aliases (see constitution.md) — delegate to the
// exact same schema/service as the doc endpoint above.
addressLookupRouter.get('/addresses', (req, res, next) => {
  runLookup({ postcode: req.query.postcode }, res, next);
});

addressLookupRouter.get('/addresses/search', (req, res, next) => {
  runLookup({ full_address: req.query.q }, res, next);
});

addressLookupRouter.get('/addresses/:reference', (req, res) => {
  const candidate = decodeReference(req.params.reference);
  if (!candidate) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  res.status(200).json({ data: candidate });
});
