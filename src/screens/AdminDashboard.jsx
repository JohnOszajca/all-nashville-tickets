import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Plus, Trash2, X, Copy, BarChart3, ChevronDown, ChevronUp, Code, Clipboard, Lock, LogOut } from 'lucide-react';

export default function AdminDashboard({ events, orders, db, appId, navigateTo, setPrintOrderId }) {
  // --- AUTH STATE ---
  const [user, setUser] = useState(auth.currentUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
        setUser(u);
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e) => {
      e.preventDefault();
      try {
          await signInWithEmailAndPassword(auth, email, password);
          setLoginError('');
      } catch (err) {
          setLoginError('Invalid email or password');
      }
  };

  // --- DASHBOARD STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [expandedStats, setExpandedStats] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); 
  const [eventFilter, setEventFilter] = useState('active'); 
  const [showEmbed, setShowEmbed] = useState(null); 
  
  const [formData, setFormData] = useState({
    name: '', location: '', address: '', start: '', end: '',
    tickets: [{ id: 1, name: 'General Admission', price: 20, qty: 100 }],
    upgrades: [],
    upgradesHeading: 'Enhance Your Experience',
    upgradesDescription: 'Customize your night with these exclusive add-ons.',
    taxRate: 0, 
    feeRate: 0,
    feeType: 'flat',
    termsText: 'By proceeding, you agree to the standard terms and conditions of All Nashville Roadshow. All sales are final. No refunds or exchanges.',
    protectionConfig: {
        enabled: true,
        title: 'Protect Your Order',
        description: "Life happens. Get a full refund if you can't attend due to illness, weather, or other qualifying reasons.",
        percentage: 10,
        sellingPoints: "Receive a 100% refund for:\n\n• Qualifying Illness or Injury\n• Severe Weather & Travel Advisories\n• Government Mandates or Lockdowns\n• Jury Duty or Military Service\n• Mechanical Breakdown",
        legalText: "TICKET PROTECTION TERMS & CONDITIONS\n\n1. COVERAGE: This protection plan provides a refund of the ticket price (excluding fees) if the ticket holder is unable to attend the event due to a covered reason.\n\n2. COVERED REASONS:\n- Serious illness or injury of the ticket holder (physician's note required).\n- Death of an immediate family member.\n- Severe weather conditions preventing travel to the venue (official government advisory required).\n- Government-mandated lockdowns or restrictions preventing attendance.\n- Mechanical breakdown of vehicle within 24 hours of event.\n- Jury duty or military conscription.\n\n3. EXCLUSIONS:\n- Change of plans or disinclination to travel.\n- Work conflicts (unless military).\n- Pre-existing medical conditions known at time of purchase.\n\n4. CLAIMS: Claims must be submitted within 7 days of the event date with appropriate documentation."
    },
    upsellConfig: {
        enabled: true,
        title: 'Wait! One Last Thing...',
        description: 'Grab a VIP Parking Pass for 50% off.',
        price: 15,
        retailPrice: 30,
        itemName: 'VIP Parking',
        image: 'https://placehold.co/400x300/orange/white?text=VIP+Parking',
        noThanksText: 'No thanks, I prefer to walk'
    }
  });

  // --- LOGIN SCREEN ---
  if (!user || user.isAnonymous) {
      return (
          <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg border border-slate-200">
              <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock className="text-amber-500" size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Admin Access</h2>
                  <p className="text-slate-500">Please log in to manage events.</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input type="email" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                      <input type="password" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  {loginError && <div className="text-red-500 text-sm text-center font-bold">{loginError}</div>}
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition">Log In</button>
              </form>
          </div>
      );
  }

  // --- DASHBOARD FUNCTIONS ---
  const handleSaveEvent = async () => {
    try {
      const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
      const payload = { ...formData, taxRate: Number(formData.taxRate), feeRate: Number(formData.feeRate) };
      if (formData.id) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', formData.id);
        await updateDoc(docRef, payload);
      } else {
        await addDoc(eventsRef, { ...payload, createdAt: serverTimestamp() });
      }
      setIsEditing(false);
    } catch (e) {
      alert("Error saving event: " + e.message);
    }
  };

  const handleCloneEvent = async (eventToClone) => {
    try {
      const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
      const newEvent = JSON.parse(JSON.stringify(eventToClone));
      delete newEvent.id; 
      newEvent.name = `${newEvent.name} (Copy)`;
      newEvent.createdAt = serverTimestamp();
      await addDoc(eventsRef, newEvent);
    } catch (e) {
      alert("Error cloning event: " + e.message);
    }
  };

  // --- THE SMART EMBED CODE GENERATOR ---
  const EmbedModal = ({ evtId, onClose }) => {
    const appUrl = window.location.origin; 
    const frameId = `ticket-frame-${evtId}`;
    
    // We create a single block of code that contains the iframe AND the script to manage it.
    const code = `
<iframe id="${frameId}" src="${appUrl}/?eventId=${evtId}&mode=embed" width="100%" scrolling="no" style="background: transparent; border: none; overflow: hidden;"></iframe>
<script>
  window.addEventListener('message', function(e) {
    // 1. Resize this specific iframe
    if (e.data && e.data.type === 'setHeight') {
      var frame = document.getElementById('${frameId}');
      if (frame) frame.style.height = e.data.height + 'px';
    }
    // 2. Scroll page to top
    if (e.data && e.data.type === 'scrollToTop') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
</script>
`.trim();
    
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        alert("Smart Embed Code copied!");
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center"><Code className="mr-2"/> Smart Embed Code</h3>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-2">Paste this code block into your website (HTML/Code Widget):</p>
                    <div className="bg-slate-100 p-3 rounded border border-slate-200 font-mono text-xs break-all mb-4 h-48 overflow-y-auto whitespace-pre-wrap">
                        {code}
                    </div>
                    <div className="flex justify-end">
                        <button onClick={handleCopy} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded font-bold flex items-center">
                            <Clipboard size={16} className="mr-2"/> Copy Code
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((acc, curr) => acc + (curr.financials?.total || 0), 0);
  const totalTicketsSold = orders.filter(o => o.status === 'paid').reduce((acc, curr) => acc + (curr.items?.reduce((sum, item) => sum + item.qty, 0) || 0), 0);

  const getEventStats = (eventId) => {
    const eventOrders = orders.filter(o => o.eventId === eventId && o.status === 'paid');
    const revenue = eventOrders.reduce((acc, curr) => acc + (curr.financials?.total || 0), 0);
    const ticketCount = eventOrders.reduce((acc, curr) => acc + (curr.items?.filter(i=>i.type==='ticket').reduce((sum, item) => sum + item.qty, 0) || 0), 0);
    // (Other stats calculated similarly if needed for expanded view)
    return { revenue, ticketCount };
  };

  const filteredEvents = events.filter(evt => {
    const endDate = evt.end ? new Date(evt.end) : new Date(evt.start);
    return eventFilter === 'active' ? endDate >= new Date() : endDate < new Date();
  });

  if (isEditing) {
    // (Simplified form render for brevity - standard implementation)
    return (
      <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Create/Edit Event</h2>
          <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-slate-800"><X /></button>
        </div>
        {/* Tab Navigation */}
        <div className="flex border-b mb-6 overflow-x-auto">
            {['details', 'tickets', 'upgrades', 'protection', 'one-click', 'settings'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 font-medium capitalize whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-amber-500 text-amber-600' : 'text-slate-500'}`}>{tab.replace('-', ' ')}</button>
            ))}
        </div>
        {/* Basic Fields (Full form implementation would be here) */}
        <div className="p-4 text-center text-slate-500 border rounded bg-slate-50 mb-6">
            (Full form editing active for {formData.name})
        </div>
        <div className="flex justify-end pt-6 border-t">
            <button onClick={handleSaveEvent} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded font-bold shadow">Save Event</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showEmbed && <EmbedModal evtId={showEmbed} onClose={() => setShowEmbed(null)} />}

      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <button onClick={() => auth.signOut()} className="text-sm text-red-500 flex items-center hover:underline"><LogOut size={16} className="mr-1"/> Sign Out</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-slate-500 text-sm font-bold uppercase">Total Revenue</div>
          <div className="text-3xl font-bold text-slate-900">${totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-slate-500 text-sm font-bold uppercase">Total Tickets Sold</div>
          <div className="text-3xl font-bold text-slate-900">{totalTicketsSold}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-amber-500 flex items-center justify-between cursor-pointer hover:bg-amber-50" onClick={() => {
          setFormData({
            name: '', location: '', address: '', start: '', end: '',
            tickets: [{ id: Date.now(), name: 'General Admission', price: 25, qty: 100 }],
            upgrades: [], taxRate: 0, feeRate: 0, feeType: 'flat',
            upgradesHeading: 'Enhance Your Experience', upgradesDescription: 'Customize your night with these exclusive add-ons.',
            termsText: 'By proceeding, you agree to the standard terms and conditions.',
            protectionConfig: { enabled: true, title: 'Protect Your Order', percentage: 10, sellingPoints: '', legalText: '' },
            upsellConfig: { enabled: true, title: 'Wait!', price: 15, retailPrice: 30, itemName: 'VIP Parking' }
          });
          setIsEditing(true);
          setActiveTab('details');
        }}>
          <div>
            <div className="text-amber-600 text-sm font-bold uppercase">Actions</div>
            <div className="text-lg font-bold text-slate-900">Create New Event</div>
          </div>
          <Plus className="text-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-700">{eventFilter === 'active' ? 'Active' : 'Past'} Events</h3>
          <div className="flex bg-slate-100 rounded-lg p-1">
             <button className={`px-3 py-1 text-xs font-bold rounded-md ${eventFilter === 'active' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`} onClick={() => setEventFilter('active')}>Active</button>
             <button className={`px-3 py-1 text-xs font-bold rounded-md ${eventFilter === 'past' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`} onClick={() => setEventFilter('past')}>Past</button>
          </div>
        </div>
        {filteredEvents.map(evt => {
             const stats = getEventStats(evt.id);
             return (
               <div key={evt.id} className="p-6 border-b hover:bg-slate-50 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg text-slate-800">{evt.name}</div>
                    <div className="text-sm text-slate-500">{new Date(evt.start).toLocaleDateString()} • {stats.ticketCount} Sold • ${stats.revenue.toFixed(2)}</div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => setShowEmbed(evt.id)} className="text-slate-400 hover:text-amber-600 flex items-center font-bold px-2" title="Get Embed Code"><Code size={20} /></button>
                     <button onClick={() => { setFormData(evt); setIsEditing(true); }} className="text-blue-600 font-bold text-sm">Edit</button>
                  </div>
               </div>
             )
        })}
      </div>
    </div>
  );
}