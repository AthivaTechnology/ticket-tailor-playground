import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Tag as TagIcon, ArrowRight, Ticket, Users } from 'lucide-react';
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

        // Dynamically inject Ticket Tailor's Pop-up Widget Engine
        const script = document.createElement("script");
        script.src = "https://cdn.tickettailor.com/js/widgets/min/widget.js";
        script.async = true;
        document.body.appendChild(script);

        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
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

            // 3. Fetch Series Bundles
            try {
                const bundleRes = await api.get(`/event_series/${id}/bundles/availability`);
                setBundles(bundleRes.data.data || []);
            } catch (bErr) {
                console.warn("No bundles found or supported:", bErr);
            }

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
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Series Ticket Bundles</h4>
                                <div className="space-y-3">
                                    {bundles.map(bundle => (
                                        <div key={bundle.id} className="flex items-center justify-between p-3 rounded-lg bg-indigo-900/20 border border-indigo-500/30 hover:border-brand-500/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-400">
                                                    <TagIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white">{bundle.name}</p>
                                                    <p className="text-xs text-indigo-300 mb-1">{bundle.description}</p>
                                                    <p className="text-sm font-medium text-brand-300">{bundle.price > 0 ? `₹${(bundle.price / 100).toFixed(2)}` : 'Free'}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end">
                                                {bundle.is_available ? (
                                                    <div className="text-right">
                                                        <span className="text-sm font-bold text-green-400">Available</span>
                                                        <div className="text-xs text-gray-400 mt-0.5">
                                                            Limit {bundle.max_quantity}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-red-400 uppercase tracking-wide bg-red-400/10 px-2 py-1 rounded">Sold Out</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ticket Inventory Preview */}
                        {selectedOccurrenceId && (
                            <div className="mt-8">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Available Tickets</h4>
                                {ticketsLoading ? (
                                    <div className="animate-pulse space-y-3">
                                        <div className="h-12 bg-white/5 rounded-lg"></div>
                                        <div className="h-12 bg-white/5 rounded-lg"></div>
                                    </div>
                                ) : availableTickets.length > 0 ? (
                                    <div className="space-y-3">
                                        {availableTickets.map(ticket => (
                                            <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50 border border-white/5 hover:border-brand-500/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full ${ticket.price > 0 ? 'bg-brand-500/20 text-brand-400' : 'bg-green-500/20 text-green-400'}`}>
                                                        <Ticket className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white">{ticket.name}</p>
                                                        <p className="text-xs text-gray-400">{ticket.price > 0 ? `₹${(ticket.price / 100).toFixed(2)}` : 'Free Registration'}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end">
                                                    {ticket.status === 'sold_out' ? (
                                                        <span className="text-xs font-bold text-red-400 uppercase tracking-wide bg-red-400/10 px-2 py-1 rounded">Sold Out</span>
                                                    ) : (
                                                        <div className="text-right">
                                                            <span className="text-sm font-bold text-brand-300">Available</span>
                                                            <div className="flex items-center gap-1 text-xs text-brand-200 mt-0.5 opacity-70">
                                                                <Users className="w-3 h-3" /> Max {ticket.max_per_order} / order
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic text-center py-4 bg-dark-900 rounded-lg border border-white/5">No tickets found for this date.</p>
                                )}
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center">
                            {selectedOccurrenceObj ? (
                                <a
                                    href={selectedOccurrenceObj.checkout_url || selectedOccurrenceObj.url}
                                    className="tt-widget w-full flex justify-center items-center gap-3 bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all duration-300"
                                    data-show-logo="false"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <TagIcon className="w-5 h-5" /> Find Tickets Now
                                </a>
                            ) : (
                                <div className="w-full flex justify-center items-center gap-2 bg-gray-600/50 cursor-not-allowed text-gray-400 font-bold text-sm px-6 py-4 rounded-xl border border-white/5">
                                    <TagIcon className="w-4 h-4" /> Select Date First
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetail;
