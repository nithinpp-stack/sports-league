import { body, param, query } from 'express-validator';

export const createPlayerValidator = [
  body('name').trim().notEmpty().withMessage('Player name is required'),
  body('sport').optional().isIn(['cricket', 'football']).withMessage("Sport must be 'cricket' or 'football'"),
  body('skill')
    .isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper', 'goalkeeper', 'defender', 'midfielder', 'forward'])
    .withMessage("Skill must be one of: batsman, bowler, allrounder, wicketkeeper, goalkeeper, defender, midfielder, forward"),
  body('age')
    .optional()
    .isInt({ min: 10, max: 70 })
    .withMessage('Age must be between 10 and 70'),
  body('battingStyle')
    .optional()
    .isIn(['right-hand', 'left-hand'])
    .withMessage("Batting style must be 'right-hand' or 'left-hand'"),
  body('bowlingStyle')
    .optional()
    .isIn(['fast', 'medium', 'spin', 'none'])
    .withMessage("Bowling style must be 'fast', 'medium', 'spin', or 'none'"),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  body('photo').optional().trim(),
  body('basePrice').optional().isNumeric().withMessage('Base price must be a number'),
  body('tournamentId').optional().isMongoId().withMessage('Invalid tournament ID'),
  body('userId').optional().isMongoId().withMessage('Invalid user ID'),
];

export const updatePlayerValidator = [
  param('id').isMongoId().withMessage('Invalid player ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('sport').optional().isIn(['cricket', 'football']).withMessage("Sport must be 'cricket' or 'football'"),
  body('skill')
    .optional()
    .isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper', 'goalkeeper', 'defender', 'midfielder', 'forward'])
    .withMessage('Invalid skill'),
  body('age')
    .optional()
    .isInt({ min: 10, max: 70 })
    .withMessage('Age must be between 10 and 70'),
  body('battingStyle')
    .optional()
    .isIn(['right-hand', 'left-hand'])
    .withMessage('Invalid batting style'),
  body('bowlingStyle')
    .optional()
    .isIn(['fast', 'medium', 'spin', 'none'])
    .withMessage('Invalid bowling style'),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  body('photo').optional().trim(),
  body('basePrice').optional().isNumeric().withMessage('Base price must be a number'),
];

export const registerTournamentValidator = [
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
];

export const listPlayersValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('tournamentId').optional().isMongoId().withMessage('Invalid tournament ID'),
  query('teamId').optional().isMongoId().withMessage('Invalid team ID'),
  query('skill')
    .optional()
    .isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper', 'goalkeeper', 'defender', 'midfielder', 'forward'])
    .withMessage('Invalid skill'),
  query('status')
    .optional()
    .isIn(['available', 'sold', 'unsold', 'registered'])
    .withMessage('Invalid status'),
];
