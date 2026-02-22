import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, AlertTriangle, X, Eye } from 'lucide-react';
import api from '../../services/api';

const Events = () => {
    const [events, setEvents] = useState([]);
    const [formData, setFormData] = useState({ name: '', description: '', venue_name: '', venue_postcode: '', venue_country: 'India', start: '', end: '', online_event: false, private: false, event_series_id: '' });
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    useEffect(() => {
        fetchEvents();

        // Check if we are appending to a specific series
        const params = new URLSearchParams(window.location.search);
        const seriesId = params.get('series_id');
        if (seriesId) {
            setFormData(prev => ({ ...prev, event_series_id: seriesId }));
        }
    }, []);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/events');
            setEvents(res.data.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        let newFormData = { ...formData, [name]: type === 'checkbox' ? checked : value };

        // Ensure Online Event and Private Event are mutually exclusive
        if (name === 'online_event' && checked) {
            newFormData.private = false;
        } else if (name === 'private' && checked) {
            newFormData.online_event = false;
        }

        // For online event, clear out postcode and set country to standard
        if (newFormData.online_event) {
            newFormData.venue_postcode = '';
            newFormData.venue_country = '';
            // if it was previously set to a physical location, default to Google Meet
            if (!['Google Meet', 'Zoom', 'YouTube Live'].includes(newFormData.venue_name)) {
                newFormData.venue_name = 'Google Meet';
            }
        } else {
            newFormData.venue_country = newFormData.venue_country || 'India';
            if (['Google Meet', 'Zoom', 'YouTube Live'].includes(newFormData.venue_name)) {
                newFormData.venue_name = '';
            }
        }

        setFormData(newFormData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingId) {
                await api.put(`/ events / ${editingId} `, formData);
            } else {
                await api.post('/events', formData);
            }

            // Retain the series_id if we have one so subsequent events stay in the series
            const currentSeriesId = formData.event_series_id;
            setFormData({ name: '', description: '', venue_name: '', venue_postcode: '', venue_country: 'India', start: '', end: '', online_event: false, private: false, event_series_id: currentSeriesId });
            setEditingId(null);
            fetchEvents();
        } catch (err) {
            console.error(err);
            alert("Failed to save event. Check console.");
        }
        setLoading(false);
    };

    const handleEdit = (event) => {
        setEditingId(event.id);
        const formatForInput = (isoString) => {
            if (!isoString) return '';
            const date = new Date(isoString);
            return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        };

        setFormData({
            name: event.name,
            description: event.description || '',
            venue_name: event.venue?.name || '',
            venue_postcode: event.venue?.postal_code || '',
            venue_country: event.venue?.country || 'India',
            start: formatForInput(event.start?.iso),
            end: formatForInput(event.end?.iso),
            online_event: event.online_event === 'true',
            private: event.private === 'true'
        });
        window.scrollTo(0, 0);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await api.delete(`/ events / ${deleteConfirmId} `);
            setDeleteConfirmId(null);
            fetchEvents();
        } catch (err) {
            console.error(err);
            alert("Failed to delete event.");
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Events</h1>

            <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-brand-300">
                        {editingId ? 'Edit Event' : 'Create New Event'}
                    </h2>
                    {editingId && (
                        <button
                            onClick={() => { setEditingId(null); setFormData({ name: '', description: '', venue_name: '', venue_postcode: '', venue_country: 'India', start: '', end: '', online_event: false, private: false, event_series_id: '' }); }}
                            className="text-sm text-gray-400 hover:text-white"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 items-end">
                    <div className="col-span-2">
                        <label className="label-styled">Event Name</label>
                        <input name="name" type="text" className="input-styled" placeholder="e.g. Batch 1" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="col-span-2">
                        <label className="label-styled">Description</label>
                        <textarea name="description" className="input-styled h-24 resize-none" placeholder="Tell everyone why they should attend..." value={formData.description} onChange={handleChange}></textarea>
                    </div>
                    <div>
                        <label className="label-styled">Start Date & Time</label>
                        <input name="start" type="datetime-local" className="input-styled" value={formData.start} onChange={handleChange} required />
                    </div>
                    <div>
                        <label className="label-styled">End Date & Time</label>
                        <input name="end" type="datetime-local" className="input-styled" value={formData.end} onChange={handleChange} required />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 items-center mt-2">
                        <div className="col-span-2">
                            {formData.online_event ? (
                                <div className="col-span-2">
                                    <label className="label-styled">Platform</label>
                                    <select
                                        name="venue_name"
                                        className="input-styled"
                                        value={formData.venue_name}
                                        onChange={handleChange}
                                    >
                                        <option value="Google Meet">Google Meet</option>
                                        <option value="Zoom">Zoom</option>
                                        <option value="YouTube Live">YouTube Live</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="label-styled">Venue Name</label>
                                        <input name="venue_name" type="text" className="input-styled" placeholder="e.g. Blues bar" value={formData.venue_name} onChange={handleChange} required />
                                    </div>
                                    <div>
                                        <label className="label-styled">Postcode / Zip</label>
                                        <input name="venue_postcode" type="text" className="input-styled" placeholder="e.g. E8 3JS" value={formData.venue_postcode} onChange={handleChange} />
                                    </div>
                                    <div>
                                        <label className="label-styled">Country</label>
                                        <input name="venue_country" type="text" className="input-styled" placeholder="e.g. India" value={formData.venue_country} onChange={handleChange} required />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-6">
                            <input type="checkbox" name="online_event" id="online_event" checked={formData.online_event} onChange={handleChange} className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500 focus:ring-offset-gray-900" />
                            <label htmlFor="online_event" className="text-sm text-gray-300 cursor-pointer">Online Event</label>
                        </div>
                        <div className="flex items-center gap-2 mt-6">
                            <input type="checkbox" name="private" id="private" checked={formData.private} onChange={handleChange} className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500 focus:ring-offset-gray-900" />
                            <label htmlFor="private" className="text-sm text-gray-300 cursor-pointer">Private Event</label>
                        </div>
                        <div className="col-span-2 md:col-span-4 flex justify-end">
                            <button type="submit" className="btn-primary flex justify-center items-center gap-2 h-12 px-8" disabled={loading}>
                                {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                {editingId ? 'Save Changes' : 'Create Event'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.length === 0 ? (
                    <p className="text-gray-500 col-span-full">No events found. Start by creating one!</p>
                ) : (
                    events.map(event => (
                        <div key={event.id} className="glass-card p-6 flex flex-col justify-between group">
                            <div>
                                <h3 className="text-xl font-bold mb-2">{event.name}</h3>
                                <p className="text-sm text-gray-400 mb-4">{new Date(event.start.iso).toLocaleString()}</p>
                                <p className="text-sm font-medium text-brand-300">
                                    {event.online_event === "true" ? `🌐 Online(${event.venue?.name || 'Link Pending'})` : (
                                        [event.venue?.name, event.venue?.postal_code, event.venue?.country].filter(Boolean).join(', ') || 'No Venue Listed'
                                    )}
                                </p>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">ID: {event.id}</span>
                                    <span className="text-green-400 text-sm font-medium">{event.status === 'published' ? 'Live' : 'Draft'}</span>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-white/5 opacity-80 hover:opacity-100 transition-opacity">
                                    <Link
                                        to={`/admin/events/${event.id}`}
                                        className="p-2 bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                                        title="Inspect Event Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleEdit(event)}
                                        className="p-2 bg-white/5 hover:bg-brand-500/20 text-gray-300 hover:text-brand-300 rounded transition-colors"
                                        title="Edit Event Name"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirmId(event.id)}
                                        className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded transition-colors"
                                        title="Delete Event"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 p-6 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in relative">
                        <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Permanently Delete?</h3>
                            <p className="text-gray-400 text-sm">
                                Are you sure you want to permanently delete this event? This action corresponds to the Event Series in Ticket Tailor and will <strong className="text-white">wipe all tickets</strong>.
                            </p>

                            <div className="flex w-full gap-3 mt-6 pt-2">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium shadow-lg shadow-red-500/25"
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

export default Events;
