import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Ticket, ExternalLink, Users, TrendingUp, AlertCircle } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, RadialBarChart, RadialBar
} from 'recharts';
import api from '../../services/api';

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

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

const AdminEventDetail = () => {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [seriesId, setSeriesId] = useState(null);
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/events/${id}`);
            const eventData = res.data;
            setEvent(eventData);
            setSeriesId(eventData.event_series_id);

            if (eventData.event_series_id) {
                try {
                    const bundleRes = await api.get(`/event_series/${eventData.event_series_id}/bundles/availability?event_id=${eventData.id}`);
                    setBundles(bundleRes.data.data || []);
                } catch (bErr) {
                    console.warn("No bundles found:", bErr);
                }
            }
        } catch (err) {
            console.error("Failed to fetch event data:", err);
        }
        setLoading(false);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <div className="w-12 h-12 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mx-auto mb-4"></div>
                <p className="text-brand-300 animate-pulse">Loading Batch Data...</p>
            </div>
        </div>
    );
    if (!event) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center text-red-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                <p className="text-xl font-bold">Event not found</p>
            </div>
        </div>
    );

    const startDt = new Date(event.start.iso);
    const endDt = new Date(event.end.iso);
    const tickets = event.ticket_types || [];

    // Build chart data
    const ticketChartData = tickets.map(t => {
        const total = t.quantity_total || t.quantity || 0;
        const remaining = t.quantity || 0;
        const sold = total - remaining;
        return {
            name: t.name.length > 14 ? t.name.slice(0, 14) + '…' : t.name,
            fullName: t.name,
            Sold: Math.max(0, sold),
            Remaining: remaining,
            Total: total,
        };
    });

    const totalCapacity = tickets.reduce((sum, t) => sum + (t.quantity_total || t.quantity || 0), 0);
    const totalSold = tickets.reduce((sum, t) => {
        const total = t.quantity_total || t.quantity || 0;
        const remaining = t.quantity || 0;
        return sum + Math.max(0, total - remaining);
    }, 0);
    const totalRemaining = totalCapacity - totalSold;
    const soldPct = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0;

    const pieData = totalCapacity > 0
        ? [
            { name: 'Sold', value: totalSold },
            { name: 'Remaining', value: totalRemaining },
        ]
        : [{ name: 'No Data', value: 1 }];

    const durationHours = ((endDt - startDt) / 1000 / 3600).toFixed(1);

    return (
        <div className="space-y-8">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Link
                    to={seriesId ? `/admin/event-series/${seriesId}` : '/admin/events'}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white self-start"
                >
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-white truncate">{event.name}</h1>
                    <p className="text-xs text-gray-500 font-mono mt-1 truncate">Occurrence ID: {event.id}</p>
                </div>
                <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex items-center gap-2 text-sm shrink-0"
                >
                    <ExternalLink className="w-4 h-4" /> Live Registration
                </a>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Capacity', value: totalCapacity, icon: Users, color: 'brand' },
                    { label: 'Tickets Sold', value: totalSold, icon: TrendingUp, color: 'green' },
                    { label: 'Remaining', value: totalRemaining, icon: Ticket, color: 'yellow' },
                    { label: 'Sell-Through', value: `${soldPct}%`, icon: TrendingUp, color: 'purple' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="glass-card p-5 flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl bg-${color === 'brand' ? 'brand-500' : color}-500/20 text-${color === 'brand' ? 'brand-400' : color}-400 shrink-0`}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-gray-400 font-medium truncate">{label}</p>
                            <p className="text-2xl font-bold text-white">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Charts Row ── */}
            {tickets.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Bar Chart — Sold vs Remaining */}
                    <div className="lg:col-span-2 glass-card p-6">
                        <h2 className="text-lg font-bold text-white mb-6">Ticket Inventory Breakdown</h2>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={ticketChartData} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 13 }} />
                                <Bar dataKey="Sold" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Remaining" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Pie Chart — Overall distribution */}
                    <div className="glass-card p-6 flex flex-col items-center justify-center">
                        <h2 className="text-lg font-bold text-white mb-4 self-start">Overall Distribution</h2>
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={i === 0 ? '#7c3aed' : '#10b981'} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-6 mt-2 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                                <span className="text-gray-400">Sold <strong className="text-white">{totalSold}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="text-gray-400">Left <strong className="text-white">{totalRemaining}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass-card p-10 text-center text-gray-500 italic">
                    <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No ticket types bound to this occurrence — charts will appear once tickets are assigned.</p>
                </div>
            )}

            {/* ── Event Info Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-l-4 border-l-brand-400">
                    <div className="flex items-center gap-2 text-brand-300 mb-3">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-bold">Start Time</h3>
                    </div>
                    <p className="font-bold text-white">{startDt.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-brand-200 text-sm mt-1">{startDt.toLocaleTimeString()}</p>
                    <p className="text-gray-500 text-xs mt-2 font-mono">{event.timezone}</p>
                </div>

                <div className="glass-card p-6 border-l-4 border-l-brand-600">
                    <div className="flex items-center gap-2 text-brand-300 mb-3">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-bold">End Time</h3>
                    </div>
                    <p className="font-bold text-white">{endDt.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-brand-200 text-sm mt-1">{endDt.toLocaleTimeString()}</p>
                    <p className="text-gray-500 text-xs mt-2">Duration: <strong className="text-gray-300">{durationHours} hrs</strong></p>
                </div>

                <div className="glass-card p-6 border-l-4 border-l-green-500">
                    <div className="flex items-center gap-2 text-green-300 mb-3">
                        <MapPin className="w-5 h-5" />
                        <h3 className="font-bold">Venue</h3>
                    </div>
                    <p className="font-bold text-white">{event.online_event === 'true' ? 'Virtual / Online' : event.venue?.name || 'TBA'}</p>
                    {event.online_event !== 'true' && (
                        <p className="text-gray-400 text-sm mt-1">
                            {[event.venue?.postal_code, event.venue?.country].filter(Boolean).join(', ') || 'Location details pending'}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Ticket Types Detail Table ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-brand-300 flex items-center gap-2">
                        <Ticket className="w-5 h-5" /> Ticket Types
                    </h2>
                    <Link to="/admin/tickets" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                        Manage Inventory →
                    </Link>
                </div>

                <div className="glass-card overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400 text-sm">
                            <tr>
                                <th className="p-4">Ticket Name</th>
                                <th className="p-4">Price</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-right">Sold</th>
                                <th className="p-4 text-right">Remaining</th>
                                <th className="p-4 text-right">Fill %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {tickets.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500 italic">
                                        No explicit ticket types bound — inheriting from Master Series.
                                    </td>
                                </tr>
                            ) : tickets.map(t => {
                                const total = t.quantity_total || t.quantity || 0;
                                const remaining = t.quantity || 0;
                                const sold = Math.max(0, total - remaining);
                                const pct = total > 0 ? Math.round((sold / total) * 100) : 0;
                                return (
                                    <tr key={t.id} className="hover:bg-white/5">
                                        <td className="p-4 font-bold text-white">{t.name}</td>
                                        <td className="p-4">
                                            {t.price > 0
                                                ? <span className="text-brand-300 font-medium">${(t.price / 100).toFixed(2)}</span>
                                                : <span className="text-green-400 font-medium text-xs uppercase tracking-wider bg-green-500/10 px-2 py-1 rounded">Free</span>
                                            }
                                        </td>
                                        <td className="p-4 text-right text-gray-300">{total}</td>
                                        <td className="p-4 text-right">
                                            <span className="font-bold text-brand-400">{sold}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`font-bold ${remaining === 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                {remaining === 0 ? 'Sold Out' : remaining}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-brand-500 transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* ── Ticket Bundles Table (if any) ── */}
            {bundles.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mt-8 mb-4 text-brand-300 flex items-center gap-2">
                        <Ticket className="w-5 h-5" /> Active Ticket Bundles (This Occurrence)
                    </h2>
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
                                    <p className="text-sm text-gray-400 mb-3">{b.description}</p>
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
                                            const ticketName = tickets.find(dt => dt.id === tt.id)?.name || tt.id;
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
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminEventDetail;
