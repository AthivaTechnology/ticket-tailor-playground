import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, XCircle, Trash2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, X } from 'lucide-react';
import api from '../../services/api';

const TicketTypes = () => {
    const [tickets, setTickets] = useState([]);
    const [events, setEvents] = useState([]);
    const [series, setSeries] = useState([]);
    const [formData, setFormData] = useState({ name: '', type: 'paid', price: '', quantity: '', max_per_order: '10', event_id: '', group_id: '' });
    const [groupForm, setGroupForm] = useState({ name: '', series_id: '' });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, ticketId?, eventId?, seriesId?, groupId?, label }

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    useEffect(() => {
        fetchEvents();
        fetchSeries();
        fetchTickets();
    }, []);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/events');
            setEvents(res.data.data || []);
        } catch (err) { console.error(err); }
    };

    const fetchTickets = async () => {
        try {
            const res = await api.get('/ticket_types');
            setTickets(res.data.data || []);
        } catch (err) { console.error(err); }
    };

    const fetchSeries = async () => {
        try {
            const res = await api.get('/event_series');
            setSeries(res.data.data || []);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { ...formData, price: formData.type === 'free' ? 0 : formData.price };
            if (!payload.group_id) delete payload.group_id;
            await api.post('/ticket_types', payload);
            setFormData({ name: '', type: 'paid', price: '', quantity: '', max_per_order: '10', event_id: '', group_id: '' });
            fetchTickets();
            showToast("Ticket Type safely issued!");
        } catch (err) {
            console.error(err);
            showToast("Failed to create ticket type.", "error");
        }
        setLoading(false);
    };

    const handleGroupSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post(`/event_series/${groupForm.series_id}/ticket_groups`, { name: groupForm.name });
            setGroupForm({ name: '', series_id: '' });
            fetchSeries(); // Refresh groups
            showToast("Ticket Group created successfully!");
        } catch (err) {
            console.error(err);
            showToast("Failed to create ticket group.", "error");
        }
        setLoading(false);
    };

    const handleDeleteTicket = (ticketId, eventId, name) => {
        setDeleteConfirm({ type: 'ticket', ticketId, eventId, label: name || 'this Ticket Type' });
    };

    const handleDeleteGroup = (seriesId, groupId, name) => {
        setDeleteConfirm({ type: 'group', seriesId, groupId, label: name || 'this Ticket Group' });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        try {
            if (deleteConfirm.type === 'ticket') {
                await api.delete(`/ticket_types/${deleteConfirm.ticketId}`, { params: { event_id: deleteConfirm.eventId } });
                fetchTickets();
                showToast('Ticket Type safely deleted.', 'success');
            } else {
                await api.delete(`/event_series/${deleteConfirm.seriesId}/ticket_groups/${deleteConfirm.groupId}`);
                fetchSeries();
                showToast('Ticket Group removed.', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast(
                deleteConfirm.type === 'ticket'
                    ? 'Failed to delete. Tickets cannot be deleted if already sold.'
                    : 'Failed to delete Ticket Group.',
                'error'
            );
        }
        setDeleteConfirm(null);
    };

    // Calculate available groups for selected event
    const activeSeriesId = events.find(e => e.id === formData.event_id)?.event_series_id;
    const availableGroups = series.find(s => s.id === activeSeriesId)?.default_ticket_groups || [];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Manage Ticket Content</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* CREATE TICKET GROUP FORM */}
                <div className="glass-card p-6 border-l-4 border-l-brand-400">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Create Ticket Group</h2>
                        <button onClick={fetchSeries} className="p-2 bg-white/5 hover:bg-brand-500/20 text-gray-400 hover:text-brand-300 rounded-full transition-colors group" title="Sync Layout Data">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                        </button>
                    </div>
                    <p className="text-sm text-gray-400 mb-6">Organize tickets into visual "Folders" on checkout.</p>
                    <form onSubmit={handleGroupSubmit} className="space-y-4">
                        <div>
                            <label className="label-styled">Select Event Series <span className="text-red-400">*</span></label>
                            <select className="input-styled w-full" value={groupForm.series_id} onChange={e => setGroupForm({ ...groupForm, series_id: e.target.value })} required>
                                <option value="">-- Choose Series --</option>
                                {series.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label-styled">Group Name <span className="text-red-400">*</span></label>
                            <input type="text" className="input-styled" placeholder="e.g. Main Conference Passes" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} required />
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="submit" className="btn-primary flex items-center gap-2 h-11 px-6 shadow-md" disabled={loading}>
                                <Plus className="w-4 h-4" /> Create Group
                            </button>
                        </div>
                    </form>
                </div>

                {/* CREATE TICKET TYPE FORM */}
                <div className="glass-card p-6 border-l-4 border-l-green-400 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Create Ticket Type</h2>
                        <button onClick={() => { fetchTickets(); fetchSeries(); }} className="p-2 bg-white/5 hover:bg-green-500/20 text-gray-400 hover:text-green-400 rounded-full transition-colors group" title="Sync All Tickets">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2 md:col-span-1">
                            <label className="label-styled">Ticket Type</label>
                            <select
                                className="input-styled"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value, price: e.target.value === 'free' ? 0 : '' })}
                            >
                                <option value="paid">Paid</option>
                                <option value="free">Free</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-styled">Ticket Name</label>
                            <input name="name" type="text" className="input-styled" placeholder="Early Bird" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        {formData.type === 'paid' && (
                            <div>
                                <label className="label-styled">Price ($)</label>
                                <input name="price" type="number" className="input-styled" placeholder="499" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required min="1" />
                            </div>
                        )}
                        <div>
                            <label className="label-styled">Quantity</label>
                            <input name="quantity" type="number" className="input-styled" placeholder="100" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} required min="1" />
                        </div>
                        <div>
                            <label className="label-styled">Max Per Order</label>
                            <input name="max_per_order" type="number" className="input-styled" placeholder="10" value={formData.max_per_order} onChange={e => setFormData({ ...formData, max_per_order: e.target.value })} required min="1" max="100" />
                        </div>
                        <div className="col-span-2">
                            <label className="label-styled">Bind to Event/Date <span className="text-red-400">*</span></label>
                            <select name="event_id" className="input-styled" value={formData.event_id} onChange={e => setFormData({ ...formData, event_id: e.target.value, group_id: '' })} required>
                                <option value="">-- Choose an Event --</option>
                                {events.map((evt) => <option key={evt.id} value={evt.id}>{evt.name} ({new Date(evt.start.iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })})</option>)}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="label-styled">Ticket Group/Folder <span className="text-gray-500 font-normal ml-1">(Optional)</span></label>
                            <select className="input-styled" value={formData.group_id} onChange={e => setFormData({ ...formData, group_id: e.target.value })} disabled={!formData.event_id}>
                                <option value="">-- No Group (Root Level) --</option>
                                {availableGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            <p className="text-xs text-gray-400 mt-1 pl-1">Organize this ticket under a group banner on your popup cart.</p>
                        </div>

                        <div className="col-span-2 flex justify-end mt-4 border-t border-white/5 pt-4">
                            <button type="submit" className="bg-green-600 hover:bg-green-500 text-white font-bold h-11 px-8 rounded-xl shadow-[0_0_15px_rgba(22,163,74,0.4)] flex justify-center items-center gap-2 transition-all transform hover:-translate-y-0.5" disabled={loading}>
                                <Plus className="w-5 h-5" /> Issue Tickets
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Price</th>
                            <th className="p-4">Quantity</th>
                            <th className="p-4">Event ID</th>
                            <th className="p-4">Group Folder</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {tickets.length === 0 ? (
                            <tr><td colSpan="4" className="p-4 text-center text-gray-500">No ticket types found.</td></tr>
                        ) : tickets.map(t => {
                            const evtObj = events.find(e => e.id === t.event_id);
                            const eventDisplay = evtObj
                                ? `${evtObj.name} (${new Date(evtObj.start.iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })})`
                                : t.event_id;

                            // Attempt to resolve Group Name nicely
                            let groupName = t.group_id ? `tg_${t.group_id}` : 'None';
                            if (t.group_id && evtObj) {
                                const targetSeries = series.find(s => s.id === evtObj.event_series_id);
                                if (targetSeries && targetSeries.default_ticket_groups) {
                                    const matchedGroup = targetSeries.default_ticket_groups.find(g => g.id === `tg_${t.group_id}` || g.id === t.group_id);
                                    if (matchedGroup) groupName = matchedGroup.name;
                                }
                            }

                            return (
                                <tr key={t.id} className="hover:bg-white/5">
                                    <td className="p-4 font-medium">{t.name}</td>
                                    <td className="p-4">{t.price > 0 ? `$${(t.price / 100).toFixed(2)}` : <span className="text-green-400 font-medium">Free</span>}</td>
                                    <td className="p-4">{t.quantity} <span className="text-gray-500 text-sm ml-2">(Max {t.max_per_order})</span></td>
                                    <td className="p-4 text-sm text-gray-400">{eventDisplay}</td>
                                    <td className="p-4">
                                        {t.group_id ? (
                                            <span
                                                className="inline-block max-w-[150px] truncate align-bottom px-2 py-1 bg-brand-500/20 text-brand-300 text-xs rounded-full border border-brand-500/30"
                                                title={groupName}
                                            >
                                                {groupName}
                                            </span>
                                        ) : (
                                            <span className="text-gray-600 text-sm">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleDeleteTicket(t.id, t.event_id, t.name)} className="p-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded transition-colors" title="Permanently Delete Ticket">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between mt-12 mb-6">
                <h2 className="text-2xl font-bold text-brand-300">Ticket Groups Configuration</h2>
                <button onClick={fetchSeries} className="p-2 bg-white/5 hover:bg-brand-500/20 text-gray-400 hover:text-brand-300 rounded-full transition-colors group" title="Sync Ticket Groups">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                </button>
            </div>
            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400">
                        <tr>
                            <th className="p-4">Group Name</th>
                            <th className="p-4">Group ID</th>
                            <th className="p-4">Bound To Series</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {series.flatMap(s => s.default_ticket_groups?.map(g => ({ ...g, seriesName: s.name, seriesId: s.id })) || []).length === 0 ? (
                            <tr><td colSpan="4" className="p-4 text-center text-gray-500">No ticket groups exist. Create one above!</td></tr>
                        ) : series.flatMap(s => s.default_ticket_groups?.map(g => ({ ...g, seriesName: s.name, seriesId: s.id })) || []).map(g => {
                            const isExpanded = expandedGroup === g.id;
                            const groupTickets = tickets.filter(t => t.group_id === g.id || `tg_${t.group_id}` === g.id || t.group_id === g.id.replace('tg_', ''));

                            return (
                                <React.Fragment key={g.id}>
                                    <tr onClick={() => setExpandedGroup(isExpanded ? null : g.id)} className={`hover:bg-white/5 cursor-pointer transition-colors ${isExpanded ? 'bg-white/5' : ''}`}>
                                        <td className="p-4 font-medium text-brand-100 flex items-center gap-2">
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-brand-400" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                            {g.name}
                                            <span className="ml-2 bg-dark-800 text-xs px-2 py-0.5 rounded-full text-gray-400">{groupTickets.length} tickets</span>
                                        </td>
                                        <td className="p-4 text-xs font-mono text-gray-500">{g.id}</td>
                                        <td className="p-4 text-sm tracking-wide">{g.seriesName}</td>
                                        <td className="p-4 text-right">
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.seriesId, g.id, g.name); }} className="p-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded transition-colors" title="Delete Ticket Group">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-dark-900/50">
                                            <td colSpan="4" className="p-0 border-t border-white/5">
                                                <div className="p-6">
                                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Tickets in '{g.name}'</h4>
                                                    {groupTickets.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {groupTickets.map(t => {
                                                                const sold = t.quantity_total && t.quantity !== undefined ? t.quantity_total - t.quantity : 0;
                                                                return (
                                                                    <div key={t.id} className="bg-dark-800/80 p-4 rounded-lg border border-white/5 hover:border-brand-500/30 transition-colors">
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <span className="font-bold text-white">{t.name}</span>
                                                                            <span className="text-sm font-medium">{t.price > 0 ? `$${(t.price / 100).toFixed(2)}` : <span className="text-green-400">Free</span>}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-xs text-gray-400 mt-4 bg-dark-900 p-2 rounded">
                                                                            <div className="flex flex-col"><span className="text-gray-500">Total</span><span className="font-bold text-gray-300">{t.quantity_total || t.quantity || 0}</span></div>
                                                                            <div className="w-px h-6 bg-white/10"></div>
                                                                            <div className="flex flex-col"><span className="text-gray-500">Sold</span><span className="font-bold text-brand-400">{sold}</span></div>
                                                                            <div className="w-px h-6 bg-white/10"></div>
                                                                            <div className="flex flex-col"><span className="text-gray-500">Remaining</span><span className="font-bold text-green-400">{t.quantity || 0}</span></div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-500 italic">No tickets have been assigned to this group folder yet.</p>
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

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-dark-900 to-black border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full relative animate-fade-in">
                        <button onClick={() => setDeleteConfirm(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">
                                {deleteConfirm.type === 'ticket' ? 'Delete Ticket Type?' : 'Delete Ticket Group?'}
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Are you sure you want to permanently delete <strong className="text-white">&ldquo;{deleteConfirm.label}&rdquo;</strong>?
                                {deleteConfirm.type === 'ticket'
                                    ? ' Tickets that have already been sold cannot be deleted.'
                                    : ' All ticket types inside this group will be unassigned.'}
                            </p>

                            <div className="flex w-full gap-3 mt-4">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-bold shadow-lg shadow-red-500/25"
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Toast Notification */}
            <div className={`fixed bottom-8 right-8 z-50 transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} backdrop-blur-md`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    <span className="font-medium text-lg">{toast.message}</span>
                </div>
            </div>
        </div>
    );
};

export default TicketTypes;
