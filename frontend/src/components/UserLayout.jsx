import React from 'react';
import { Outlet, Link } from 'react-router-dom';

const UserLayout = () => {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="glass-card m-4 px-6 py-4 flex items-center justify-between sticky top-4 z-50">
                <Link to="/events" className="text-2xl font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
                    Ticket Tailor API
                </Link>
                <nav className="hidden md:block">
                    <Link to="/events" className="text-gray-300 hover:text-white transition-colors mr-6">Events</Link>
                    <Link to="/admin/events" className="btn-secondary text-sm">Admin Login</Link>
                </nav>
            </header>

            <main className="flex-1 container mx-auto px-4 py-8">
                <Outlet />
            </main>

            <footer className="text-center py-6 text-gray-500 text-sm">
                &copy; 2026 Athiva Technology
            </footer>
        </div>
    );
};

export default UserLayout;
