import { body, param, query } from 'express-validator';

export const createTournamentValidator = [
  body('name').trim().notEmpty().withMessage('Tournament name is required'),
  body('sport').optional().isIn(['cricket', 'football', 'badminton']).withMessage("Sport must be 'cricket', 'football', or 'badminton'"),
  body('format').custom((value, { req }) => {
    const sport = req.body.sport || 'cricket';
    const validFormatsMap = {
      cricket: ['T20', 'ODI', 'Test'],
      football: ['League', 'Cup', 'Friendly'],
      badminton: ['Knockout', 'Round Robin', 'Group + Knockout', 'Double Elimination', 'Singles', 'Doubles', 'Mixed Doubles'],
    };
    const validFormats = validFormatsMap[sport] || validFormatsMap.cricket;
    if (!validFormats.includes(value)) {
      throw new Error(`Format must be one of: ${validFormats.join(', ')}`);
    }
    return true;
  }),
  body('location').optional().trim(),
  body('venue').optional().trim(),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
  body('maxTeams')
    .optional()
    .isInt({ min: 2 })
    .withMessage('Max teams must be at least 2'),
  body('description').optional().trim(),
];

export const updateTournamentValidator = [
  param('id').isMongoId().withMessage('Invalid tournament ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('sport').optional().isIn(['cricket', 'football', 'badminton']).withMessage("Sport must be 'cricket', 'football', or 'badminton'"),
  body('format').optional().custom((value, { req }) => {
    const sport = req.body.sport || 'cricket';
    const validFormatsMap = {
      cricket: ['T20', 'ODI', 'Test'],
      football: ['League', 'Cup', 'Friendly'],
      badminton: ['Knockout', 'Round Robin', 'Group + Knockout', 'Double Elimination', 'Singles', 'Doubles', 'Mixed Doubles'],
    };
    const validFormats = validFormatsMap[sport] || validFormatsMap.cricket;
    if (!validFormats.includes(value)) {
      throw new Error(`Format must be one of: ${validFormats.join(', ')}`);
    }
    return true;
  }),
  body('location').optional().trim(),
  body('venue').optional().trim(),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
  body('maxTeams').optional().isInt({ min: 2 }).withMessage('Max teams must be at least 2'),
  body('description').optional().trim(),
];

export const updateStatusValidator = [
  param('id').isMongoId().withMessage('Invalid tournament ID'),
  body('status')
    .isIn(['draft', 'registration', 'active', 'completed', 'cancelled'])
    .withMessage('Invalid status value'),
];

export const listTournamentsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['draft', 'registration', 'active', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
];
