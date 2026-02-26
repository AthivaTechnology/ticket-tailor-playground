import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Ticket, Tag, ShoppingCart, ScanLine } from 'lucide-react';

const AdminLayout = () => {
    const location = useLocation();

    const navItems = [
        { name: 'Event Series', path: '/admin/event-series', icon: <LayoutDashboard className="w-5 h-5" /> },
        { name: 'Events', path: '/admin/events', icon: <Calendar className="w-5 h-5" /> },
        { name: 'Ticket Types', path: '/admin/tickets', icon: <Ticket className="w-5 h-5" /> },
        { name: 'Discounts', path: '/admin/discounts', icon: <Tag className="w-5 h-5" /> },
        { name: 'Orders', path: '/admin/orders', icon: <ShoppingCart className="w-5 h-5" /> },
        { name: 'Door Scanner', path: '/admin/scanner', icon: <ScanLine className="w-5 h-5" /> },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-dark-900">
            {/* Sidebar — fixed, never scrolls */}
            <aside className="w-64 flex-shrink-0 h-screen sticky top-0 glass-card m-4 mr-0 p-6 flex flex-col overflow-hidden">
                <h2 className="text-2xl font-bold text-white mb-8 bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent flex-shrink-0">
                    Admin Side  
                </h2>
                <nav className="flex-1 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${location.pathname.startsWith(item.path)
                                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            {item.icon}
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Main Content — independently scrollable */}
            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
