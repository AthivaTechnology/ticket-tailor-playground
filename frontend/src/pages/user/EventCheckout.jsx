import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Tag as TagIcon, ArrowRight, Ticket, User, Mail, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import eventPlaceholder from '../../assets/event-placeholder.jpg';

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
    const [errorMsg, setErrorMsg] = useState('');

    const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            phone: ''
        },
        validationSchema: Yup.object({
            name: Yup.string().required('Full Name is required'),
            email: Yup.string().email('Invalid email address').required('Email is required'),
            phone: Yup.string().matches(/^\+?[0-9\-\s()]{7,15}$/, 'Invalid phone number (must be 7-15 digits)')
        }),
        onSubmit: async (values) => {
            setErrorMsg('');

            let selectedItems = [];

            Object.entries(ticketQuantities).forEach(([tid, qty]) => {
                if (qty <= 0) return;

                const bundle = bundles.find(b => b.id === tid);
                if (bundle) {
                    bundle.ticket_types.forEach(tt => {
                        selectedItems.push({
                            ticket_type_id: tt.id,
                            quantity: tt.quantity * qty,
                            name: `${bundle.name} — ${tt.name}`,
                            price: 0, // bundle price split not available here; use bundle price
                        });
                    });
                } else {
                    const ticket = tickets.find(t => t.id === tid);
                    selectedItems.push({
                        ticket_type_id: tid,
                        quantity: qty,
                        name: ticket?.name || 'Ticket',
                        price: ticket?.price || 0,
                    });
                }
            });

            // Group by ticket_type_id
            const groupedItems = {};
            selectedItems.forEach(item => {
                const key = item.ticket_type_id;
                if (!groupedItems[key]) {
                    groupedItems[key] = { ...item, quantity: 0 };
                }
                groupedItems[key].quantity += item.quantity;
            });

            const finalItems = Object.values(groupedItems);

            if (finalItems.length === 0) {
                setErrorMsg('Please select at least one ticket.');
                return;
            }

            setSubmitting(true);
            try {
                const payload = {
                    event_id: id,
                    buyer_name: values.name,
                    buyer_email: values.email,
                    phone: values.phone || '',
                    items: finalItems,
                    event_name: occurrence?.name || '',
                    currency: 'usd',
                };

                const totalAmount = finalItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

                if (totalAmount === 0) {
                    // Free tickets — navigate to order review page first (mirrors paid Stripe flow)
                    navigate('/payment/free-confirm', {
                        state: {
                            payload,
                            occurrence,
                            series,
                            finalItems,
                            totalTicketsCount: finalItems.reduce((s, i) => s + i.quantity, 0),
                        }
                    });
                } else {
                    // Paid tickets — create Stripe Checkout Session and redirect to Stripe hosted page
                    const res = await api.post('/payments/create-checkout-session', payload);
                    const { url } = res.data;
                    if (url) {
                        window.location.href = url;
                    } else {
                        setErrorMsg('Failed to create payment session. Please try again.');
                    }
                }
            } catch (err) {
                console.error('Checkout failed:', err);
                setErrorMsg(err.response?.data?.detail || 'Checkout failed. Please try again.');
            }
            setSubmitting(false);
        }
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const eventRes = await api.get(`/events/${id}`);
                const eventData = eventRes.data;
                setOccurrence(eventData);

                const ticketRes = await api.get(`/events/${id}/tickets`);
                const availableTickets = ticketRes.data.data || [];
                setTickets(availableTickets);

                let availableBundles = [];
                if (eventData.event_series_id) {
                    const seriesRes = await api.get(`/event_series/${eventData.event_series_id}`);
                    setSeries(seriesRes.data);

                    try {
                        const bundleRes = await api.get(`/event_series/${eventData.event_series_id}/bundles/availability?event_id=${id}`);
                        availableBundles = bundleRes.data.data || [];
                        setBundles(availableBundles);
                    } catch (bErr) {
                        console.warn('No bundles:', bErr);
                    }
                }

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

            } catch (err) {
                console.error('Failed to load checkout data', err);
                setErrorMsg('Could not load event details.');
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
                if (getRequired(t.id) > (inventoryMap[t.id] || 0)) return false;
            }
        } else {
            if (getRequired(itemId) > (inventoryMap[itemId] || 0)) return false;
        }
        return true;
    };

    if (loading) {
        return <div className="text-center py-20 text-brand-300 animate-pulse text-xl">Loading Secure Checkout...</div>;
    }

    if (!occurrence) {
        return <div className="text-center py-20 text-red-400">Event not found.</div>;
    }

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

    const isFree = totalAmount === 0;

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
                        <form onSubmit={formik.handleSubmit} className="space-y-6">
                            {errorMsg && (
                                <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
                                    {errorMsg}
                                </div>
                            )}
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
                                                        {ticket.price > 0 ? `$${(ticket.price / 100).toFixed(2)}` : 'Free'}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                {isSoldOut ? (
                                                    <span className="text-sm font-bold text-red-400 bg-red-400/10 px-3 py-1 rounded">Sold Out</span>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-3">
                                                            <button type="button" onClick={() => handleQuantityChange(ticket.id, -1, maxQ)}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-colors ${qty > 0 ? 'bg-dark-600 hover:bg-dark-500' : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-white/10'}`}
                                                                disabled={qty <= 0}>-</button>
                                                            <span className="w-4 text-center font-bold text-lg text-white">{qty}</span>
                                                            <button type="button" onClick={() => handleQuantityChange(ticket.id, 1, maxQ)}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-colors ${canIncrement(ticket.id, maxQ) ? 'bg-brand-600 hover:bg-brand-500' : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-white/10'}`}
                                                                disabled={!canIncrement(ticket.id, maxQ)}>+</button>
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
                                        <h3 className="text-xl font-bold mt-8 mb-4 text-white border-t border-white/10 pt-6">Ticket Bundles</h3>
                                        {bundles.map(bundle => {
                                            const maxQ = bundle.max_quantity || 10;
                                            const qty = ticketQuantities[bundle.id] || 0;
                                            const isSoldOut = !bundle.is_available;

                                            return (
                                                <div key={bundle.id}
                                                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${qty > 0 ? 'border-brand-500 bg-brand-500/10' : 'border-indigo-500/30 bg-indigo-900/10'}`}
                                                >
                                                    <div className="flex-1">
                                                        <p className={`font-medium ${isSoldOut ? 'text-gray-500 line-through' : 'text-white'}`}>{bundle.name}</p>
                                                        <p className="text-xs text-indigo-300 mb-1">{bundle.description}</p>
                                                        {!isSoldOut && (
                                                            <p className="text-brand-300 font-bold">
                                                                {bundle.price > 0 ? `$${(bundle.price / 100).toFixed(2)}` : 'Free'}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        {isSoldOut ? (
                                                            <span className="text-sm font-bold text-red-400 bg-red-400/10 px-3 py-1 rounded">Sold Out</span>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-3">
                                                                    <button type="button" onClick={() => handleQuantityChange(bundle.id, -1, maxQ)}
                                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-colors ${qty > 0 ? 'bg-dark-600 hover:bg-dark-500' : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-white/10'}`}
                                                                        disabled={qty <= 0}>-</button>
                                                                    <span className="w-4 text-center font-bold text-lg text-white">{qty}</span>
                                                                    <button type="button" onClick={() => handleQuantityChange(bundle.id, 1, maxQ)}
                                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-colors ${canIncrement(bundle.id, maxQ) ? 'bg-brand-600 hover:bg-brand-500' : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-white/10'}`}
                                                                        disabled={!canIncrement(bundle.id, maxQ)}>+</button>
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

                            <hr className="border-white/10 my-10" />

                            <h2 className="text-2xl font-bold mb-6 text-white flex items-center">
                                <User className="w-6 h-6 mr-3 text-brand-400" />
                                Buyer Information
                            </h2>

                            <div className="space-y-4">
                                {/* Name */}
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
                                            className={`input-styled w-full pl-10 text-white ${formik.touched.name && formik.errors.name ? 'border-red-500/50' : ''}`}
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    {formik.touched.name && formik.errors.name && (
                                        <div className="text-red-400 text-xs mt-1 font-medium">{formik.errors.name}</div>
                                    )}
                                </div>

                                {/* Email */}
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
                                            className={`input-styled w-full pl-10 text-white ${formik.touched.email && formik.errors.email ? 'border-red-500/50' : ''}`}
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    {formik.touched.email && formik.errors.email ? (
                                        <div className="text-red-400 text-xs mt-1 font-medium">{formik.errors.email}</div>
                                    ) : (
                                        <p className="text-xs text-gray-400 mt-1">Your tickets will be sent here.</p>
                                    )}
                                </div>

                                {/* Phone */}
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
                                            className={`input-styled w-full pl-10 text-white ${formik.touched.phone && formik.errors.phone ? 'border-red-500/50' : ''}`}
                                            placeholder="+91 98765 43210"
                                        />
                                    </div>
                                    {formik.touched.phone && formik.errors.phone && (
                                        <div className="text-red-400 text-xs mt-1 font-medium">{formik.errors.phone}</div>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting || !hasSelections}
                                className="w-full mt-8 flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg px-8 py-4 rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all duration-300"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Redirecting to Payment...</span>
                                    </>
                                ) : isFree ? (
                                    <>Complete Free Registration <ArrowRight className="w-5 h-5 ml-2" /></>
                                ) : (
                                    <>Proceed to Payment <ArrowRight className="w-5 h-5 ml-2" /></>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Order Summary Sidebar */}
                <div className="lg:col-span-1">
                    <div className="glass-card overflow-hidden sticky top-8">
                        <div className="h-32 bg-gradient-to-br from-brand-800 to-dark-900 relative">
                            <img
                                src={series.images?.thumbnail || eventPlaceholder}
                                alt="Event"
                                className="absolute inset-0 w-full h-full object-cover opacity-60"
                            />
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
                                        <div key={t.id} className="flex justify-between text-gray-300 text-sm">
                                            <span>{t.name} <span className="text-gray-500">× {ticketQuantities[t.id]}</span></span>
                                            <span>{t.price > 0 ? `$${((t.price * ticketQuantities[t.id]) / 100).toFixed(2)}` : 'Free'}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between text-white font-bold text-lg pt-4 border-t border-white/10 mt-4">
                                        <span>Total ({totalTicketsCount} ticket{totalTicketsCount !== 1 ? 's' : ''})</span>
                                        <span className="text-brand-300">{totalAmount > 0 ? `$${(totalAmount / 100).toFixed(2)}` : 'Free'}</span>
                                    </div>

                                    {/* Payment badge */}
                                    {totalAmount > 0 ? (
                                        <div className="mt-4 flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                                <line x1="1" y1="10" x2="23" y2="10" />
                                            </svg>
                                            <span className="text-xs text-blue-300 font-medium">Secure payment via Stripe</span>
                                        </div>
                                    ) : (
                                        <div className="mt-4 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                            <span className="text-xs text-green-300 font-medium">✓ This is a free event</span>
                                        </div>
                                    )}
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
