import { body, param, query } from 'express-validator';

export const createMatchValidator = [
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
  body('team1Id').isMongoId().withMessage('Valid team 1 ID is required'),
  body('team2Id').isMongoId().withMessage('Valid team 2 ID is required'),
  body('date').isISO8601().withMessage('Valid date is required (ISO 8601 format)'),
  body('venue').optional().trim(),
  body('totalOvers').optional().isInt({ min: 1, max: 50 }).withMessage('Total overs must be between 1 and 50'),
];

export const updateMatchValidator = [
  param('id').isMongoId().withMessage('Invalid match ID'),
  body('team1Id').optional().isMongoId().withMessage('Invalid team 1 ID'),
  body('team2Id').optional().isMongoId().withMessage('Invalid team 2 ID'),
  body('status').optional().isIn(['upcoming', 'live', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('date').optional().isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('venue').optional().trim(),
  body('totalOvers').optional().isInt({ min: 1, max: 50 }).withMessage('Total overs must be between 1 and 50'),
  body('tossWinner').optional().isMongoId().withMessage('Invalid toss winner ID'),
  body('tossDecision')
    .optional()
    .isIn(['bat', 'bowl'])
    .withMessage("Toss decision must be 'bat' or 'bowl'"),
  body('manOfMatch').optional().isMongoId(),
  body('bestBatsman').optional().isMongoId(),
  body('bestBowler').optional().isMongoId(),
];

export const assignScorerValidator = [
  param('id').isMongoId().withMessage('Invalid match ID'),
  body('scorerId').isMongoId().withMessage('Valid scorer ID is required'),
];

export const listMatchesValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('tournamentId').optional().isMongoId().withMessage('Invalid tournament ID'),
  query('status')
    .optional()
    .isIn(['upcoming', 'live', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
];
