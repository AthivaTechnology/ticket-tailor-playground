import React, { useState, useEffect } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, Ticket, User, XCircle, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import api from '../../services/api';

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [expandedOrders, setExpandedOrders] = useState(new Set());
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(null);
    const [activeTab, setActiveTab] = useState('confirmed'); // 'confirmed' | 'pending'

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
    };

    useEffect(() => {
        fetchOrders();
        fetchPendingOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await api.get('/orders');
            setOrders(res.data.data || []);
        } catch (err) {
            console.error(err);
            showToast("Failed to fetch orders", "error");
        }
        setLoading(false);
    };

    const fetchPendingOrders = async () => {
        try {
            const res = await api.get('/payments/pending-orders');
            setPendingOrders(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch pending orders', err);
        }
    };

    const handleRetry = async (orderId) => {
        setRetrying(orderId);
        try {
            await api.post(`/payments/pending-orders/${orderId}/retry`);
            showToast('✅ Ticket created successfully! Buyer will receive confirmation email.', 'success');
            fetchPendingOrders();
            fetchOrders();
        } catch (err) {
            const msg = err.response?.data?.detail || 'Retry failed';
            showToast(`❌ Retry failed: ${msg}`, 'error');
        }
        setRetrying(null);
    };

    const toggleOrderArea = (orderId) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    const handleCheckIn = async (ticketId) => {
        try {
            await api.post('/check_ins', { ticket_id: ticketId });
            showToast(`Ticket ${ticketId} checked in successfully!`);
            fetchOrders();
        } catch (err) {
            const msg = err.response?.data?.detail || "Error checking in ticket";
            showToast(msg, "error");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Orders & Check-ins</h1>
                <button onClick={() => { fetchOrders(); fetchPendingOrders(); }} className="btn-secondary text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-0">
                <button
                    onClick={() => setActiveTab('confirmed')}
                    className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${activeTab === 'confirmed'
                        ? 'bg-brand-600 text-white'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    ✅ Confirmed Orders ({orders.length})
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 ${activeTab === 'pending'
                        ? 'bg-orange-600 text-white'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <AlertTriangle className="w-4 h-4" />
                    Pending TT Creation ({pendingOrders.length})
                    {pendingOrders.length > 0 && (
                        <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                            {pendingOrders.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── CONFIRMED ORDERS TAB ─────────────────────────────────────────── */}
            {activeTab === 'confirmed' && (
                <div className="glass-card overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400">
                            <tr>
                                <th className="p-4 w-10"></th>
                                <th className="p-4">Order ID</th>
                                <th className="p-4">Buyer Name</th>
                                <th className="p-4">Email</th>
                                <th className="p-4">Tickets</th>
                                <th className="p-4">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan="6" className="p-4 text-center text-gray-400 animate-pulse">Loading orders...</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">
                                    No confirmed orders yet. Tickets appear here after Ticket Tailor billing is set up.
                                </td></tr>
                            ) : orders.map(o => (
                                <React.Fragment key={o.id}>
                                    <tr className="hover:bg-white/5 cursor-pointer transition-colors" onClick={() => toggleOrderArea(o.id)}>
                                        <td className="p-4">
                                            {expandedOrders.has(o.id) ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                        </td>
                                        <td className="p-4 font-mono text-sm text-gray-400">{o.id}</td>
                                        <td className="p-4 font-medium">{o.buyer_name || 'Guest'}</td>
                                        <td className="p-4">{o.buyer_email || 'N/A'}</td>
                                        <td className="p-4 text-brand-300 font-bold">{o.issued_tickets?.length || 0}</td>
                                        <td className="p-4 font-medium text-green-400">${(o.total / 100).toFixed(2)}</td>
                                    </tr>
                                    {expandedOrders.has(o.id) && (
                                        <tr className="bg-black/20">
                                            <td colSpan="6" className="p-0">
                                                <div className="p-6 border-l-2 border-brand-500 ml-4 space-y-3">
                                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Issued Tickets</h4>
                                                    {!o.issued_tickets || o.issued_tickets.length === 0 ? (
                                                        <p className="text-sm text-gray-500">No tickets found in this order.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {o.issued_tickets.map(ticket => {
                                                                const isCheckedIn = ticket.checked_in === "true";
                                                                const isVoided = ticket.status === "voided";
                                                                return (
                                                                    <div key={ticket.id} className="bg-dark-800 border border-white/5 rounded-lg p-4 flex flex-col justify-between">
                                                                        <div>
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <span className="font-mono text-xs text-brand-300 bg-brand-500/10 px-2 py-1 rounded">{ticket.barcode}</span>
                                                                                {isVoided ? (
                                                                                    <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded flex items-center gap-1"><XCircle className="w-3 h-3" /> Voided</span>
                                                                                ) : isCheckedIn ? (
                                                                                    <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Checked In</span>
                                                                                ) : (
                                                                                    <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">Pending</span>
                                                                                )}
                                                                            </div>
                                                                            <p className="font-medium text-white text-sm mb-1 line-clamp-2">{ticket.description}</p>
                                                                            <div className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                                                                                <User className="w-3 h-3" />
                                                                                {(ticket.full_name && ticket.full_name !== "****" ? ticket.full_name : null) || (o.buyer_name && o.buyer_name !== "****" ? o.buyer_name : null) || "Guest"}
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-4 pt-4 border-t border-white/5">
                                                                            {!isCheckedIn && !isVoided ? (
                                                                                <button onClick={(e) => { e.stopPropagation(); handleCheckIn(ticket.id); }} className="w-full flex items-center justify-center gap-2 text-xs btn-primary py-2">
                                                                                    <CheckCircle className="w-4 h-4" /> Check In Attendee
                                                                                </button>
                                                                            ) : (
                                                                                <button disabled className="w-full text-xs bg-dark-600 text-gray-500 rounded-lg py-2 cursor-not-allowed">
                                                                                    {isVoided ? "Ticket Voided" : "Already Checked In"}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── PENDING ORDERS TAB ───────────────────────────────────────────── */}
            {activeTab === 'pending' && (
                <div className="space-y-4">
                    {/* Info banner */}
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-orange-300 font-semibold text-sm">Stripe payment received — ticket creation pending</p>
                            <p className="text-orange-400/70 text-xs mt-1">
                                These orders were paid via Stripe but Ticket Tailor couldn't issue the ticket
                                (billing not configured). Once you set up TT billing, click <strong>Retry</strong> to create the tickets and send confirmation emails.
                            </p>
                        </div>
                    </div>

                    {pendingOrders.length === 0 ? (
                        <div className="glass-card p-10 text-center text-gray-500">
                            🎉 No pending orders — all tickets are successfully issued!
                        </div>
                    ) : (
                        <div className="glass-card overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-gray-400 text-sm">
                                    <tr>
                                        <th className="p-4">Buyer</th>
                                        <th className="p-4">Email</th>
                                        <th className="p-4">Amount Paid</th>
                                        <th className="p-4">Stripe Session</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {pendingOrders.map(order => (
                                        <tr key={order.id} className="hover:bg-white/5">
                                            <td className="p-4 font-medium text-white">{order.buyer_name}</td>
                                            <td className="p-4 text-gray-300">{order.buyer_email}</td>
                                            <td className="p-4 text-green-400 font-bold">
                                                ${order.amount_total ? (order.amount_total / 100).toFixed(2) : '—'}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-mono text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                                                    {order.stripe_session_id?.slice(0, 20)}...
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-400 text-sm">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(order.created_at).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleRetry(order.id)}
                                                    disabled={retrying === order.id}
                                                    className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all"
                                                >
                                                    {retrying === order.id ? (
                                                        <><RefreshCw className="w-3 h-3 animate-spin" /> Retrying...</>
                                                    ) : (
                                                        <><RefreshCw className="w-3 h-3" /> Retry</>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Toast */}
            {toast.show && (
                <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                    }`}>
                    {toast.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    <span className="font-medium text-sm">{toast.message}</span>
                </div>
            )}
        </div>
    );
};

export default Orders;
