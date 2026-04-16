import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'player', phone: '', address: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const extra = {};
      if (form.phone) extra.phone = form.phone;
      if (form.address) extra.address = form.address;
      await register(form.name, form.email, form.password, form.role, extra);
      toast.success('Account created! Welcome!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-colors";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1";

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-slate-200 dark:border-gray-800">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-emerald-600 dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create your account</h1>
            <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Join the SportsLeague platform today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Full name</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="John Smith" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email address</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} required placeholder="••••••••" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="player">Player</option>
                <option value="team_owner">Team Owner</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  Phone <span className="text-slate-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 234 567 8901" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>
                  Address <span className="text-slate-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <input type="text" name="address" value={form.address} onChange={handleChange} placeholder="123 Main St" className={inputClass} />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-slate-500 dark:text-gray-400 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
