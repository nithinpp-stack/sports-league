import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import dayjs from 'dayjs';
import Select from '../components/ui/Select';
import { useConfirm } from '../components/ui/ConfirmModal';

/* ═══════════════════════════════════════════════════════════════════════════════
   LIST VIEW — "All Roles"
   ═══════════════════════════════════════════════════════════════════════════════ */

function RoleList({ onNew }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/admin/roles').then((r) => r.data),
  });

  const { data: adminsData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => { toast.success('Role deleted'); qc.invalidateQueries(['roles']); },
    onError: (err) => toast.error(err.response?.data?.message || 'Cannot delete role'),
  });

  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.roles ?? [];
  const admins = Array.isArray(adminsData) ? adminsData : adminsData?.users ?? [];

  const memberCounts = useMemo(() => {
    const c = {};
    admins.forEach((a) => { const rid = a.roleId?._id || a.roleId; if (rid) c[rid] = (c[rid] || 0) + 1; });
    return c;
  }, [admins]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">All Roles</h2>
        <button onClick={onNew} className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors">
          Create
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading roles...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Members</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created Date</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.map((role) => (
                <tr key={role._id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/roles/${role._id}`)}>
                  <td className="px-6 py-4"><span className="text-sm font-medium text-blue-700">{role.name}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{memberCounts[role._id] || 0}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{dayjs(role.createdAt).format('DD-MMM-YYYY')}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${role.status === 'active' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
                      {role.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    {!(role.permissions?.includes('*')) && (
                      <button onClick={async () => { if (await confirm(`Delete "${role.name}"?`, { variant: 'danger', confirmText: 'Delete' })) deleteMutation.mutate(role._id); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {!roles.length && <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No roles found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   EDIT / CREATE VIEW — "Role Management" with nested permission groups
   ═══════════════════════════════════════════════════════════════════════════════ */

function RoleForm({ roleId }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !roleId;

  const [form, setForm] = useState({ name: '', level: 1, status: 'active' });
  const [checkedPerms, setCheckedPerms] = useState({});

  const { data: schemaData, isLoading: schemaLoading } = useQuery({
    queryKey: ['role-permissions-schema'],
    queryFn: () => api.get('/admin/roles/permissions').then((r) => r.data),
  });

  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ['role', roleId],
    queryFn: () => api.get(`/admin/roles/${roleId}`).then((r) => r.data),
    enabled: !!roleId,
  });

  useEffect(() => {
    if (roleData) {
      const r = roleData?.role || roleData;
      if (r) {
        setForm({ name: r.name ?? '', level: r.level ?? 1, status: r.status ?? 'active' });
        const map = {};
        (r.permissions ?? []).forEach((p) => { map[p] = true; });
        setCheckedPerms(map);
      }
    }
  }, [roleData]);

  const saveMutation = useMutation({
    mutationFn: (payload) => isNew ? api.post('/admin/roles', payload) : api.put(`/admin/roles/${roleId}`, payload),
    onSuccess: () => { toast.success(isNew ? 'Role created!' : 'Role updated!'); qc.invalidateQueries(['roles']); navigate('/roles'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save role'),
  });

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Role name is required'); return; }
    const permissions = Object.entries(checkedPerms).filter(([, v]) => v).map(([k]) => k);
    saveMutation.mutate({ ...form, level: Number(form.level), permissions });
  };

  const togglePerm = (key) => setCheckedPerms((prev) => ({ ...prev, [key]: !prev[key] }));

  const schema = Array.isArray(schemaData) ? schemaData : [];

  // All permission keys (flattened from new menu→children format)
  const allPermKeys = useMemo(() =>
    schema.flatMap((item) => [item.key, ...(item.children?.map((c) => c.key) || [])]),
    [schema]
  );
  const allChecked = allPermKeys.length > 0 && allPermKeys.every((k) => checkedPerms[k]);

  const toggleSelectAll = () => {
    const newVal = !allChecked;
    const updates = {};
    allPermKeys.forEach((k) => { updates[k] = newVal; });
    setCheckedPerms((prev) => ({ ...prev, ...updates }));
  };

  // Toggle a menu item: ON → enable main key; OFF → disable main + all children
  const toggleMenu = (item) => {
    const isOn = !!checkedPerms[item.key];
    const updates = { [item.key]: !isOn };
    if (isOn) {
      // Turning OFF — also remove all children
      (item.children || []).forEach((c) => { updates[c.key] = false; });
    }
    setCheckedPerms((prev) => ({ ...prev, ...updates }));
  };

  // Toggle a sub-permission (child)
  const toggleChild = (parentKey, childKey) => {
    setCheckedPerms((prev) => {
      const next = { ...prev, [childKey]: !prev[childKey] };
      // If turning on a child, ensure parent is also on
      if (!prev[childKey]) next[parentKey] = true;
      return next;
    });
  };

  const loading = schemaLoading || roleLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/roles" className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Roles
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">{roleId ? 'Edit Role' : 'Create Role'}</h2>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">Loading...</div>
      ) : (
        <>
          {/* ─── Top Fields ─── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Event Manager"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Level</label>
                <input type="number" min={1} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            </div>
          </div>

          {/* ─── Permissions ─── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header with Select All */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Permissions</h3>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={allChecked} onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-400 text-gray-900 focus:ring-gray-500 cursor-pointer" />
                <span className="text-xs font-semibold text-gray-600">Select All</span>
              </label>
            </div>

            {/* Menu Items */}
            <div className="divide-y divide-gray-100">
              {schema.map((item) => {
                const menuOn = !!checkedPerms[item.key];
                const hasChildren = item.children?.length > 0;
                return (
                  <div key={item.key} className="px-6 py-4">
                    {/* Main menu toggle */}
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={menuOn}
                        onChange={() => toggleMenu(item)}
                        className="w-4 h-4 rounded border-gray-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className={`text-sm font-semibold ${menuOn ? 'text-gray-900' : 'text-gray-500'}`}>{item.menu}</span>
                    </label>

                    {/* Sub-permissions */}
                    {hasChildren && (
                      <div className={`flex flex-wrap gap-x-6 gap-y-2 mt-3 ml-7 ${!menuOn ? 'opacity-40 pointer-events-none' : ''}`}>
                        {item.children.map((child) => {
                          const childOn = !!checkedPerms[child.key];
                          return (
                            <label key={child.key} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={childOn}
                                onChange={() => toggleChild(item.key, child.key)}
                                disabled={!menuOn}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span className={`text-sm ${childOn ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{child.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saveMutation.isPending} className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60">
              {saveMutation.isPending ? 'Saving...' : roleId ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ROOT
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function RoleManagement() {
  const { id } = useParams();
  const [createMode, setCreateMode] = useState(false);
  if (id) return <RoleForm roleId={id} />;
  if (createMode) return <RoleForm roleId={null} />;
  return <RoleList onNew={() => setCreateMode(true)} />;
}
