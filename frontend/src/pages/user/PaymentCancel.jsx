import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const PaymentCancel = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="max-w-lg w-full">
                <div className="glass-card p-10 flex flex-col items-center text-center relative overflow-hidden">

                    {/* Background glow */}
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent pointer-events-none" />

                    {/* Icon */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl" />
                        <div className="relative w-24 h-24 rounded-full bg-red-500/15 border-2 border-red-500/30 flex items-center justify-center">
                            <XCircle className="w-12 h-12 text-red-400" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-bold text-white mb-3">Payment Cancelled</h1>

                    <p className="text-gray-300 text-lg mb-2">
                        Your payment was not completed.
                    </p>

                    <p className="text-gray-400 text-sm mb-8">
                        No charges have been made to your card. You can go back and try again whenever you're ready.
                    </p>

                    {/* Info box */}
                    <div className="w-full mb-8 bg-dark-800/60 border border-white/10 rounded-xl p-5 text-left">
                        <p className="text-white font-semibold text-sm mb-2">What happened?</p>
                        <ul className="space-y-1 text-gray-400 text-xs list-disc list-inside">
                            <li>You may have clicked "Cancel" on the payment page</li>
                            <li>The session may have timed out</li>
                            <li>There may have been a payment issue</li>
                        </ul>
                    </div>

                    {/* Buttons */}
                    <div className="w-full space-y-3">
                        <button
                            onClick={() => navigate(-2)} // Go back to checkout (2 steps: Stripe → Cancel page → checkout)
                            className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-bold px-6 py-3 rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all duration-300"
                        >
                            <RefreshCw className="w-4 h-4" /> Try Again
                        </button>

                        <button
                            onClick={() => navigate('/series')}
                            className="w-full flex justify-center items-center gap-2 bg-dark-700 hover:bg-dark-600 border border-white/10 text-gray-300 hover:text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300"
                        >
                            <ArrowLeft className="w-4 h-4" /> Return to Events
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentCancel;
