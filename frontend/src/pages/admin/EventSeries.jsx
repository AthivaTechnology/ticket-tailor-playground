import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, AlertTriangle, X, Globe, EyeOff, Eye } from 'lucide-react';
import api from '../../services/api';

const EventSeries = () => {
    const [series, setSeries] = useState([]);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    useEffect(() => {
        fetchSeries();
    }, []);

    const fetchSeries = async () => {
        try {
            const res = await api.get('/event_series');
            setSeries(res.data.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingId) {
                await api.put(`/event_series/${editingId}`, { name });
            } else {
                await api.post('/event_series', { name });
            }
            setName('');
            setEditingId(null);
            fetchSeries();
        } catch (err) {
            console.error(err);
            alert("Failed to save event series. Check console.");
        }
        setLoading(false);
    };

    const handleEdit = (s) => {
        setEditingId(s.id);
        setName(s.name);
        window.scrollTo(0, 0);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await api.delete(`/event_series/${deleteConfirmId}`);
            setDeleteConfirmId(null);
            fetchSeries();
        } catch (err) {
            console.error(err);
            alert("Failed to delete event series.");
        }
    };

    const handlePublish = async (id) => {
        try {
            setLoading(true);
            await api.post(`/event_series/${id}/publish`);
            fetchSeries(); // Re-fetch to see the updated status
        } catch (err) {
            console.error(err);
            alert("Failed to publish event series.");
        } finally {
            setLoading(false);
        }
    };

    const handleUnpublish = async (id) => {
        try {
            setLoading(true);
            await api.post(`/event_series/${id}/unpublish`);
            fetchSeries(); // Re-fetch to see the updated status
        } catch (err) {
            console.error(err);
            alert("Failed to unpublish event series.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Event Series</h1>
            </div>

            <div className="glass-card p-6 border-l-4 border-l-brand-500">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-brand-300">
                        {editingId ? 'Edit Series' : 'Create New Series'}
                    </h2>
                    {editingId && (
                        <button
                            onClick={() => { setEditingId(null); setName(''); }}
                            className="text-sm text-gray-400 hover:text-white"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-3">
                        <label className="label-styled">Series Name</label>
                        <input
                            type="text"
                            className="input-styled"
                            placeholder="e.g. React Bootcamp 2026"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary flex justify-center items-center gap-2 h-[52px]" disabled={loading}>
                        {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        {editingId ? 'Save' : 'Create'}
                    </button>
                </form>
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400">
                        <tr>
                            <th className="p-4 rounded-tl-xl w-32">ID</th>
                            <th className="p-4">Name</th>
                            <th className="p-4 w-32">Events Count</th>
                            <th className="p-4 w-24">Status</th>
                            <th className="p-4 rounded-tr-xl w-24 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {series.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="p-4 text-center text-gray-500">No event series found or Check API configuration.</td>
                            </tr>
                        ) : (
                            series.map((s) => (
                                <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4 text-gray-400 font-mono text-sm">{s.id}</td>
                                    <td className="p-4 font-medium text-white">{s.name}</td>
                                    <td className="p-4 text-gray-300">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                                            {s.total_occurrences || 0} Events
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {s.status === 'published' ? (
                                            <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs shadow-sm">Published</span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs shadow-sm capitalize">{s.status || 'Draft'}</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link to={`/admin/event-series/${s.id}`} className="p-1.5 bg-white/5 hover:bg-blue-500/20 text-gray-300 hover:text-blue-400 rounded transition-colors" title="View Series Details">
                                                <Eye className="w-4 h-4" />
                                            </Link>
                                            {s.status !== 'published' ? (
                                                <button
                                                    onClick={() => handlePublish(s.id)}
                                                    className="p-1.5 bg-white/5 hover:bg-brand-500/20 text-gray-300 hover:text-brand-300 rounded transition-colors"
                                                    title="Publish Series"
                                                    disabled={loading}
                                                >
                                                    <Globe className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleUnpublish(s.id)}
                                                    className="p-1.5 bg-white/5 hover:bg-orange-500/20 text-gray-300 hover:text-orange-400 rounded transition-colors"
                                                    title="Unpublish (Return to Draft)"
                                                    disabled={loading}
                                                >
                                                    <EyeOff className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleEdit(s)}
                                                className="p-1.5 bg-white/5 hover:bg-brand-500/20 text-gray-300 hover:text-brand-300 rounded transition-colors"
                                                title="Edit Series"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => window.location.href = `/admin/events?series_id=${s.id}`}
                                                className="p-1.5 bg-white/5 hover:bg-green-500/20 text-gray-300 hover:text-green-400 rounded transition-colors"
                                                title="Add Event to Series"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(s.id)}
                                                className="p-1.5 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded transition-colors"
                                                title="Delete Series"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 p-6 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in relative transition-all">
                        <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-1">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Delete Event Series?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Are you sure you want to permanently delete this event series? <br />
                                <strong className="text-red-400 font-medium block mt-2">Warning: All events and tickets inside this series will be wiped.</strong>
                            </p>

                            <div className="flex w-full gap-3 mt-6 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-white transition-colors font-medium shadow-lg shadow-red-500/20"
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventSeries;
