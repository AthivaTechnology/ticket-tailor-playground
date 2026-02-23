import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Tag as TagIcon, ArrowRight, Ticket } from 'lucide-react';
import api from '../../services/api';

const EventDetail = () => {
    const { id } = useParams(); // This is now the Series ID
    const navigate = useNavigate();
    const [series, setSeries] = useState(null);
    const [occurrences, setOccurrences] = useState([]);
    const [selectedOccurrenceId, setSelectedOccurrenceId] = useState('');
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableTickets, setAvailableTickets] = useState([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);

    useEffect(() => {
        fetchSeriesData();
    }, [id]);

    const fetchSeriesData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Series master data
            const seriesRes = await api.get(`/event_series/${id}`);
            setSeries(seriesRes.data);

            // 2. Fetch all generic Events (occurrences) and filter to this series
            const eventsRes = await api.get('/events');
            const matchingOccurrences = (eventsRes.data.data || []).filter(e => e.event_series_id === id);

            // Sort occurrences chronologically
            matchingOccurrences.sort((a, b) => new Date(a.start.iso) - new Date(b.start.iso));
            setOccurrences(matchingOccurrences);

            if (matchingOccurrences.length > 0) {
                setSelectedOccurrenceId(matchingOccurrences[0].id);
            }

        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        const fetchTickets = async () => {
            if (!selectedOccurrenceId) return;
            setTicketsLoading(true);
            try {
                const res = await api.get(`/events/${selectedOccurrenceId}/tickets`);
                setAvailableTickets(res.data.data || []);
            } catch (err) {
                console.error("Failed to fetch event ticket inventory", err);
                setAvailableTickets([]);
            }

            // Fetch Bundles filtered to this specific occurrence
            try {
                const bundleRes = await api.get(`/event_series/${id}/bundles/availability?event_id=${selectedOccurrenceId}`);
                setBundles(bundleRes.data.data || []);
            } catch (bErr) {
                console.warn("No bundles found or supported:", bErr);
                setBundles([]);
            }

            setTicketsLoading(false);
        };
        fetchTickets();
    }, [selectedOccurrenceId]);

    if (loading) return <div className="text-center py-20 text-brand-300 animate-pulse text-xl">Loading Event Series...</div>;
    if (!series) return <div className="text-center py-20 text-red-400">Event Series not found.</div>;

    const selectedOccurrenceObj = occurrences.find(o => o.id === selectedOccurrenceId);

    return (
        <div className="max-w-4xl mx-auto py-8">
            {/* Hero Section */}
            <div className="glass-card overflow-hidden mb-12 relative">
                {series.images?.header && (
                    <img src={series.images.header} alt="Header" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
                )}
                <div className="h-64 bg-gradient-to-r from-brand-600 to-dark-900 absolute inset-0 opacity-40"></div>
                <div className="relative z-10 p-10 flex flex-col items-center text-center">
                    <span className="bg-brand-500/20 text-brand-300 font-bold px-4 py-1 rounded-full text-sm mb-6 inline-block uppercase tracking-wider">
                        {series.status === 'published' ? 'Live Event Series' : 'Draft'}
                    </span>
                    <h1 className="text-5xl font-bold mb-6">{series.name}</h1>

                    <div className="flex flex-wrap justify-center gap-6 text-gray-300 font-medium">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-brand-400" />
                            <span>
                                {series.online_event === "true"
                                    ? `🌐 Online Event (${series.venue?.name || 'Link Pending'})`
                                    : [series.venue?.name, series.venue?.postal_code, series.venue?.country].filter(Boolean).join(', ') || 'Various Locations'
                                }
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="md:col-span-2 space-y-6">
                    <h2 className="text-3xl font-bold border-b border-white/10 pb-4">About the Series</h2>
                    <div className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: series.description || 'No description provided for this series.' }} />
                </div>

                <div className="space-y-6">
                    <div className="glass-card p-6 border-brand-500/30 border-2">
                        <h3 className="text-2xl font-bold text-brand-300 mb-6 flex items-center gap-2">
                            <Calendar className="w-6 h-6" /> Event Date
                        </h3>

                        {occurrences.length > 0 ? (
                            <div>
                                <label className="label-styled block mb-2">Select Occurrence</label>
                                <select
                                    className="input-styled w-full"
                                    value={selectedOccurrenceId}
                                    onChange={(e) => setSelectedOccurrenceId(e.target.value)}
                                >
                                    {occurrences.map(o => (
                                        <option key={o.id} value={o.id}>
                                            {new Date(o.start.iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm mb-4">No occurrences found for this series.</p>
                        )}

                        {/* Series Ticket Bundles */}
                        {bundles.length > 0 && (
                            <div className="mt-8 mb-8">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <TagIcon className="w-3.5 h-3.5" /> Ticket Bundles
                                </h4>
                                <div className="space-y-3">
                                    {bundles.map(bundle => (
                                        <div key={bundle.id} className={`rounded-xl border p-4 transition-all ${bundle.is_available
                                            ? 'bg-indigo-950/40 border-indigo-500/30 hover:border-indigo-400/60'
                                            : 'bg-dark-900/30 border-white/5 opacity-60'
                                            }`}>
                                            {/* Bundle Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="font-bold text-white text-sm">{bundle.name}</p>
                                                    {bundle.description && (
                                                        <p className="text-xs text-indigo-300/70 mt-0.5">{bundle.description}</p>
                                                    )}
                                                </div>
                                                {bundle.is_available ? (
                                                    <span className="shrink-0 ml-2 text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                                                        {bundle.max_quantity} left
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 ml-2 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                        Sold Out
                                                    </span>
                                                )}
                                            </div>

                                            {/* Included Tickets */}
                                            {bundle.included_tickets_details && bundle.included_tickets_details.length > 0 && (
                                                <div className="bg-indigo-900/20 rounded-lg p-2.5 mb-3 space-y-1.5">
                                                    <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1.5">Includes</p>
                                                    {bundle.included_tickets_details.map(t => (
                                                        <div key={t.id} className="flex items-center justify-between text-xs">
                                                            <div className="flex items-center gap-1.5 text-indigo-200">
                                                                <span className="w-4 h-4 flex items-center justify-center bg-indigo-500/20 rounded text-indigo-400 text-[10px] font-bold">×{t.quantity}</span>
                                                                <span>{t.name}</span>
                                                            </div>
                                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.left > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                {t.left > 0 ? `${t.left} left` : 'None left'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Price */}
                                            <p className="text-sm font-bold text-brand-300">
                                                {bundle.price > 0 ? `₹${(bundle.price / 100).toFixed(2)}` : 'Free'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ticket Inventory Preview */}
                        {selectedOccurrenceId && (
                            <div className="mt-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Ticket className="w-3.5 h-3.5" /> Available Tickets
                                </h4>
                                {ticketsLoading ? (
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-14 bg-white/5 rounded-xl"></div>
                                        <div className="h-14 bg-white/5 rounded-xl"></div>
                                    </div>
                                ) : availableTickets.length > 0 ? (
                                    <div className="space-y-2">
                                        {availableTickets.map(ticket => {
                                            const isSoldOut = ticket.status === 'sold_out';
                                            const qty = ticket.quantity ?? null;
                                            return (
                                                <div key={ticket.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isSoldOut
                                                    ? 'bg-dark-900/30 border-white/5 opacity-60'
                                                    : 'bg-dark-800/60 border-white/8 hover:border-brand-500/30'
                                                    }`}>
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`p-1.5 rounded-lg ${isSoldOut ? 'bg-gray-500/10 text-gray-500'
                                                            : ticket.price > 0 ? 'bg-brand-500/15 text-brand-400'
                                                                : 'bg-green-500/15 text-green-400'
                                                            }`}>
                                                            <Ticket className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-semibold leading-tight ${isSoldOut ? 'text-gray-500 line-through' : 'text-white'}`}>{ticket.name}</p>
                                                            <p className="text-xs text-gray-400">{ticket.price > 0 ? `₹${(ticket.price / 100).toFixed(2)}` : 'Free'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        {isSoldOut ? (
                                                            <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Sold Out</span>
                                                        ) : (
                                                            <>
                                                                <span className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Available</span>
                                                                {qty !== null && (
                                                                    <span className="text-[10px] text-gray-400">{qty} left</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic text-center py-4 bg-dark-900 rounded-xl border border-white/5">No tickets found for this date.</p>
                                )}
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center gap-4">
                            {selectedOccurrenceObj ? (
                                <div className="flex flex-col sm:flex-row w-full gap-4">
                                    <a
                                        href={selectedOccurrenceObj.checkout_url || selectedOccurrenceObj.url}
                                        className="w-full sm:w-1/2 flex justify-center items-center gap-3 bg-dark-700 hover:bg-dark-600 border border-white/10 text-white font-bold text-base px-6 py-4 rounded-xl transition-all duration-300"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <TagIcon className="w-5 h-5" /> Ticket Tailor Checkout
                                    </a>
                                    <button
                                        onClick={() => navigate(`/checkout/${selectedOccurrenceId}`)}
                                        className="w-full sm:w-1/2 flex justify-center items-center gap-3 bg-brand-600 hover:bg-brand-500 text-white font-bold text-base px-6 py-4 rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all duration-300"
                                    >
                                        <TagIcon className="w-5 h-5" /> Custom Onsite Checkout
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full flex justify-center items-center gap-2 bg-gray-600/50 cursor-not-allowed text-gray-400 font-bold text-sm px-6 py-4 rounded-xl border border-white/5">
                                    <TagIcon className="w-4 h-4" /> Select Date First
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div >
        </div >
    );
};

export default EventDetail;
