import React, { useState, useEffect } from 'react';
import { Tag, Trash2, Edit2, CheckCircle2, XCircle, AlertTriangle, X, RefreshCw, ChevronDown, ChevronUp, Calendar, Layers } from 'lucide-react';
import api from '../../services/api';

const Discounts = () => {
    const [discounts, setDiscounts] = useState([]);
    const [ticketTypes, setTicketTypes] = useState([]);
    const [events, setEvents] = useState([]);
    const [series, setSeries] = useState([]);
    const [formData, setFormData] = useState({ code: '', percentage: '' });
    const [loading, setLoading] = useState(false);
    const [editDiscount, setEditDiscount] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [expandedDiscount, setExpandedDiscount] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const clampPct = (val) => Math.min(100, Math.max(0, Number(val) || 0));

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            const [dRes, ttRes, eRes, sRes] = await Promise.all([
                api.get('/discounts'),
                api.get('/ticket_types'),
                api.get('/events'),
                api.get('/event_series'),
            ]);
            setDiscounts(dRes.data.data || []);
            setTicketTypes(ttRes.data.data || []);
            setEvents(eRes.data.data || []);
            setSeries(sRes.data.data || []);
        } catch (err) { console.error(err); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/discounts', formData);
            setFormData({ code: '', percentage: '' });
            fetchAll();
            showToast('Discount code created!');
        } catch (err) {
            console.error(err);
            showToast('Failed to create discount.', 'error');
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editDiscount) return;
        try {
            await api.put(`/discounts/${editDiscount.id}`, {
                code: editDiscount.editCode,
                percentage: parseFloat(editDiscount.editPct),
            });
            setEditDiscount(null);
            fetchAll();
            showToast('Discount updated successfully!');
        } catch (err) {
            console.error(err);
            showToast('Failed to update discount.', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await api.delete(`/discounts/${deleteConfirm.id}`);
            setDeleteConfirm(null);
            fetchAll();
            showToast('Discount removed.');
        } catch (err) {
            console.error(err);
            showToast('Failed to delete discount.', 'error');
        }
    };

    // Resolve "Applies To" to human-readable names
    // Try multiple strategies to find the ticket name from Ticket Tailor's IDs
    const findTicketByAnyId = (rawId) => {
        if (!rawId) return null;
        const stripped = String(rawId).replace(/^tt_/, '');
        return ticketTypes.find(t =>
            t.id === rawId ||
            t.id === `tt_${rawId}` ||
            String(t.id).replace(/^tt_/, '') === stripped
        ) || null;
    };

    const makeTicketPill = (ticketObj, id) => {
        // ticketObj may come directly from the discount's embedded ticket_types (may lack name)
        const local = findTicketByAnyId(id || ticketObj?.id);
        const name = local?.name || ticketObj?.name;

        if (!name) {
            // Last resort: show a short clean ID
            const shortId = String(id || ticketObj?.id || '').replace(/^tt_/, '');
            return { label: `Ticket #${shortId}`, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
        }

        const evt = local ? events.find(e => e.id === local.event_id) : null;
        const ser = evt ? series.find(s => s.id === evt.event_series_id) : null;
        const parts = [name];
        if (evt) parts.push(new Date(evt.start.iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }));
        if (ser) parts.push(ser.name);
        return { label: parts.join(' · '), color: 'text-brand-300 bg-brand-500/10 border-brand-500/20' };
    };

    const resolveAppliesTo = (d) => {
        const ttList = Array.isArray(d.ticket_types) ? d.ticket_types : [];
        const idList = Array.isArray(d.ticket_type_ids) ? d.ticket_type_ids : [];

        // Objects from the API (may have name or just id)
        const objects = ttList.filter(t => t && typeof t === 'object');
        if (objects.length > 0) return objects.map(t => makeTicketPill(t, t.id));

        // String IDs
        const strings = [...ttList.filter(t => typeof t === 'string'), ...idList];
        if (strings.length > 0) return strings.map(id => makeTicketPill(null, id));

        return [{ label: 'All Tickets', color: 'text-green-400 bg-green-500/10 border-green-500/20' }];
    };

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Discount Codes</h1>
                <button onClick={fetchAll} className="p-2 bg-white/5 hover:bg-brand-500/20 text-gray-400 hover:text-brand-300 rounded-full transition-colors group" title="Sync discounts">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                </button>
            </div>

            {/* ── Create Form ── */}
            <div className="glass-card p-6 border-l-4 border-l-brand-400">
                <h2 className="text-lg font-bold text-white mb-4">Issue a New Global Discount Code</h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="label-styled">Code</label>
                        <input name="code" type="text" className="input-styled uppercase" placeholder="EARLY2026" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} required />
                    </div>
                    <div>
                        <label className="label-styled">Percentage (%)</label>
                        <div className="relative">
                            <input
                                name="percentage" type="number" className="input-styled pr-12"
                                placeholder="10" min="0" max="100" step="1"
                                value={formData.percentage}
                                onChange={e => setFormData({ ...formData, percentage: Math.min(100, Math.max(0, Number(e.target.value))) })}
                                required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">%</span>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary flex justify-center items-center gap-2 h-[52px]" disabled={loading}>
                        <Tag className="w-5 h-5" /> Create
                    </button>
                </form>
            </div>

            {/* ── Discounts Table ── */}
            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400 text-sm">
                        <tr>
                            <th className="p-4">Code</th>
                            <th className="p-4">Discount</th>
                            <th className="p-4">Applies To</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {discounts.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500 italic">No discount codes found.</td></tr>
                        ) : discounts.map(d => {
                            const appliesTo = resolveAppliesTo(d);
                            const isExpanded = expandedDiscount === d.id;
                            const ttObjects = (Array.isArray(d.ticket_types) ? d.ticket_types : []).filter(t => t && typeof t === 'object');

                            return (
                                <React.Fragment key={d.id}>
                                    <tr
                                        onClick={() => setExpandedDiscount(isExpanded ? null : d.id)}
                                        className={`cursor-pointer transition-colors group ${isExpanded ? 'bg-brand-500/5 border-brand-500/10' : 'hover:bg-white/5'}`}
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {isExpanded
                                                    ? <ChevronUp className="w-4 h-4 text-brand-400 flex-shrink-0" />
                                                    : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0 group-hover:text-gray-300" />}
                                                <span className="font-bold font-mono text-brand-300 text-lg tracking-widest">{d.code}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-2xl font-bold text-white">
                                                {d.type === 'percentage' ? `${d.face_value_percentage}%` : `$${(d.face_value_amount / 100).toFixed(2)}`}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-2">off</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                {appliesTo.map((a, i) => (
                                                    <span key={i} className={`text-xs px-2 py-1 rounded border ${a.color} max-w-xs truncate`} title={a.label}>
                                                        {a.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium">Active</span>
                                        </td>
                                        <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditDiscount({ ...d, editCode: d.code, editPct: d.face_value_percentage || '' })}
                                                    className="p-2 bg-brand-500/10 hover:bg-brand-500/30 text-brand-400 rounded transition-colors"
                                                    title="Edit Discount"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(d)}
                                                    className="p-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                                                    title="Delete Discount"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Detail Panel */}
                                    {isExpanded && (
                                        <tr className="bg-dark-900/60">
                                            <td colSpan="5" className="p-0 border-t border-brand-500/10">
                                                <div className="p-6 space-y-4">
                                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Applied To Details — <span className="text-brand-300 font-mono">{d.code}</span></h4>

                                                    {ttObjects.length === 0 ? (
                                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                                                            <div className="p-2 rounded-lg bg-green-500/10 text-green-400"><Layers className="w-5 h-5" /></div>
                                                            <div>
                                                                <p className="font-bold text-green-400">Global Discount</p>
                                                                <p className="text-xs text-gray-400">Applies to all ticket types across every event and series</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                            {ttObjects.map(t => {
                                                                const local = findTicketByAnyId(t.id);
                                                                const evt = local ? events.find(e => e.id === local.event_id) : null;
                                                                const ser = evt ? series.find(s => s.id === evt.event_series_id) : null;
                                                                const name = local?.name || t.name;
                                                                const shortId = String(t.id || '').replace(/^tt_/, '');
                                                                return (
                                                                    <div key={t.id} className="bg-dark-800/70 rounded-xl border border-white/5 hover:border-brand-500/20 transition-colors overflow-hidden">
                                                                        {/* Ticket row */}
                                                                        <div className="p-4 border-b border-white/5">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Ticket Type</span>
                                                                            </div>
                                                                            <p className="font-bold text-white text-base">{name || `#${shortId}`}</p>
                                                                            <p className="text-xs font-mono text-gray-600 mt-0.5">{t.id}</p>
                                                                        </div>
                                                                        {/* Event row */}
                                                                        {evt && (
                                                                            <div className="px-4 py-3 border-b border-white/5 flex items-start gap-2">
                                                                                <Calendar className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                                                                                <div>
                                                                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Event</p>
                                                                                    <p className="text-sm text-gray-200">{evt.name}</p>
                                                                                    <p className="text-xs text-gray-500">{new Date(evt.start.iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {/* Series row */}
                                                                        {ser && (
                                                                            <div className="px-4 py-3 flex items-start gap-2">
                                                                                <Layers className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                                                <div>
                                                                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Series</p>
                                                                                    <p className="text-sm text-gray-200">{ser.name}</p>
                                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ser.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{ser.status}</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {!evt && !ser && (
                                                                            <div className="px-4 py-3 text-xs text-gray-600 italic">Event/Series details not found locally</div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Edit Modal ── */}
            {editDiscount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-dark-900 to-black border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                        <button onClick={() => setEditDiscount(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl font-bold text-white mb-6">Edit Discount</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="label-styled">Code</label>
                                <input
                                    type="text"
                                    className="input-styled uppercase"
                                    value={editDiscount.editCode}
                                    onChange={e => setEditDiscount({ ...editDiscount, editCode: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div>
                                <label className="label-styled">Percentage (%)</label>
                                <div className="relative">
                                    <input
                                        type="number" className="input-styled pr-12"
                                        min="0" max="100" step="1"
                                        value={editDiscount.editPct}
                                        onChange={e => setEditDiscount({ ...editDiscount, editPct: Math.min(100, Math.max(0, Number(e.target.value))) })}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">%</span>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setEditDiscount(null)} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium">
                                    Cancel
                                </button>
                                <button onClick={handleUpdate} className="flex-1 px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white transition-colors font-bold shadow-lg">
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm Modal ── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-dark-900 to-black border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                        <button onClick={() => setDeleteConfirm(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Delete Discount?</h3>
                            <p className="text-gray-400 text-sm">
                                Are you sure you want to permanently remove the code <strong className="text-white font-mono">{deleteConfirm.code}</strong>? This cannot be undone.
                            </p>
                            <div className="flex w-full gap-3">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium">
                                    Cancel
                                </button>
                                <button onClick={handleDelete} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-bold shadow-lg shadow-red-500/25">
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            <div className={`fixed bottom-8 right-8 z-50 transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    <span className="font-medium text-lg">{toast.message}</span>
                </div>
            </div>
        </div>
    );
};

export default Discounts;
