import Manager from '../models/Manager.js';

export const listManagers = async (req, res, next) => {
  try {
    const { tournamentId } = req.query;
    const filter = {};
    if (tournamentId) filter.tournamentId = tournamentId;
    const managers = await Manager.find(filter).populate('tournamentId', 'name').sort({ createdAt: -1 });
    res.json({ success: true, data: { managers } });
  } catch (error) { next(error); }
};

export const createManager = async (req, res, next) => {
  try {
    const { name, email, phone, tournamentId } = req.body;
    if (!name || !tournamentId) return res.status(400).json({ success: false, message: 'Name and tournamentId are required' });
    const manager = await Manager.create({ name, email, phone, tournamentId });
    res.status(201).json({ success: true, data: { manager } });
  } catch (error) { next(error); }
};

export const updateManager = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    const manager = await Manager.findByIdAndUpdate(req.params.id, { name, email, phone }, { new: true });
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found' });
    res.json({ success: true, data: { manager } });
  } catch (error) { next(error); }
};

export const deleteManager = async (req, res, next) => {
  try {
    const manager = await Manager.findByIdAndDelete(req.params.id);
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found' });
    res.json({ success: true, data: { message: 'Manager deleted' } });
  } catch (error) { next(error); }
};
