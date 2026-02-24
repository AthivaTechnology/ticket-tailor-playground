import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ticket, Calendar, User, Mail, Phone, CheckCircle, ArrowLeft, Loader2, Tag } from 'lucide-react';
import api from '../../services/api';

import eventPlaceholder from '../../assets/event-placeholder.jpg';

const FreeConfirmPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [confirming, setConfirming] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // If navigated directly without state, redirect back
    if (!state?.payload) {
        navigate('/series');
        return null;
    }

    const { payload, occurrence, series, finalItems, totalTicketsCount } = state;

    const handleConfirm = async () => {
        setConfirming(true);
        setErrorMsg('');
        try {
            await api.post('/payments/create-free-order', payload);
            navigate('/payment/success?free=true');
        } catch (err) {
            console.error('Free registration failed:', err);
            setErrorMsg(
                err.response?.data?.detail ||
                'Registration failed. Please try again or contact the organiser.'
            );
            setConfirming(false);
        }
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
            <div className="max-w-lg w-full space-y-5">

                {/* Header */}
                <div className="text-center mb-2">
                    <span className="inline-flex items-center gap-2 bg-green-500/15 text-green-400 border border-green-500/25 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                        <Tag className="w-3.5 h-3.5" /> Free Event
                    </span>
                    <h1 className="text-3xl font-bold text-white">Confirm Your Registration</h1>
                    <p className="text-gray-400 mt-2 text-sm">Review your details below and confirm to complete registration.</p>
                </div>

                {/* Order Summary Card */}
                <div className="glass-card p-6 space-y-5">

                    {/* Event info */}
                    <div className="flex items-start gap-4 pb-5 border-b border-white/10">
                        <img
                            src={series?.images?.thumbnail || eventPlaceholder}
                            alt="Event"
                            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                        />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Event</p>
                            <p className="text-white font-bold text-lg leading-tight">{occurrence?.name || payload.event_name}</p>
                            {occurrence?.start?.iso && (
                                <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-1">
                                    <Calendar className="w-3.5 h-3.5 text-brand-400" />
                                    {new Date(occurrence.start.iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Buyer info */}
                    <div className="space-y-3 pb-5 border-b border-white/10">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Your Details</p>
                        <div className="flex items-center gap-2.5 text-gray-300 text-sm">
                            <User className="w-4 h-4 text-brand-400 flex-shrink-0" />
                            <span>{payload.buyer_name}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-gray-300 text-sm">
                            <Mail className="w-4 h-4 text-brand-400 flex-shrink-0" />
                            <span>{payload.buyer_email}</span>
                        </div>
                        {payload.phone && (
                            <div className="flex items-center gap-2.5 text-gray-300 text-sm">
                                <Phone className="w-4 h-4 text-brand-400 flex-shrink-0" />
                                <span>{payload.phone}</span>
                            </div>
                        )}
                    </div>

                    {/* Ticket breakdown */}
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Tickets Selected</p>
                        {finalItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold">
                                        ×{item.quantity}
                                    </div>
                                    <span className="text-gray-200 text-sm">{item.name}</span>
                                </div>
                                <span className="text-green-400 font-bold text-sm">FREE</span>
                            </div>
                        ))}

                        {/* Total row */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-2">
                            <span className="text-white font-bold">
                                Total ({totalTicketsCount} ticket{totalTicketsCount !== 1 ? 's' : ''})
                            </span>
                            <span className="text-green-400 font-bold text-lg">$0.00 — Free</span>
                        </div>
                    </div>
                </div>

                {/* Error message */}
                {errorMsg && (
                    <div className="bg-red-500/15 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm">
                        {errorMsg}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button
                        onClick={handleConfirm}
                        disabled={confirming}
                        className="w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold text-lg px-8 py-4 rounded-xl shadow-[0_4px_20px_rgba(22,163,74,0.3)] transition-all duration-300"
                    >
                        {confirming ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Confirming Registration...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Confirm Free Registration
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => navigate(-1)}
                        disabled={confirming}
                        className="w-full flex justify-center items-center gap-2 bg-dark-700 hover:bg-dark-600 border border-white/10 text-gray-300 hover:text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 disabled:opacity-50"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Checkout
                    </button>
                </div>

                {/* Trust note */}
                <p className="text-center text-xs text-gray-500">
                    🎟️ Your ticket confirmation will be sent to <span className="text-gray-300">{payload.buyer_email}</span>
                </p>
            </div>
        </div>
    );
};

export default FreeConfirmPage;
