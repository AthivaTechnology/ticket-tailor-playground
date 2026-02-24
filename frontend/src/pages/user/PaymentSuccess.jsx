import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Ticket, Mail, ArrowRight, Loader2 } from 'lucide-react';

const PaymentSuccess = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isFree = searchParams.get('free') === 'true';
    const sessionId = searchParams.get('session_id');

    const [countdown, setCountdown] = useState(10);

    // Auto-redirect countdown
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    navigate('/series');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [navigate]);

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="max-w-lg w-full">
                {/* Success Card */}
                <div className="glass-card p-10 flex flex-col items-center text-center relative overflow-hidden">

                    {/* Background glow */}
                    <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent pointer-events-none" />

                    {/* Animated checkmark */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                        <div className="relative w-24 h-24 rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center">
                            <CheckCircle className="w-12 h-12 text-green-400" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-bold text-white mb-3">
                        {isFree ? 'Registration Confirmed!' : 'Payment Successful!'}
                    </h1>

                    <p className="text-gray-300 text-lg mb-2">
                        {isFree
                            ? 'Your free tickets have been registered.'
                            : 'Your payment has been processed successfully.'
                        }
                    </p>

                    {/* Info box */}
                    <div className="w-full mt-6 mb-8 bg-dark-800/60 border border-white/10 rounded-xl p-5 space-y-4 text-left">

                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-brand-500/15 rounded-lg mt-0.5">
                                <Ticket className="w-4 h-4 text-brand-400" />
                            </div>
                            <div>
                                <p className="text-white font-semibold text-sm">Tickets Being Processed</p>
                                <p className="text-gray-400 text-xs mt-0.5">
                                    Your tickets are being generated in Ticket Tailor right now.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-500/15 rounded-lg mt-0.5">
                                <Mail className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-white font-semibold text-sm">Check Your Email</p>
                                <p className="text-gray-400 text-xs mt-0.5">
                                    A ticket confirmation email will be sent to you shortly from Ticket Tailor.
                                </p>
                            </div>
                        </div>

                        {sessionId && (
                            <div className="pt-3 border-t border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Stripe Reference</p>
                                <p className="text-xs font-mono text-gray-400 break-all">{sessionId}</p>
                            </div>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="w-full space-y-3">
                        <button
                            onClick={() => navigate('/series')}
                            className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-bold px-6 py-3 rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all duration-300"
                        >
                            Browse More Events <ArrowRight className="w-4 h-4" />
                        </button>

                        <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Redirecting to events in {countdown}s...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccess;
