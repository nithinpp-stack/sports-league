import Role from '../models/Role.js';
import Admin from '../models/Admin.js';

// Permission schema — hierarchical: menu (main permission) → sub-permissions
const PERMISSION_SCHEMA = [
  { menu: 'Dashboard', key: 'dashboard.access', children: [] },
  { menu: 'Roles', key: 'roles.view', children: [
    { key: 'roles.create', label: 'Create' },
    { key: 'roles.edit', label: 'Edit' },
    { key: 'roles.delete', label: 'Delete' },
  ]},
  { menu: 'Admin Users', key: 'admins.view', children: [
    { key: 'admins.create', label: 'Create' },
    { key: 'admins.edit', label: 'Edit' },
    { key: 'admins.delete', label: 'Delete' },
  ]},
  { menu: 'Registrations', key: 'registrations.view', children: [
    { key: 'registrations.manage', label: 'Manage' },
  ]},
  { menu: 'Tournaments', key: 'tournaments.view', children: [
    { key: 'tournaments.create', label: 'Create' },
    { key: 'tournaments.edit', label: 'Edit' },
    { key: 'tournaments.delete', label: 'Delete' },
  ]},
  { menu: 'Teams', key: 'teams.view', children: [
    { key: 'teams.create', label: 'Create' },
    { key: 'teams.edit', label: 'Edit' },
    { key: 'teams.delete', label: 'Delete' },
  ]},
  { menu: 'Managers', key: 'managers.view', children: [
    { key: 'managers.create', label: 'Create' },
    { key: 'managers.delete', label: 'Delete' },
  ]},
  { menu: 'Players', key: 'players.view', children: [
    { key: 'players.create', label: 'Create' },
    { key: 'players.edit', label: 'Edit' },
    { key: 'players.assign', label: 'Assign' },
  ]},
  { menu: 'Matches', key: 'matches.view', children: [
    { key: 'matches.create', label: 'Create' },
    { key: 'matches.edit', label: 'Edit' },
    { key: 'matches.delete', label: 'Delete' },
    { key: 'matches.score', label: 'Score' },
  ]},
  { menu: 'Auctions', key: 'auctions.view', children: [
    { key: 'auctions.manage', label: 'Manage' },
    { key: 'auctions.bid', label: 'Bid' },
  ]},
  { menu: 'Ads', key: 'ads.view', children: [
    { key: 'ads.create', label: 'Create' },
    { key: 'ads.edit', label: 'Edit' },
    { key: 'ads.delete', label: 'Delete' },
  ]},
];

export const getPermissionSchema = (req, res) => {
  res.json({ success: true, data: PERMISSION_SCHEMA });
};

export const listRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ level: 1 });
    res.json({ success: true, data: { roles } });
  } catch (error) { next(error); }
};

export const getRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    res.json({ success: true, data: { role } });
  } catch (error) { next(error); }
};

export const createRole = async (req, res, next) => {
  try {
    const { name, level, status, permissions } = req.body;
    const role = await Role.create({ name, level, status, permissions });
    res.status(201).json({ success: true, data: { role } });
  } catch (error) { next(error); }
};

export const updateRole = async (req, res, next) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    res.json({ success: true, data: { role } });
  } catch (error) { next(error); }
};

export const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (role.isDefault) return res.status(400).json({ success: false, message: 'Cannot delete default roles' });
    // Check if any admins use this role
    const adminCount = await Admin.countDocuments({ roleId: role._id });
    if (adminCount > 0) return res.status(400).json({ success: false, message: `${adminCount} admin(s) use this role. Reassign them first.` });
    await Role.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: { message: 'Role deleted' } });
  } catch (error) { next(error); }
};
