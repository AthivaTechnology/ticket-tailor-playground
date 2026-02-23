import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Ticket, User, Mail, Phone, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import { useFormik } from 'formik';
import * as Yup from 'yup';

const EventCheckout = () => {
    const { id } = useParams(); // Occurrence ID
    const navigate = useNavigate();

    const [occurrence, setOccurrence] = useState(null);
    const [series, setSeries] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [ticketQuantities, setTicketQuantities] = useState({});
    const [inventoryMap, setInventoryMap] = useState({});

    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            phone: ''
        },
        validationSchema: Yup.object({
            name: Yup.string()
                .required('Full Name is required'),
            email: Yup.string()
                .email('Invalid email address')
                .required('Email is required'),
            phone: Yup.string()
                .matches(/^\+?[0-9\-\s()]{7,15}$/, 'Invalid phone number (must be 7-15 digits)')
        }),
        onSubmit: async (values) => {
            setErrorMsg('');

            let selectedItems = [];

            Object.entries(ticketQuantities).forEach(([id, qty]) => {
                if (qty <= 0) return;

                const bundle = bundles.find(b => b.id === id);
                if (bundle) {
                    bundle.ticket_types.forEach(tt => {
                        selectedItems.push({
                            ticket_type_id: tt.id,
                            quantity: tt.quantity * qty
                        });
                    });
                } else {
                    // It's a standard ticket
                    selectedItems.push({
                        ticket_type_id: id,
                        quantity: qty
                    });
                }
            });

            // Group by ticket_type_id in case a bundle and a standalone ticket overlap
            const groupedItems = {};
            selectedItems.forEach(item => {
                groupedItems[item.ticket_type_id] = (groupedItems[item.ticket_type_id] || 0) + item.quantity;
            });

            const finalItemsList = Object.keys(groupedItems).map(tid => ({
                ticket_type_id: tid,
                quantity: groupedItems[tid]
            }));

            if (finalItemsList.length === 0) {
                setErrorMsg('Please select at least one ticket.');
                return;
            }

            setSubmitting(true);
            try {
                const payload = {
                    event_id: id,
                    items: finalItemsList,
                    buyer_name: values.name,
                    buyer_email: values.email,
                    phone: values.phone
                };

                await api.post('/orders', payload);
                setSuccess(true);
            } catch (err) {
                console.error("Checkout failed:", err);
                setErrorMsg(err.response?.data?.detail || "Checkout failed. Please try again.");
            }
            setSubmitting(false);
        }
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch the specific event occurrence
                const eventRes = await api.get(`/events/${id}`);
                const eventData = eventRes.data;
                setOccurrence(eventData);

                // Fetch available tickets for this occurrence
                const ticketRes = await api.get(`/events/${id}/tickets`);
                const availableTickets = ticketRes.data.data || [];
                setTickets(availableTickets);

                // Fetch parent series for branding/images and bundles
                let availableBundles = [];
                if (eventData.event_series_id) {
                    const seriesRes = await api.get(`/event_series/${eventData.event_series_id}`);
                    setSeries(seriesRes.data);

                    try {
                        const bundleRes = await api.get(`/event_series/${eventData.event_series_id}/bundles/availability?event_id=${id}`);
                        availableBundles = bundleRes.data.data || [];
                        setBundles(availableBundles);
                    } catch (bErr) {
                        console.warn("No bundles found or supported:", bErr);
                    }
                }

                if (availableTickets.length > 0 || availableBundles.length > 0) {
                    // Initialize quantities to 0
                    const initialQuantities = {};
                    const newInventory = {};

                    availableTickets.forEach(t => {
                        initialQuantities[t.id] = 0;
                        newInventory[t.id] = t.quantity || 0;
                    });

                    availableBundles.forEach(b => {
                        initialQuantities[b.id] = 0;
                        if (b.included_tickets_details) {
                            b.included_tickets_details.forEach(inc => {
                                newInventory[inc.id] = inc.left || 0;
                            });
                        }
                    });

                    setTicketQuantities(initialQuantities);
                    setInventoryMap(newInventory);
                }

            } catch (err) {
                console.error("Failed to load checkout data", err);
                setErrorMsg("Could not load event details. It may be unavailable.");
            }
            setLoading(false);
        };

        if (id) fetchData();
    }, [id]);

    const handleQuantityChange = (ticketId, delta, max) => {
        setTicketQuantities(prev => {
            const current = prev[ticketId] || 0;
            const next = current + delta;
            if (next < 0 || next > (max || 10)) return prev;
            return { ...prev, [ticketId]: next };
        });
    };

    const canIncrement = (itemId, maxQ) => {
        const current = ticketQuantities[itemId] || 0;
        if (current >= maxQ) return false;

        const simulatedQty = { ...ticketQuantities, [itemId]: current + 1 };

        const getRequired = (tid) => {
            let total = 0;
            if (simulatedQty[tid]) total += simulatedQty[tid];
            bundles.forEach(b => {
                if (simulatedQty[b.id] > 0 && b.included_tickets_details) {
                    const inc = b.included_tickets_details.find(t => t.id === tid);
                    if (inc) total += simulatedQty[b.id] * inc.quantity;
                }
            });
            return total;
        };

        const bundle = bundles.find(b => b.id === itemId);
        if (bundle && bundle.included_tickets_details) {
            for (let t of bundle.included_tickets_details) {
                if (getRequired(t.id) > (inventoryMap[t.id] || 0)) {
                    return false;
                }
            }
        } else {
            if (getRequired(itemId) > (inventoryMap[itemId] || 0)) {
                return false;
            }
        }
        return true;
    };

    if (loading) {
        return <div className="text-center py-20 text-brand-300 animate-pulse text-xl">Loading Secure Checkout...</div>;
    }

    if (!occurrence) {
        return <div className="text-center py-20 text-red-400">Event not found.</div>;
    }

    if (success) {
        return (
            <div className="max-w-2xl mx-auto py-16 px-4 text-center">
                <div className="glass-card p-12 flex flex-col items-center">
                    <CheckCircle className="w-20 h-20 text-green-400 mb-6" />
                    <h1 className="text-4xl font-bold mb-4 text-white">Registration Successful!</h1>
                    <p className="text-gray-300 mb-8 text-lg">
                        Thank you, {formik.values.name}. We've received your registration for <strong>{occurrence.name}</strong>.
                        Your tickets have been sent to <strong>{formik.values.email}</strong>.
                    </p>
                    <button
                        onClick={() => navigate('/series')}
                        className="btn-primary"
                    >
                        Return to Events
                    </button>
                </div>
            </div>
        );
    }

    // Calculate Total
    const allAvailableOptions = [...tickets, ...bundles];
    const selectedOptions = allAvailableOptions.filter(t => (ticketQuantities[t.id] || 0) > 0);
    const totalAmount = selectedOptions.reduce((sum, t) => sum + (t.price * ticketQuantities[t.id]), 0);
    const hasSelections = selectedOptions.length > 0;
    const totalTicketsCount = selectedOptions.reduce((sum, t) => {
        const qty = ticketQuantities[t.id] || 0;
        if (bundles.some(b => b.id === t.id)) {
            return sum + (t.included_tickets_details?.reduce((acc, inc) => acc + (inc.quantity * qty), 0) || qty);
        }
        return sum + qty;
    }, 0);

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Event
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Checkout Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card p-8 border-brand-500/30 border-t-4">
                        <h2 className="text-2xl font-bold mb-6 text-white flex items-center">
                            <User className="w-6 h-6 mr-3 text-brand-400" />
                            Buyer Information
                        </h2>

                        {errorMsg && (
                            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={formik.handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="label-styled block mb-2">Full Name *</label>
                                    <div className="relative">
                                        <User className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${formik.touched.name && formik.errors.name ? 'text-red-400' : 'text-gray-400'}`} />
                                        <input
                                            type="text"
                                            name="name"
                                            value={formik.values.name}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            className={`input-styled w-full pl-10 text-white ${formik.touched.name && formik.errors.name ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    {formik.touched.name && formik.errors.name ? (
                                        <div className="text-red-400 text-xs mt-1 font-medium">{formik.errors.name}</div>
                                    ) : null}
                                </div>

                                <div>
                                    <label className="label-styled block mb-2">Email Address *</label>
                                    <div className="relative">
                                        <Mail className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${formik.touched.email && formik.errors.email ? 'text-red-400' : 'text-gray-400'}`} />
                                        <input
                                            type="email"
                                            name="email"
                                            value={formik.values.email}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            className={`input-styled w-full pl-10 text-white ${formik.touched.email && formik.errors.email ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    {formik.touched.email && formik.errors.email ? (
                                        <div className="text-red-400 text-xs mt-1 font-medium">{formik.errors.email}</div>
                                    ) : (
                                        <p className="text-xs text-gray-400 mt-1">Your tickets will be sent here.</p>
                                    )}
                                </div>

                                <div>
                                    <label className="label-styled block mb-2">Phone Number</label>
                                    <div className="relative">
                                        <Phone className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${formik.touched.phone && formik.errors.phone ? 'text-red-400' : 'text-gray-400'}`} />
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formik.values.phone}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            className={`input-styled w-full pl-10 text-white ${formik.touched.phone && formik.errors.phone ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                                            placeholder="+1 (555) 000-0000"
                                        />
                                    </div>
                                    {formik.touched.phone && formik.errors.phone ? (
                                        <div className="text-red-400 text-xs mt-1 font-medium">{formik.errors.phone}</div>
                                    ) : null}
                                </div>
                            </div>

                            <hr className="border-white/10 my-8" />

                            <h2 className="text-2xl font-bold mb-6 text-white flex items-center">
                                <Ticket className="w-6 h-6 mr-3 text-brand-400" />
                                Select Tickets
                            </h2>

                            <div className="space-y-3">
                                {tickets.length > 0 ? tickets.map(ticket => {
                                    const maxQ = ticket.max_per_order || 10;
                                    const qty = ticketQuantities[ticket.id] || 0;
                                    const isSoldOut = ticket.status === 'sold_out';

                                    return (
                                        <div
                                            key={ticket.id}
                                            className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${qty > 0 ? 'border-brand-500 bg-brand-500/10' : 'border-white/5 bg-dark-800'}`}
                                        >
                                            <div className="flex-1">
                                                <p className={`font-medium ${isSoldOut ? 'text-gray-500 line-through' : 'text-white'}`}>{ticket.name}</p>
                                                <p className="text-xs text-gray-400 mb-1">{ticket.description || 'Standard entry'}</p>
                                                {!isSoldOut && (
                                                    <p className="text-brand-300 font-bold">
                                                        {ticket.price > 0 ? `₹${(ticket.price / 100).toFixed(2)}` : 'Free'}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                {isSoldOut ? (
                                                    <span className="text-sm font-bold text-red-400 bg-red-400/10 px-3 py-1 rounded">Sold Out</span>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuantityChange(ticket.id, -1, maxQ)}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-colors ${qty > 0 ? 'bg-dark-600 hover:bg-dark-500' : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-white/10'}`}
                                                                disabled={qty <= 0}
                                                            >
                                                                -
                                                            </button>
                                                            <span className="w-4 text-center font-bold text-lg text-white">{qty}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuantityChange(ticket.id, 1, maxQ)}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-colors ${canIncrement(ticket.id, maxQ) ? 'bg-brand-600 hover:bg-brand-500' : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-white/10'}`}
                                                                disabled={!canIncrement(ticket.id, maxQ)}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Max {maxQ}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <p className="text-gray-400 italic">No tickets currently available.</p>
                                )}

                                {bundles.length > 0 && (
                                    <>
                                        <h3 className="text-xl font-bold mt-8 mb-4 text-white flex items-center border-t border-white/10 pt-6">
                                            Ticket Bundles
                                        </h3>
                                        {bundles.map(bundle => {
                                            const maxQ = bundle.max_quantity || 10;
                                            const qty = ticketQuantities[bundle.id] || 0;
                                            const isSoldOut = !bundle.is_available;

                                            return (
                                                <div
                                                    key={bundle.id}
                                                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${qty > 0 ? 'border-brand-500 bg-brand-500/10' : 'border-indigo-500/30 bg-indigo-900/10'}`}
                                                >
                                                    <div className="flex-1">
                                                        <p className={`font-medium ${isSoldOut ? 'text-gray-500 line-through' : 'text-white'}`}>{bundle.name}</p>
                                                        <p className="text-xs text-indigo-300 mb-1">{bundle.description}</p>

                                                        {bundle.included_tickets_details && bundle.included_tickets_details.length > 0 && (
                                                            <div className={`my-2 text-xs ${isSoldOut ? 'text-gray-500' : 'text-indigo-300/90'} border-l-2 ${isSoldOut ? 'border-gray-600' : 'border-indigo-500/50'} pl-2`}>
                                                                <div className="space-y-0.5">
                                                                    {bundle.included_tickets_details.map(t => (
                                                                        <div key={t.id} className="flex">
                                                                            <span>{t.name} x{t.quantity}</span>
                                                                            <span className={`ml-2 ${isSoldOut ? 'text-gray-600' : 'text-gray-400'}`}>({t.left} left)</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {!isSoldOut && (
                                                            <p className="text-brand-300 font-bold">
                                                                {bundle.price > 0 ? `₹${(bundle.price / 100).toFixed(2)}` : 'Free'}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col items-end gap-2">
                                                        {isSoldOut ? (
                                                            <span className="text-sm font-bold text-red-400 bg-red-400/10 px-3 py-1 rounded">Sold Out</span>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-3">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleQuantityChange(bundle.id, -1, maxQ)}
                                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-colors ${qty > 0 ? 'bg-dark-600 hover:bg-dark-500' : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-white/10'}`}
                                                                        disabled={qty <= 0}
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="w-4 text-center font-bold text-lg text-white">{qty}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleQuantityChange(bundle.id, 1, maxQ)}
                                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-colors ${canIncrement(bundle.id, maxQ) ? 'bg-brand-600 hover:bg-brand-500' : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-white/10'}`}
                                                                        disabled={!canIncrement(bundle.id, maxQ)}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                                <span className="text-[10px] text-gray-500 uppercase font-semibold">Max {maxQ}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !hasSelections}
                                className="w-full mt-8 flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg px-8 py-4 rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all duration-300"
                            >
                                {submitting ? (
                                    <span className="animate-pulse">Processing Order...</span>
                                ) : (
                                    <>Complete Registration <ArrowRight className="w-5 h-5 ml-2" /></>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Order Summary Sidebar */}
                <div className="lg:col-span-1">
                    <div className="glass-card overflow-hidden sticky top-8">
                        {/* Event Thumbnail */}
                        <div className="h-32 bg-gradient-to-br from-brand-800 to-dark-900 relative">
                            {series?.images?.thumbnail && (
                                <img src={series.images.thumbnail} alt="Event" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                            )}
                        </div>

                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4 text-white">Order Summary</h3>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Event</p>
                                    <p className="font-medium text-gray-200">{occurrence.name}</p>
                                </div>
                                <div className="flex gap-2 text-gray-300">
                                    <Calendar className="w-4 h-4 mt-0.5 text-brand-400" />
                                    <p className="text-sm">{new Date(occurrence.start.iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                </div>
                            </div>

                            <hr className="border-white/10 mb-6" />

                            {hasSelections ? (
                                <div className="space-y-3">
                                    {selectedOptions.map(t => (
                                        <div key={t.id} className="flex flex-col text-gray-300 border-b border-white/5 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
                                            <div className="flex justify-between items-start">
                                                <span className="flex-1 pr-2">
                                                    {t.name} <span className="text-gray-500">x {ticketQuantities[t.id]}</span>
                                                </span>
                                                <span className="whitespace-nowrap">{t.price > 0 ? `₹${((t.price * ticketQuantities[t.id]) / 100).toFixed(2)}` : 'Free'}</span>
                                            </div>

                                            {t.included_tickets_details && (
                                                <div className="mt-1 pl-2 border-l-2 border-indigo-500/30 text-xs text-gray-400 space-y-0.5">
                                                    {t.included_tickets_details.map(inc => (
                                                        <div key={inc.id}>
                                                            {inc.quantity * ticketQuantities[t.id]} × {inc.name} <span className="text-indigo-400/70 ml-1">({t.name})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <div className="flex justify-between text-white font-bold text-lg pt-4 border-t border-white/10 mt-4">
                                        <span>Total ({totalTicketsCount} ticket{totalTicketsCount !== 1 ? 's' : ''})</span>
                                        <span className="text-brand-300">{totalAmount > 0 ? `₹${(totalAmount / 100).toFixed(2)}` : 'Free'}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic text-center py-4">Select tickets to see total</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EventCheckout;
