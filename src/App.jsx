import React, { useState, useEffect, useRef } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { Ticket, Settings, QrCode, ShoppingBag } from 'lucide-react';

import { auth, db, appId } from './services/firebase';
import AdminDashboard from './screens/AdminDashboard';
import CheckoutFlow from './screens/CheckoutFlow';
import ScannerApp from './screens/ScannerApp';
import SuccessReceipt from './components/SuccessReceipt';

// --- SKELETON LOADER ---
function SkeletonCheckout() {
  return (
    <div className="max-w-xl mx-auto px-4 pt-6 animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-3/4 mb-4"></div>
      <div className="flex space-x-4 mb-8">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
      </div>
      <div className="space-y-4 mb-8">
        <div className="h-24 bg-slate-100 border border-slate-200 rounded-lg"></div>
        <div className="h-24 bg-slate-100 border border-slate-200 rounded-lg"></div>
        <div className="h-24 bg-slate-100 border border-slate-200 rounded-lg"></div>
      </div>
      <div className="h-32 bg-slate-100 border border-slate-200 rounded-lg mb-8"></div>
      <div className="h-16 bg-amber-100 rounded-xl w-full"></div>
    </div>
  );
}

function LandingPage({ navigateTo }) {
  return (
    <div className="py-12 text-center space-y-8 animate-fade-in">
      <h1 className="text-4xl font-extrabold text-slate-900">System Overview</h1>
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div onClick={() => navigateTo('checkout')} className="bg-white p-6 rounded-xl shadow cursor-pointer hover:shadow-md border border-slate-200">
          <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto"><ShoppingBag className="text-amber-600" /></div>
          <h3 className="font-bold">Checkout</h3>
        </div>
        <div onClick={() => navigateTo('admin')} className="bg-white p-6 rounded-xl shadow cursor-pointer hover:shadow-md border border-slate-200">
          <div className="bg-indigo-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto"><Settings className="text-indigo-600" /></div>
          <h3 className="font-bold">Admin</h3>
        </div>
        <div onClick={() => navigateTo('scanner')} className="bg-white p-6 rounded-xl shadow cursor-pointer hover:shadow-md border border-slate-200">
          <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto"><QrCode className="text-emerald-600" /></div>
          <h3 className="font-bold">Scanner</h3>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');
  const [activeEventId, setActiveEventId] = useState(null);
  const [printOrderId, setPrintOrderId] = useState(null);
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const appRef = useRef(null);
  
  // Check for Embed Mode
  const params = new URLSearchParams(window.location.search);
  const isEmbed = params.get('mode') === 'embed';

  // --- AUTO-RESIZER & TRANSPARENCY ---
  useEffect(() => {
    if (isEmbed) {
        // Force transparent background
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';

        // Resize Observer to broadcast height changes to parent
        const resizeObserver = new ResizeObserver(() => {
            // We use document.body.scrollHeight for a more accurate "Total Content Height"
            // This prevents the loop because it measures content, not container
            const height = document.body.scrollHeight;
            window.parent.postMessage({ type: 'setHeight', height: height }, '*');
        });

        if (document.body) {
            resizeObserver.observe(document.body);
        }

        return () => resizeObserver.disconnect();
    } else {
        document.body.style.backgroundColor = '';
        document.documentElement.style.backgroundColor = '';
    }
  }, [isEmbed, view, loading, events]); 

  // Auth & Data
  useEffect(() => {
    signInAnonymously(auth);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const params = new URLSearchParams(window.location.search);
    const urlEventId = params.get('eventId');
    if (urlEventId) {
        setActiveEventId(urlEventId);
        setView('checkout');
    }

    const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubEvents = onSnapshot(eventsRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setEvents(data);
      
      if (data.length > 0 && !activeEventId && !urlEventId) {
          setActiveEventId(data[0].id);
      }
      setLoading(false);
    });

    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const unsubOrders = onSnapshot(ordersRef, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubEvents(); unsubOrders(); };
  }, [user]); 

  const navigateTo = (newView) => { window.scrollTo(0, 0); setView(newView); };

  if (loading) {
      if (isEmbed || view === 'checkout') return <div ref={appRef}><SkeletonCheckout /></div>;
      return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (view === 'print_view' && printOrderId) {
     const orderToPrint = orders.find(o => o.id === printOrderId);
     const eventForPrint = events.find(e => e.id === orderToPrint?.eventId);
     return <div ref={appRef}><SuccessReceipt order={orderToPrint} event={eventForPrint} /></div>;
  }

  return (
    // FIX: Use min-h-0 if embedded to prevent infinite growth loop
    <div ref={appRef} className={`font-sans text-slate-900 ${isEmbed ? 'bg-transparent min-h-0' : 'bg-slate-50 min-h-screen'}`}>
      {!isEmbed && (
          <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 no-print shadow-lg">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
              <div className="flex items-center space-x-2 font-bold text-xl cursor-pointer" onClick={() => navigateTo('landing')}>
                <Ticket className="text-amber-500" />
                <span>ALL NASHVILLE <span className="text-amber-500">ROADSHOW</span></span>
              </div>
              <div className="flex space-x-4 text-sm font-medium">
                <button onClick={() => navigateTo('admin')} className={view === 'admin' ? 'text-amber-500' : 'hover:text-amber-400'}>Admin</button>
                <button onClick={() => navigateTo('checkout')} className={view === 'checkout' ? 'text-amber-500' : 'hover:text-amber-400'}>Tickets</button>
                <button onClick={() => navigateTo('scanner')} className={view === 'scanner' ? 'text-amber-500' : 'hover:text-amber-400'}>Scanner</button>
              </div>
            </div>
          </nav>
      )}

      <main className={isEmbed ? "w-full bg-transparent" : "max-w-6xl mx-auto p-4"}>
        {view === 'landing' && <LandingPage navigateTo={navigateTo} />}
        {view === 'admin' && <AdminDashboard events={events} orders={orders} db={db} appId={appId} navigateTo={navigateTo} setPrintOrderId={setPrintOrderId} />}
        {view === 'checkout' && <CheckoutFlow events={events} db={db} appId={appId} activeEventId={activeEventId} />}
        {view === 'scanner' && <ScannerApp events={events} orders={orders} db={db} appId={appId} />}
      </main>
    </div>
  );
}