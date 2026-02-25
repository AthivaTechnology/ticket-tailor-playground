import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AdminLayout from './components/AdminLayout';
import UserLayout from './components/UserLayout';

// Admin Pages
import AdminEventSeries from './pages/admin/EventSeries';
import AdminEvents from './pages/admin/Events';
import AdminTicketTypes from './pages/admin/TicketTypes';
import AdminDiscounts from './pages/admin/Discounts';
import AdminOrders from './pages/admin/Orders';
import AdminSeriesDetail from './pages/admin/AdminSeriesDetail';
import AdminEventDetail from './pages/admin/AdminEventDetail';
import CheckInScanner from './pages/admin/CheckInScanner';

import UserEvents from './pages/user/EventsList';
import UserEventDetail from './pages/user/EventDetail';
import EventCheckout from './pages/user/EventCheckout';
import PaymentSuccess from './pages/user/PaymentSuccess';
import PaymentCancel from './pages/user/PaymentCancel';
import FreeConfirmPage from './pages/user/FreeConfirmPage';
import FrontendFlowChart from './pages/FrontendFlowChart';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone — no layout wrapper */}
        <Route path="/frontend-flow" element={<FrontendFlowChart />} />
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/event-series" replace />} />
          <Route path="event-series" element={<AdminEventSeries />} />
          <Route path="event-series/:id" element={<AdminSeriesDetail />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/:id" element={<AdminEventDetail />} />
          <Route path="tickets" element={<AdminTicketTypes />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="scanner" element={<CheckInScanner />} />
        </Route>

        {/* User Routes */}
        <Route path="/" element={<UserLayout />}>
          <Route index element={<Navigate to="/events" replace />} />
          {/* Redirect old /series paths to /events */}
          <Route path="series" element={<Navigate to="/events" replace />} />
          <Route path="series/:id" element={<Navigate to="/events" replace />} />
          {/* Main event routes */}
          <Route path="events" element={<UserEvents />} />
          <Route path="events/:id" element={<UserEventDetail />} />
          <Route path="checkout/:id" element={<EventCheckout />} />
          <Route path="payment/success" element={<PaymentSuccess />} />
          <Route path="payment/cancel" element={<PaymentCancel />} />
          <Route path="payment/free-confirm" element={<FreeConfirmPage />} />
          <Route path="*" element={<Navigate to="/events" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};


export default App;
