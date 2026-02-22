import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import api from '../../services/api';

const EventsList = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/event_series');
            setEvents(res.data.data || []);
        } catch (err) { console.error(err); }
    };

    return (
        <div className="py-12">
            <div className="text-center mb-16">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent mb-4">
                    Upcoming Bootcamps
                </h1>
                <p className="text-xl text-gray-400">Join our signature events and level up your skills.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {events.length === 0 && <p className="col-span-full text-center text-gray-400">Loading events or none available.</p>}
                {events.filter(series => series.status === 'published').map(series => (
                    <div key={series.id} className="glass-card overflow-hidden group">
                        <div className="h-48 bg-gradient-to-br from-dark-800 to-brand-900/30 w-full relative">
                            {/* Decorative elements */}
                            {series.images?.thumbnail ? (
                                <img src={series.images.thumbnail} alt={series.name} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                            ) : (
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                            )}
                        </div>
                        <div className="p-6">
                            <h3 className="text-2xl font-bold mb-3 group-hover:text-brand-300 transition-colors">{series.name}</h3>

                            <div className="space-y-2 mb-6">
                                {series.next_occurrence_date && (
                                    <div className="flex items-center text-gray-400 hover:text-gray-300 transition-colors">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        <span className="text-sm">Next: {new Date(series.next_occurrence_date.iso).toLocaleDateString()}</span>
                                    </div>
                                )}
                                <div className="flex items-start text-gray-400 hover:text-gray-300 transition-colors">
                                    <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                                    <span className="text-sm">
                                        {series.online_event === "true"
                                            ? `🌐 Online Event (${series.venue?.name || 'Link Pending'})`
                                            : [series.venue?.name, series.venue?.postal_code, series.venue?.country].filter(Boolean).join(', ') || 'Various Locations'
                                        }
                                    </span>
                                </div>
                            </div>

                            <Link to={`/series/${series.id}`} className="btn-secondary w-full flex justify-between items-center group-hover:bg-brand-500 group-hover:text-dark-900 group-hover:border-brand-500">
                                View Details
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventsList;
