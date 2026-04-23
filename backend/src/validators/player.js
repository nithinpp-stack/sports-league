import { body, param, query } from 'express-validator';

const BADMINTON_EVENTS = ['mens_singles', 'womens_singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];

// Skills that only make sense for a given sport — used to reject mismatched combos at the API layer
// (the Mongoose hook cleans up at persistence, but we want 400s instead of silent fixes at the edge).
const CRICKET_SKILLS = new Set(['batsman', 'bowler', 'allrounder', 'wicketkeeper']);
const FOOTBALL_SKILLS = new Set(['goalkeeper', 'defender', 'midfielder', 'forward']);
const BADMINTON_SKILLS = new Set(['shuttler']);

const eventsValidator = (field) =>
  body(field)
    .optional()
    .isArray()
    .withMessage(`${field} must be an array`)
    .bail()
    .custom((arr) => arr.every((ev) => BADMINTON_EVENTS.includes(ev)))
    .withMessage(`${field} entries must be one of: ${BADMINTON_EVENTS.join(', ')}`);

// Reject combinations that don't fit the declared sport — prevents football + bowlingStyle
// or badminton + battingStyle from sneaking into the DB via the admin UI.
const crossSportCheck = body().custom((value) => {
  const { sport, skill, battingStyle, bowlingStyle, events } = value || {};
  if (!sport) return true; // sport is optional — defaults to cricket in the model
  if (sport !== 'cricket' && (battingStyle || bowlingStyle)) {
    throw new Error('battingStyle / bowlingStyle are cricket-only fields');
  }
  if (sport !== 'badminton' && Array.isArray(events) && events.length > 0) {
    throw new Error('events[] is a badminton-only field');
  }
  if (skill) {
    if (sport === 'cricket' && !CRICKET_SKILLS.has(skill)) {
      throw new Error(`Skill '${skill}' is not valid for cricket`);
    }
    if (sport === 'football' && !FOOTBALL_SKILLS.has(skill)) {
      throw new Error(`Skill '${skill}' is not valid for football`);
    }
    if (sport === 'badminton' && !BADMINTON_SKILLS.has(skill)) {
      throw new Error(`Skill '${skill}' is not valid for badminton`);
    }
  }
  return true;
});

export const createPlayerValidator = [
  body('name').trim().notEmpty().withMessage('Player name is required'),
  body('sport').optional().isIn(['cricket', 'football', 'badminton']).withMessage("Sport must be 'cricket', 'football', or 'badminton'"),
  body('skill')
    .isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper', 'goalkeeper', 'defender', 'midfielder', 'forward', 'shuttler'])
    .withMessage("Skill must be one of: batsman, bowler, allrounder, wicketkeeper, goalkeeper, defender, midfielder, forward, shuttler"),
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
  eventsValidator('events'),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  body('photo').optional().trim(),
  body('basePrice').optional().isNumeric().withMessage('Base price must be a number'),
  body('tournamentId').optional().isMongoId().withMessage('Invalid tournament ID'),
  body('userId').optional().isMongoId().withMessage('Invalid user ID'),
  crossSportCheck,
];

export const updatePlayerValidator = [
  param('id').isMongoId().withMessage('Invalid player ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('sport').optional().isIn(['cricket', 'football', 'badminton']).withMessage("Sport must be 'cricket', 'football', or 'badminton'"),
  body('skill')
    .optional()
    .isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper', 'goalkeeper', 'defender', 'midfielder', 'forward', 'shuttler'])
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
  eventsValidator('events'),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  body('photo').optional().trim(),
  body('basePrice').optional().isNumeric().withMessage('Base price must be a number'),
  crossSportCheck,
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
  query('sport')
    .optional()
    .isIn(['cricket', 'football', 'badminton'])
    .withMessage("Sport must be 'cricket', 'football', or 'badminton'"),
  query('skill')
    .optional()
    .isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper', 'goalkeeper', 'defender', 'midfielder', 'forward', 'shuttler'])
    .withMessage('Invalid skill'),
  query('status')
    .optional()
    .isIn(['available', 'sold', 'unsold', 'registered'])
    .withMessage('Invalid status'),
  query('unassigned')
    .optional()
    .isIn(['true', 'false'])
    .withMessage("unassigned must be 'true' or 'false'"),
];
