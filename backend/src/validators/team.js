import { body, param, query } from 'express-validator';

export const createTeamValidator = [
  body('name').trim().notEmpty().withMessage('Team name is required'),
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
  body('ownerId').optional().isMongoId().withMessage('Invalid owner ID'),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
  body('logo').optional().trim(),
];

export const updateTeamValidator = [
  param('id').isMongoId().withMessage('Invalid team ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('logo').optional().trim(),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
  body('ownerId').optional().isMongoId().withMessage('Invalid owner ID'),
];

export const listTeamsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('tournamentId').optional().isMongoId().withMessage('Invalid tournament ID'),
];
