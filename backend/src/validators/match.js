import { body, param, query } from 'express-validator';

const BADMINTON_CATEGORIES = ['mens_singles', 'womens_singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];

// Badminton requires 1 player per side for singles, 2 per side for doubles / mixed doubles.
export const requiredPlayersForCategory = (category) => {
  if (!category) return 0;
  if (category.endsWith('_singles')) return 1;
  if (category.endsWith('_doubles')) return 2;
  return 0;
};

const playerArrayValidator = (field) =>
  body(field)
    .optional()
    .isArray()
    .withMessage(`${field} must be an array of player IDs`)
    .bail()
    .custom((arr) => arr.every((id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)))
    .withMessage(`${field} must contain valid player IDs`);

export const createMatchValidator = [
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
  body('team1Id').isMongoId().withMessage('Valid team 1 ID is required'),
  body('team2Id').isMongoId().withMessage('Valid team 2 ID is required'),
  body('date').isISO8601().withMessage('Valid date is required (ISO 8601 format)'),
  body('venue').optional().trim(),
  body('totalOvers').optional().isInt({ min: 1, max: 50 }).withMessage('Total overs must be between 1 and 50'),
  body('category')
    .optional()
    .isIn(BADMINTON_CATEGORIES)
    .withMessage('Invalid category'),
  playerArrayValidator('team1Players'),
  playerArrayValidator('team2Players'),
  // Cross-field: for badminton, player-array lengths must match the category
  body().custom((value) => {
    const { category, team1Players, team2Players } = value || {};
    if (!category) return true; // non-badminton path
    const expected = requiredPlayersForCategory(category);
    if (!expected) return true;
    // Allow omission (admin may assign later), but if provided, must match
    if (Array.isArray(team1Players) && team1Players.length > 0 && team1Players.length !== expected) {
      throw new Error(`Team 1 must have exactly ${expected} player(s) for ${category}`);
    }
    if (Array.isArray(team2Players) && team2Players.length > 0 && team2Players.length !== expected) {
      throw new Error(`Team 2 must have exactly ${expected} player(s) for ${category}`);
    }
    return true;
  }),
];

export const updateMatchValidator = [
  param('id').isMongoId().withMessage('Invalid match ID'),
  body('team1Id').optional().isMongoId().withMessage('Invalid team 1 ID'),
  body('team2Id').optional().isMongoId().withMessage('Invalid team 2 ID'),
  body('status').optional().isIn(['upcoming', 'live', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('date').optional().isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('venue').optional().trim(),
  body('totalOvers').optional().isInt({ min: 1, max: 50 }).withMessage('Total overs must be between 1 and 50'),
  body('category')
    .optional()
    .isIn(BADMINTON_CATEGORIES)
    .withMessage('Invalid category'),
  playerArrayValidator('team1Players'),
  playerArrayValidator('team2Players'),
  body('tossWinner').optional().isMongoId().withMessage('Invalid toss winner ID'),
  // Sport-aware toss decision: cricket uses bat/bowl, badminton uses serve/receive/side
  body('tossDecision')
    .optional()
    .isIn(['bat', 'bowl', 'serve', 'receive', 'side'])
    .withMessage("Toss decision must be 'bat'/'bowl' (cricket) or 'serve'/'receive'/'side' (badminton)"),
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
