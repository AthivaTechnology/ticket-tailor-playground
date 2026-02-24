import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Ticket, ArrowRight, Search } from 'lucide-react';
import api from '../../services/api';

import eventPlaceholder from '../../assets/event-placeholder.jpg';

const EventsList = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            // /events already returns full data: name, images, venue, ticket_types
            const res = await api.get('/events');
            const allEvents = (res.data.data || [])
                // Show events that have available tickets and are not hidden
                .filter(e => e.hidden !== 'true' && e.unavailable !== 'true')
                .sort((a, b) => new Date(a.start?.iso) - new Date(b.start?.iso));
            setEvents(allEvents);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const filtered = events.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="py-12">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent mb-4">
                        Upcoming Events
                    </h1>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass-card overflow-hidden animate-pulse">
                            <div className="h-48 bg-white/5" />
                            <div className="p-6 space-y-3">
                                <div className="h-6 bg-white/5 rounded w-3/4" />
                                <div className="h-4 bg-white/5 rounded w-1/2" />
                                <div className="h-10 bg-white/5 rounded mt-4" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="py-12">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent mb-4">
                    Upcoming Events
                </h1>
                <p className="text-xl text-gray-400">Browse and register for our upcoming events.</p>
            </div>

            {/* Search bar */}
            <div className="max-w-md mx-auto mb-10 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search events..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input-styled w-full pl-10 text-white"
                />
            </div>

            {/* Events grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.length === 0 && (
                    <p className="col-span-full text-center text-gray-400 py-10">
                        {search ? `No events matching "${search}"` : 'No events available right now.'}
                    </p>
                )}

                {filtered.map(event => {
                    const isSoldOut = event.status === 'sold_out' || event.tickets_available === 'false';
                    const isOnline = event.online_event === 'true' || event.online_event === true;
                    const venue = isOnline
                        ? `🌐 Online`
                        : [event.venue?.name, event.venue?.city, event.venue?.country].filter(Boolean).join(', ') || 'Location TBA';

                    return (
                        <div key={event.id} className="glass-card overflow-hidden group flex flex-col">
                            {/* Thumbnail */}
                            <div className="h-48 bg-gradient-to-br from-dark-800 to-brand-900/30 relative overflow-hidden">
                                <img
                                    src={event.images?.thumbnail || eventPlaceholder}
                                    alt={event.name}
                                    className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                                />

                                {/* Status badge */}
                                <div className="absolute top-3 right-3">
                                    {isSoldOut ? (
                                        <span className="text-xs font-bold bg-red-500/80 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">Sold Out</span>
                                    ) : (
                                        <span className="text-xs font-bold bg-green-500/80 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">Available</span>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 flex flex-col flex-1">
                                <h3 className="text-xl font-bold mb-3 group-hover:text-brand-300 transition-colors line-clamp-2">
                                    {event.name}
                                </h3>

                                <div className="space-y-2 mb-4 flex-1">
                                    {event.start?.iso && (
                                        <div className="flex items-center text-gray-400 text-sm">
                                            <Calendar className="w-4 h-4 mr-2 text-brand-400 flex-shrink-0" />
                                            {new Date(event.start.iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                        </div>
                                    )}
                                    <div className="flex items-start text-gray-400 text-sm">
                                        <MapPin className="w-4 h-4 mr-2 text-brand-400 flex-shrink-0 mt-0.5" />
                                        <span className="line-clamp-1">{venue}</span>
                                    </div>
                                </div>

                                <Link
                                    to={`/events/${event.id}`}
                                    className="btn-secondary w-full flex justify-between items-center mt-auto group-hover:bg-brand-500 group-hover:text-dark-900 group-hover:border-brand-500 transition-all"
                                >
                                    View Details
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EventsList;
