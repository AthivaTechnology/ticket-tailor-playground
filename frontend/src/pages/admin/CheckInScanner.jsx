import React, { useState, useRef, useEffect } from 'react';
import { Search, CheckCircle, XCircle, User, Calendar, MapPin, ScanLine } from 'lucide-react';
import api from '../../services/api';

const CheckInScanner = () => {
    const [barcode, setBarcode] = useState('');
    const [scannedTicket, setScannedTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusToast, setStatusToast] = useState(null); // { type: 'success' | 'warn' | 'error', message: '' }
    const inputRef = useRef(null);

    // Keep focus on input for physical scanners
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, [scannedTicket]);

    const handleSearch = async (e) => {
        e.preventDefault();
        const code = barcode.trim();
        if (!code) return;

        setLoading(true);
        setStatusToast(null);
        setScannedTicket(null); // Clear previous

        try {
            // Find ticket by barcode/id
            const res = await api.get(`/check_ins/${code}`);
            const ticket = res.data;
            setScannedTicket(ticket);

            // Determine initial status warning
            if (ticket.status === 'voided') {
                setStatusToast({ type: 'error', message: '❌ Ticket is VOIDED and cannot be used.' });
            } else if (ticket.checked_in === "true") {
                setStatusToast({ type: 'warn', message: '⚠ WARNING: Ticket has ALREADY been checked in!' });
            } else {
                setStatusToast({ type: 'success', message: '✅ Valid Ticket. Ready for Check-in.' });
            }

        } catch (err) {
            console.error(err);
            setScannedTicket(null);
            setStatusToast({ type: 'error', message: '❌ Invalid Barcode: Ticket not found in system.' });
        }
        setLoading(false);
    };

    const handleApproveCheckIn = async () => {
        if (!scannedTicket || scannedTicket.checked_in === "true" || scannedTicket.status === "voided") return;

        setLoading(true);
        try {
            await api.post('/check_ins', { ticket_id: scannedTicket.id });

            // Update local state to show it was successful
            setScannedTicket({ ...scannedTicket, checked_in: "true" });
            setStatusToast({ type: 'success', message: '🎉 Attendee successfully checked in!' });
            setBarcode(''); // reset for next scan
        } catch (err) {
            const msg = err.response?.data?.detail || "Failed to check in ticket.";
            setStatusToast({ type: 'error', message: `❌ ${msg}` });
        }
        setLoading(false);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
                    <ScanLine className="w-10 h-10 text-brand-400" />
                    Door Scanner
                </h1>
                <p className="text-gray-400">Scan or type a barcode to verify and check-in attendees.</p>
            </div>

            <div className="glass-card p-8 bg-dark-800/80">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            placeholder="Enter Ticket Barcode or ID (e.g. Vd639p2)"
                            className="input-styled pl-12 w-full text-lg py-4 font-mono tracking-wider"
                            disabled={loading}
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !barcode.trim()}
                        className="btn-primary px-8 text-lg flex items-center gap-2"
                    >
                        {loading && !scannedTicket ? 'Searching...' : 'Lookup'}
                    </button>
                </form>

                {/* Status Banner */}
                {statusToast && (
                    <div className={`mt-8 p-4 rounded-xl border flex items-center gap-3 font-bold text-lg shadow-lg ${statusToast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                            statusToast.type === 'warn' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' :
                                'bg-green-500/20 border-green-500/50 text-green-400'
                        }`}>
                        {statusToast.message}
                    </div>
                )}

                {/* Ticket Details Card */}
                {scannedTicket && (
                    <div className="mt-8 border border-white/10 rounded-2xl overflow-hidden bg-dark-900/50">
                        {/* Header Banner */}
                        <div className={`px-6 py-4 flex justify-between items-center ${scannedTicket.status === 'voided' ? 'bg-red-900/40 border-b border-red-500/30' :
                                scannedTicket.checked_in === 'true' ? 'bg-yellow-900/40 border-b border-yellow-500/30' :
                                    'bg-brand-900/40 border-b border-brand-500/30'
                            }`}>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">
                                    {scannedTicket.description}
                                </h3>
                                <p className="font-mono text-sm text-gray-300">
                                    Barcode: <span className="text-white bg-black/30 px-2 py-0.5 rounded">{scannedTicket.barcode}</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide border ${scannedTicket.status === 'voided' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                        scannedTicket.checked_in === 'true' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                            'bg-green-500/20 text-green-400 border-green-500/30'
                                    }`}>
                                    {scannedTicket.status === 'voided' ? 'VOIDED' : scannedTicket.checked_in === 'true' ? 'USED' : 'VALID'}
                                </span>
                            </div>
                        </div>

                        {/* Attendee Details */}
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-white/5 rounded-lg"><User className="w-5 h-5 text-brand-300" /></div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Attendee Name</p>
                                        <p className="text-lg font-medium text-white">
                                            {scannedTicket.full_name || scannedTicket.first_name || "Guest / Unnamed"}
                                        </p>
                                        {scannedTicket.email && <p className="text-gray-400 text-sm mt-0.5">{scannedTicket.email}</p>}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-white/5 rounded-lg"><MapPin className="w-5 h-5 text-gray-300" /></div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Source</p>
                                        <p className="text-base text-gray-200 capitalize">{scannedTicket.source || 'Online Checkout'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col justify-end">
                                {scannedTicket.status !== 'voided' && scannedTicket.checked_in === "false" ? (
                                    <button
                                        onClick={handleApproveCheckIn}
                                        disabled={loading}
                                        className="w-full btn-primary bg-green-600 hover:bg-green-500 shadow-[0_4px_20px_rgba(34,197,94,0.3)] py-4 text-xl flex justify-center items-center gap-2 transition-all transform hover:-translate-y-1"
                                    >
                                        {loading ? 'Processing...' : <><CheckCircle className="w-6 h-6" /> APPROVE ENTRY</>}
                                    </button>
                                ) : (
                                    <div className="w-full bg-dark-600 border border-white/5 rounded-xl py-4 text-center text-gray-400 font-bold flex justify-center items-center gap-2">
                                        <XCircle className="w-5 h-5" />
                                        ENTRY DENIED
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckInScanner;
