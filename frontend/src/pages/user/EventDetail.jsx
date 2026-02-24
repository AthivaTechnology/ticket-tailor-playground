import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar, MapPin, Ticket, ArrowLeft, ArrowRight,
    Clock, Globe, Tag as TagIcon, Users
} from 'lucide-react';
import api from '../../services/api';

import eventPlaceholder from '../../assets/event-placeholder.jpg';

const EventDetail = () => {
    const { id } = useParams(); // Event (occurrence) ID directly
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (id) fetchEventData();
    }, [id]);

    const fetchEventData = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            // /events/:id already returns full data: name, images, venue, ticket_types
            const eventRes = await api.get(`/events/${id}`);
            setEvent(eventRes.data);

            // Fetch tickets for this event
            setTicketsLoading(true);
            try {
                const ticketRes = await api.get(`/events/${id}/tickets`);
                setTickets(ticketRes.data.data || []);
            } catch {
                setTickets([]);
            }
            setTicketsLoading(false);

        } catch (err) {
            console.error(err);
            setErrorMsg('Event not found or could not be loaded.');
        }
        setLoading(false);
    };

    if (loading) {
        return <div className="text-center py-20 text-brand-300 animate-pulse text-xl">Loading Event...</div>;
    }

    if (errorMsg || !event) {
        return (
            <div className="text-center py-20">
                <p className="text-red-400 text-xl mb-4">{errorMsg || 'Event not found.'}</p>
                <button onClick={() => navigate('/events')} className="btn-secondary">
                    ← Back to Events
                </button>
            </div>
        );
    }

    const isOnline = event.online_event === 'true' || event.online_event === true;
    const venue = isOnline
        ? `🌐 Online Event`
        : [event.venue?.name, event.venue?.city, event.venue?.postal_code, event.venue?.country]
            .filter(Boolean).join(', ') || 'Location TBA';

    const isSoldOut = event.status === 'sold_out';
    const hasTickets = tickets.length > 0;
    const minPrice = hasTickets
        ? Math.min(...tickets.filter(t => t.status !== 'sold_out').map(t => t.price || 0))
        : null;

    // Helper to format descriptions
    const formatDescription = (desc) => {
        if (!desc) return '';
        // If it already looks like HTML, return as is
        if (/<[a-z][\s\S]*>/i.test(desc)) return desc;
        // Otherwise, convert newlines to <br/> tags to preserve alignment
        return desc.replace(/\n/g, '<br />');
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">

            {/* Back button */}
            <button
                onClick={() => navigate('/events')}
                className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> All Events
            </button>

            {/* Hero */}
            <div className="glass-card overflow-hidden mb-8 relative">
                <img
                    src={event.images?.header || event.images?.thumbnail || eventPlaceholder}
                    alt={event.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                <div className="h-64 bg-gradient-to-r from-brand-700/60 to-dark-900 absolute inset-0" />

                <div className="relative z-10 p-10 flex flex-col items-center text-center">
                    {/* Status badge */}
                    <span className={`font-bold px-4 py-1 rounded-full text-sm mb-4 inline-block uppercase tracking-wider ${isSoldOut
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-green-500/20 text-green-300'
                        }`}>
                        {isSoldOut ? 'Sold Out' : 'Tickets Available'}
                    </span>

                    <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">{event.name}</h1>

                    {/* Key info row */}
                    <div className="flex flex-wrap justify-center gap-6 text-gray-300 font-medium">
                        {event.start?.iso && (
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-brand-400" />
                                <span>{new Date(event.start.iso).toLocaleDateString([], { dateStyle: 'long' })}</span>
                            </div>
                        )}
                        {event.start?.iso && (
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-brand-400" />
                                <span>{new Date(event.start.iso).toLocaleTimeString([], { timeStyle: 'short' })}
                                    {event.end?.iso && ` – ${new Date(event.end.iso).toLocaleTimeString([], { timeStyle: 'short' })}`}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-brand-400" />
                            <span>{venue}</span>
                        </div>
                        {minPrice !== null && (
                            <div className="flex items-center gap-2">
                                <TagIcon className="w-5 h-5 text-brand-400" />
                                <span>{minPrice === 0 ? 'Free' : `From $${(minPrice / 100).toFixed(2)}`}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Left — Description */}
                <div className="md:col-span-2 space-y-6">
                    <div className="glass-card p-8">
                        <h2 className="text-2xl font-bold mb-4 text-white border-b border-white/10 pb-4">
                            About This Event
                        </h2>
                        {event.description ? (
                            <div
                                className="text-gray-300 leading-relaxed text-base prose prose-invert prose-brand max-w-none break-words"
                                dangerouslySetInnerHTML={{ __html: formatDescription(event.description) }}
                            />
                        ) : (
                            <p className="text-gray-400 italic">No description provided.</p>
                        )}
                    </div>

                    {/* Venue details (if physical) */}
                    {!isOnline && event.venue && (
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-bold mb-3 text-white flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-brand-400" /> Venue
                            </h3>
                            <p className="text-gray-300 font-medium">{event.venue.name}</p>
                            {event.venue.address && <p className="text-gray-400 text-sm mt-1">{event.venue.address}</p>}
                            <p className="text-gray-400 text-sm">
                                {[event.venue.city, event.venue.postal_code, event.venue.country].filter(Boolean).join(', ')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Right — Tickets + CTA */}
                <div className="space-y-5">

                    {/* Tickets card */}
                    <div className="glass-card p-6 border-2 border-brand-500/30 sticky top-8">
                        <h3 className="text-xl font-bold text-brand-300 mb-5 flex items-center gap-2">
                            <Ticket className="w-5 h-5" /> Tickets
                        </h3>

                        {/* Ticket list */}
                        {ticketsLoading ? (
                            <div className="space-y-2 animate-pulse">
                                <div className="h-14 bg-white/5 rounded-xl" />
                                <div className="h-14 bg-white/5 rounded-xl" />
                            </div>
                        ) : hasTickets ? (
                            <div className="space-y-2 mb-6">
                                {tickets.map(ticket => {
                                    const tSoldOut = ticket.status === 'sold_out';
                                    return (
                                        <div
                                            key={ticket.id}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${tSoldOut
                                                ? 'bg-dark-900/30 border-white/5 opacity-60'
                                                : 'bg-dark-800/60 border-white/10 hover:border-brand-500/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`p-1.5 rounded-lg ${tSoldOut ? 'bg-gray-500/10 text-gray-500'
                                                    : ticket.price > 0 ? 'bg-brand-500/15 text-brand-400'
                                                        : 'bg-green-500/15 text-green-400'
                                                    }`}>
                                                    <Ticket className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-semibold ${tSoldOut ? 'text-gray-500 line-through' : 'text-white'}`}>
                                                        {ticket.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {ticket.price > 0 ? `$${(ticket.price / 100).toFixed(2)}` : 'Free'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5">
                                                {tSoldOut ? (
                                                    <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase">Sold Out</span>
                                                ) : (
                                                    <>
                                                        <span className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Available</span>
                                                        {ticket.quantity != null && (
                                                            <span className="text-[10px] text-gray-500">{ticket.quantity} left</span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic text-center py-4 mb-4">
                                No tickets available.
                            </p>
                        )}

                        {/* CTA */}
                        <div className="pt-4 border-t border-white/10 space-y-3">
                            {!isSoldOut && hasTickets ? (
                                <button
                                    onClick={() => navigate(`/checkout/${id}`)}
                                    className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-bold text-base px-6 py-4 rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all duration-300"
                                >
                                    <Ticket className="w-5 h-5" />
                                    Get Tickets
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <div className="w-full flex justify-center items-center gap-2 bg-gray-600/40 cursor-not-allowed text-gray-400 font-bold text-sm px-6 py-4 rounded-xl border border-white/5">
                                    {isSoldOut ? '🚫 Sold Out' : 'No Tickets Available'}
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
