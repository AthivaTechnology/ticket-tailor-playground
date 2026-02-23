import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, ArrowLeft, Users, Activity, ExternalLink, Calendar, TrendingUp, X } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import api from '../../services/api';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-dark-900 border border-white/10 rounded-xl p-3 shadow-2xl text-sm">
                <p className="font-bold text-white mb-1">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
                ))}
            </div>
        );
    }
    return null;
};

const AdminSeriesDetail = () => {
    const { id } = useParams();
    const [series, setSeries] = useState(null);
    const [occurrences, setOccurrences] = useState([]);
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBundleModal, setShowBundleModal] = useState(false);
    const [bundleForm, setBundleForm] = useState({ name: '', price: '', description: '', ticket_types: {} });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const seriesRes = await api.get(`/event_series/${id}`);
            setSeries(seriesRes.data);

            const eventRes = await api.get('/events');
            const matching = (eventRes.data.data || []).filter(e => e.event_series_id === id);
            matching.sort((a, b) => new Date(a.start.iso) - new Date(b.start.iso));
            setOccurrences(matching);

            try {
                const bundleRes = await api.get(`/event_series/${id}/bundles/availability`);
                setBundles(bundleRes.data.data || []);
            } catch (bErr) {
                console.warn("No bundles found or supported:", bErr);
            }
        } catch (err) {
            console.error("Failed to fetch series data:", err);
        }
        setLoading(false);
    };

    const handleCreateBundle = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...bundleForm, price: Number(bundleForm.price * 100) };

            const cleanTickets = {};
            for (const [tid, qty] of Object.entries(payload.ticket_types)) {
                if (qty > 0) cleanTickets[tid] = qty;
            }
            if (Object.keys(cleanTickets).length === 0) {
                showToast('Please set a quantity of at least 1 for one ticket type.', 'error');
                return;
            }
            payload.ticket_types = cleanTickets;

            await api.post(`/event_series/${id}/bundles`, payload);
            setShowBundleModal(false);
            setBundleForm({ name: '', price: '', description: '', ticket_types: {} });
            showToast('Bundle created successfully!');
            setTimeout(fetchData, 1500); // Wait for TT API replica sync
        } catch (err) {
            console.error(err);
            const detail = err?.response?.data?.detail || 'Failed to create bundle.';
            showToast(detail, 'error');
        }
    };

    const handleDeleteBundle = async (bundleId) => {
        try {
            await api.delete(`/event_series/${id}/bundles/${bundleId}`);
            showToast('Bundle deleted.');
            setTimeout(fetchData, 1500); // Wait for TT API replica sync
        } catch (err) {
            console.error(err);
            showToast('Failed to delete bundle.', 'error');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <div className="w-12 h-12 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mx-auto mb-4"></div>
                <p className="text-brand-300 animate-pulse">Loading Series Core...</p>
            </div>
        </div>
    );
    if (!series) return (
        <div className="p-8 text-center text-red-500">Failed to locate Event Series.</div>
    );

    const defaultTickets = series.default_ticket_types || [];

    // Initialize bundle form ticket map
    const handleOpenBundleModal = () => {
        const initTypes = {};
        defaultTickets.forEach(t => initTypes[t.id] = 0);
        setBundleForm({ name: '', price: '', description: '', ticket_types: initTypes });
        setShowBundleModal(true);
    };

    // Aggregate tickets across ALL occurrences to show true Series-wide inventory status
    const aggregatedTickets = {};
    occurrences.forEach(evt => {
        (evt.ticket_types || []).forEach(t => {
            if (!aggregatedTickets[t.id]) {
                aggregatedTickets[t.id] = { name: t.name, total: 0, remaining: 0 };
            }
            aggregatedTickets[t.id].total += (t.quantity_total || t.quantity || 0);
            aggregatedTickets[t.id].remaining += (t.quantity || 0);
        });
    });

    const ticketChartData = Object.values(aggregatedTickets).map(t => {
        const sold = Math.max(0, t.total - t.remaining);
        return {
            name: t.name,
            Sold: sold,
            Remaining: t.remaining,
        };
    });

    const occurrenceTimelineData = occurrences.map(evt => ({
        name: new Date(evt.start.iso).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        Tickets: (evt.ticket_types || []).reduce((s, t) => s + (t.quantity_total || t.quantity || 0), 0),
    }));

    const groups = series.default_ticket_groups || [];
    const totalSeriesTickets = defaultTickets.reduce((s, t) => s + (t.quantity_total || t.quantity || 0), 0);

    return (
        <div className="space-y-8">
            {/* ── Toast ── */}
            {toast.show && (
                <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-semibold animate-fade-in ${toast.type === 'error'
                    ? 'bg-red-500/90 text-white border border-red-400/40'
                    : 'bg-green-500/90 text-white border border-green-400/40'
                    }`}>
                    <span>{toast.type === 'error' ? '✗' : '✓'}</span>
                    <span>{toast.message}</span>
                </div>
            )}
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Link to="/admin/event-series" className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white self-start">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex flex-wrap items-center gap-3">
                        {series.name}
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${series.status === 'published' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                            {series.status}
                        </span>
                    </h1>
                    <p className="text-xs text-gray-500 font-mono mt-1 truncate">Series ID: {series.id}</p>
                </div>
                <a href={series.url} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2 text-sm shrink-0">
                    <ExternalLink className="w-4 h-4" /> Live View
                </a>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Occurrences', value: occurrences.length, icon: Calendar, color: 'brand-400' },
                    { label: 'Default Ticket Types', value: defaultTickets.length, icon: TrendingUp, color: 'green-400' },
                    { label: 'Ticket Groups', value: groups.length, icon: Activity, color: 'yellow-400' },
                    { label: 'Total Series Capacity', value: totalSeriesTickets || '—', icon: Users, color: 'blue-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="glass-card p-5 flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl bg-white/5 text-${color} shrink-0`}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-gray-400 font-medium leading-tight">{label}</p>
                            <p className="text-2xl font-bold text-white">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Charts Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Total Series Ticket Inventory */}
                {ticketChartData.length > 0 ? (
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-bold text-white mb-4">Total Series Inventory (All Occurrences)</h2>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={ticketChartData} barCategoryGap="30%" margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                                    angle={-35}
                                    textAnchor="end"
                                    interval={0}
                                />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '12px' }} />
                                <Bar dataKey="Sold" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Remaining" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="glass-card p-6 flex items-center justify-center text-gray-500 italic">
                        <p>No default tickets configured for this series.</p>
                    </div>
                )}

                {/* Occurrence Timeline */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-bold text-white mb-6">Occurrence Schedule</h2>
                    {occurrenceTimelineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={occurrenceTimelineData} barCategoryGap="40%">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="Tickets" radius={[4, 4, 0, 0]}>
                                    {occurrenceTimelineData.map((_, i) => (
                                        <Cell key={i} fill={`hsl(${260 + i * 15}, 70%, 60%)`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-40 text-gray-500 italic text-sm">
                            No occurrence data to chart yet.
                        </div>
                    )}
                </div>
            </div>

            {/* ── Series Details Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-l-4 border-l-brand-500">
                    <h3 className="font-bold text-gray-300 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-300" /> Location</h3>
                    <p className="font-bold text-white">{series.online_event === "true" ? 'Online / Virtual' : series.venue?.name || 'Physical Venue'}</p>
                    {series.online_event !== "true" && (
                        <p className="text-sm text-gray-400 mt-1">{[series.venue?.postal_code, series.venue?.country].filter(Boolean).join(', ') || 'Details pending'}</p>
                    )}
                </div>

                <div className="glass-card p-6 border-l-4 border-l-green-500">
                    <h3 className="font-bold text-gray-300 mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-green-300" /> Ticket Groups</h3>
                    {groups.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                            {groups.map(g => (
                                <span key={g.id} className="text-xs px-2 py-1 bg-brand-500/20 text-brand-300 rounded-full border border-brand-500/30">{g.name}</span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No groups configured.</p>
                    )}
                </div>

                <div className="glass-card p-6 border-l-4 border-l-yellow-500">
                    <h3 className="font-bold text-gray-300 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-yellow-300" /> Series Type</h3>
                    <p className="font-bold text-white">{series.online_event === "true" ? 'Online Event' : 'In-Person Event'}</p>
                    <p className="text-sm text-gray-400 mt-1">{series.private === "true" ? 'Private (Invite-only)' : 'Open to the Public'}</p>
                </div>
            </div>

            {/* ── Bundles ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-brand-300">Ticket Bundles</h2>
                    <button onClick={handleOpenBundleModal} className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold rounded shadow-lg transition-all text-sm">
                        + Create Bundle
                    </button>
                </div>
                {bundles.length === 0 ? (
                    <div className="glass-card p-8 text-center text-gray-400">
                        No bundles currently configured for this series.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bundles.map(b => (
                            <div key={b.id} className={`glass-card p-5 flex flex-col justify-between transition-opacity ${b.is_available ? 'border-l-4 border-l-brand-400' : 'border-l-4 border-l-red-500 opacity-70'}`}>
                                <div>
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-lg font-bold text-white">{b.name}</h3>
                                        <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-bold uppercase ${b.is_available
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                            {b.is_available ? '✓ Available' : '✗ Unavailable'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-3">{b.description || 'No description'}</p>
                                    <div className="flex items-end justify-between mb-4">
                                        <div className="text-2xl font-bold text-brand-300">${(b.price / 100).toFixed(2)}</div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Max Purchasable</p>
                                            <p className={`text-xl font-bold ${b.max_quantity > 0 ? 'text-white' : 'text-red-400'}`}>{b.max_quantity}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1 mb-2">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Includes:</p>
                                        {(b.ticket_types || []).map(tt => {
                                            const ticketName = defaultTickets.find(dt => dt.id === tt.id)?.name || tt.id;
                                            const stock = b.ticket_inventory?.[tt.id];
                                            const hasEnough = stock !== null && stock !== undefined && stock >= tt.quantity;
                                            return (
                                                <div key={tt.id} className="text-sm font-medium flex justify-between items-center bg-white/5 px-2 py-1.5 rounded">
                                                    <span className="text-gray-300">{ticketName}</span>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        <span className="text-gray-400">x{tt.quantity}</span>
                                                        {stock !== undefined && (
                                                            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${hasEnough ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                                }`}>
                                                                {stock} left
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteBundle(b.id)} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-sm font-bold transition-colors mt-4">
                                    Delete Bundle
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Occurrences Table ── */}
            <div>
                <h2 className="text-xl font-bold mb-4 text-brand-300">Attached Occurrences</h2>
                <div className="glass-card overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400 text-sm">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Time</th>
                                <th className="p-4">Timezone</th>
                                <th className="p-4">Venue</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {occurrences.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500 italic">No occurrences scheduled yet.</td></tr>
                            ) : occurrences.map(evt => {
                                const d = new Date(evt.start.iso);
                                return (
                                    <tr key={evt.id} className="hover:bg-white/5">
                                        <td className="p-4 font-medium">{d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                        <td className="p-4 text-brand-100">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="p-4 text-sm text-gray-400 font-mono">{evt.timezone}</td>
                                        <td className="p-4 text-sm text-gray-300">
                                            {evt.online_event === 'true' ? 'Online/Virtual' : [evt.venue?.name, evt.venue?.country].filter(Boolean).join(', ') || 'N/A'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link to={`/admin/events/${evt.id}`} className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold rounded shadow-lg transition-all text-sm">
                                                Inspect Batch
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Create Bundle Modal ── */}
            {showBundleModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-xl overflow-hidden shadow-2xl">
                        <div className="p-6 bg-dark-800/50 border-b border-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Create Ticket Bundle</h2>
                            <button onClick={() => setShowBundleModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateBundle} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-styled">Bundle Name</label>
                                    <input type="text" className="input-styled" value={bundleForm.name} onChange={e => setBundleForm({ ...bundleForm, name: e.target.value })} required placeholder="e.g. VIP Full Weekend" />
                                </div>
                                <div>
                                    <label className="label-styled">Price ($)</label>
                                    <input type="number" step="0.01" min="0" className="input-styled" value={bundleForm.price} onChange={e => setBundleForm({ ...bundleForm, price: e.target.value })} required placeholder="150.00" />
                                </div>
                            </div>
                            <div>
                                <label className="label-styled">Description</label>
                                <textarea className="input-styled h-20 resize-none" value={bundleForm.description} onChange={e => setBundleForm({ ...bundleForm, description: e.target.value })} placeholder="What's included in this bundle?" />
                            </div>

                            <div>
                                <label className="label-styled mb-2">Included Tickets</label>
                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                    {defaultTickets.map(tt => {
                                        const enteredQty = bundleForm.ticket_types[tt.id] || 0;
                                        const stock = tt.quantity || 0;
                                        const maxPerOrder = tt.max_per_order || stock;
                                        const maxAllowed = Math.min(stock, maxPerOrder);
                                        const isOver = enteredQty > 0 && enteredQty > maxAllowed;
                                        const isSet = enteredQty > 0;
                                        return (
                                            <div key={tt.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOver
                                                ? 'bg-red-500/10 border-red-500/40'
                                                : isSet
                                                    ? 'bg-green-500/10 border-green-500/30'
                                                    : 'bg-white/5 border-white/10'
                                                }`}>
                                                <div className="min-w-0 mr-3">
                                                    <p className="text-sm font-bold text-gray-200 truncate">{tt.name}</p>
                                                    <p className={`text-xs mt-0.5 font-medium ${maxAllowed === 0 ? 'text-red-400' : maxAllowed <= 5 ? 'text-yellow-400' : 'text-green-400'
                                                        }`}>
                                                        {stock === 0 ? '✗ Out of stock' : `${stock} in stock (Max ${maxPerOrder} per order)`}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs text-gray-500 uppercase font-bold">Qty</span>
                                                    <input
                                                        type="number" min="0" max={maxAllowed}
                                                        disabled={maxAllowed === 0}
                                                        className={`w-20 border rounded px-2 py-1 text-white text-center transition-colors ${isOver
                                                            ? 'bg-red-900/30 border-red-500/60'
                                                            : 'bg-dark-900 border-white/10'
                                                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                                                        value={enteredQty}
                                                        onChange={e => setBundleForm({
                                                            ...bundleForm,
                                                            ticket_types: { ...bundleForm.ticket_types, [tt.id]: Number(e.target.value) || 0 }
                                                        })}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Validation warning */}
                                {(() => {
                                    const overStockTickets = defaultTickets.filter(tt => {
                                        const qty = bundleForm.ticket_types[tt.id] || 0;
                                        const maxAllowed = Math.min((tt.quantity || 0), (tt.max_per_order || tt.quantity || 0));
                                        return qty > maxAllowed;
                                    });
                                    return overStockTickets.length > 0 ? (
                                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 leading-relaxed">
                                            ⚠ Quantity exceeds allowable limit (stock or max-per-order) for: {overStockTickets.map(t => t.name).join(', ')}. Reduce the quantity to create this bundle.
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowBundleModal(false)} className="btn-secondary">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={defaultTickets.some(tt => {
                                        const qty = bundleForm.ticket_types[tt.id] || 0;
                                        const maxAllowed = Math.min((tt.quantity || 0), (tt.max_per_order || tt.quantity || 0));
                                        return qty > maxAllowed;
                                    })}
                                    className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Create Bundle
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSeriesDetail;
