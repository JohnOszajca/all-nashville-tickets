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

  // Listen for auth changes
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

  // --- 1. LOGIN SCREEN (THE GATEKEEPER) ---
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
                      <input 
                        type="email" 
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                      <input 
                        type="password" 
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                  </div>
                  
                  {loginError && <div className="text-red-500 text-sm text-center font-bold">{loginError}</div>}
                  
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition">
                      Log In
                  </button>
              </form>
          </div>
      );
  }

  // --- 2. REAL DASHBOARD LOGIC ---

  const handleSaveEvent = async () => {
    try {
      const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
      const payload = {
        ...formData,
        taxRate: Number(formData.taxRate),
        feeRate: Number(formData.feeRate)
      };

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

  // --- UPDATED EMBED MODAL ---
  const EmbedModal = ({ evtId, onClose }) => {
    // Uses the ACTUAL current website URL to generate the link
    const appUrl = window.location.origin; 
    const code = `<iframe src="${appUrl}/?eventId=${evtId}&mode=embed" width="100%" height="800" frameborder="0"></iframe>`;
    
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        alert("Code copied!");
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center"><Code className="mr-2"/> Embed Code</h3>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-2">Copy and paste this code into your website:</p>
                    <div className="bg-slate-100 p-3 rounded border border-slate-200 font-mono text-xs break-all mb-4 h-32 overflow-y-auto">
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

  const totalRevenue = orders
    .filter(o => o.status === 'paid')
    .reduce((acc, curr) => acc + (curr.financials?.total || 0), 0);

  const totalTicketsSold = orders
    .filter(o => o.status === 'paid')
    .reduce((acc, curr) => acc + (curr.items?.reduce((sum, item) => sum + item.qty, 0) || 0), 0);

  const getEventStats = (eventId) => {
    const eventOrders = orders.filter(o => o.eventId === eventId && o.status === 'paid');
    const revenue = eventOrders.reduce((acc, curr) => acc + (curr.financials?.total || 0), 0);
    const ticketsRev = eventOrders.reduce((acc, curr) => acc + (curr.financials?.ticketTotal || 0), 0);
    const upgradesRev = eventOrders.reduce((acc, curr) => acc + (curr.financials?.upgradeTotal || 0), 0);
    const feesRev = eventOrders.reduce((acc, curr) => acc + (curr.financials?.feeTotal || 0), 0);
    const taxRev = eventOrders.reduce((acc, curr) => acc + (curr.financials?.tax || 0), 0);
    const ticketCount = eventOrders.reduce((acc, curr) => acc + (curr.items?.filter(i=>i.type==='ticket').reduce((sum, item) => sum + item.qty, 0) || 0), 0);
    
    return { revenue, ticketsRev, upgradesRev, feesRev, taxRev, ticketCount };
  };

  const now = new Date();
  const filteredEvents = events.filter(evt => {
    const endDate = evt.end ? new Date(evt.end) : new Date(evt.start);
    if (eventFilter === 'active') return endDate >= now;
    if (eventFilter === 'past') return endDate < now;
    return true;
  });

  if (isEditing) {
    return (
      <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Create/Edit Event</h2>
          <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-slate-800"><X /></button>
        </div>

        <div className="flex border-b mb-6 overflow-x-auto">
            {['details', 'tickets', 'upgrades', 'protection', 'one-click', 'settings'].map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 font-medium capitalize whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-amber-500 text-amber-600' : 'text-slate-500'}`}
                >
                    {tab.replace('-', ' ')}
                </button>
            ))}
        </div>
        
        <div className="space-y-6 min-h-[400px]">
           {/* --- TAB: DETAILS --- */}
           {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Name</label>
                  <input type="text" className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., All Nashville Roadshow: Summer" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location Name</label>
                  <input type="text" className="w-full p-2 border rounded" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g., The Ryman" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Address</label>
                  <input type="text" className="w-full p-2 border rounded" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                  <input type="datetime-local" className="w-full p-2 border rounded" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                  <input type="datetime-local" className="w-full p-2 border rounded" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
                </div>
              </div>
           )}

           {/* --- TAB: TICKETS --- */}
           {activeTab === 'tickets' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Ticket Zones</h3>
                  <button onClick={() => setFormData({...formData, tickets: [...formData.tickets, { id: Date.now(), name: '', price: 0, qty: 0 }]})} className="text-sm text-amber-600 font-medium flex items-center"><Plus size={16} className="mr-1"/> Add Zone</button>
                </div>
                {formData.tickets.map((t, idx) => (
                  <div key={t.id} className="flex gap-2 mb-2 items-end bg-slate-50 p-2 rounded">
                    <div className="flex-grow">
                      <label className="text-xs text-slate-500">Zone Name</label>
                      <input type="text" className="w-full p-2 border rounded text-sm" value={t.name} onChange={e => {
                        const newTickets = [...formData.tickets];
                        newTickets[idx].name = e.target.value;
                        setFormData({...formData, tickets: newTickets});
                      }} placeholder="Zone Name" />
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-slate-500">Price ($)</label>
                      <input type="number" className="w-full p-2 border rounded text-sm" value={t.price} onChange={e => {
                        const newTickets = [...formData.tickets];
                        newTickets[idx].price = Number(e.target.value);
                        setFormData({...formData, tickets: newTickets});
                      }} />
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-slate-500">Qty</label>
                      <input type="number" className="w-full p-2 border rounded text-sm" value={t.qty} onChange={e => {
                        const newTickets = [...formData.tickets];
                        newTickets[idx].qty = Number(e.target.value);
                        setFormData({...formData, tickets: newTickets});
                      }} />
                    </div>
                    <button onClick={() => {
                      const newTickets = formData.tickets.filter((_, i) => i !== idx);
                      setFormData({...formData, tickets: newTickets});
                    }} className="p-2 text-red-500 hover:bg-red-100 rounded"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
           )}

           {/* --- TAB: UPGRADES --- */}
           {activeTab === 'upgrades' && (
              <div>
                <div className="mb-6 bg-slate-50 p-4 rounded border">
                   <h4 className="text-sm font-bold text-slate-700 mb-2">Section Settings (Checkout Step 2)</h4>
                   <div className="grid gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Section Heading</label>
                        <input type="text" className="w-full p-2 border rounded text-sm" value={formData.upgradesHeading || 'Enhance Your Experience'} onChange={e => setFormData({...formData, upgradesHeading: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Section Description</label>
                        <input type="text" className="w-full p-2 border rounded text-sm" value={formData.upgradesDescription || 'Customize your night with these exclusive add-ons.'} onChange={e => setFormData({...formData, upgradesDescription: e.target.value})} />
                      </div>
                   </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Products</h3>
                  <button onClick={() => setFormData({...formData, upgrades: [...formData.upgrades, { id: Date.now(), name: '', description: '', price: 0, qty: 0, image: '' }]})} className="text-sm text-amber-600 font-medium flex items-center"><Plus size={16} className="mr-1"/> Add Item</button>
                </div>
                {formData.upgrades.map((u, idx) => (
                  <div key={u.id} className="flex gap-2 mb-4 items-start bg-slate-50 p-3 rounded border">
                    <div className="w-16 h-16 bg-slate-200 rounded flex-shrink-0 mt-5 overflow-hidden">
                      {u.image && <img src={u.image} alt="preview" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-grow grid grid-cols-1 gap-2">
                       <div className="flex gap-2">
                          <div className="flex-grow">
                              <label className="text-xs text-slate-500">Item Name</label>
                              <input type="text" className="w-full p-2 border rounded text-sm" value={u.name} onChange={e => {
                                const newUpgrades = [...formData.upgrades];
                                newUpgrades[idx].name = e.target.value;
                                setFormData({...formData, upgrades: newUpgrades});
                              }} placeholder="Item Name" />
                          </div>
                          <div className="w-24">
                              <label className="text-xs text-slate-500">Price ($)</label>
                              <input type="number" className="w-full p-2 border rounded text-sm" value={u.price} onChange={e => {
                                const newUpgrades = [...formData.upgrades];
                                newUpgrades[idx].price = Number(e.target.value);
                                setFormData({...formData, upgrades: newUpgrades});
                              }} />
                          </div>
                          <div className="w-24">
                              <label className="text-xs text-slate-500">Stock</label>
                              <input type="number" className="w-full p-2 border rounded text-sm" value={u.qty} onChange={e => {
                                const newUpgrades = [...formData.upgrades];
                                newUpgrades[idx].qty = Number(e.target.value);
                                setFormData({...formData, upgrades: newUpgrades});
                              }} />
                          </div>
                          <button onClick={() => {
                            const newUpgrades = formData.upgrades.filter((_, i) => i !== idx);
                            setFormData({...formData, upgrades: newUpgrades});
                          }} className="p-2 text-red-500 hover:bg-red-100 rounded mt-4"><Trash2 size={16} /></button>
                       </div>
                       <div className="flex gap-2">
                           <div className="flex-grow">
                              <label className="text-xs text-slate-500">Description</label>
                              <input type="text" className="w-full p-2 border rounded text-sm" value={u.description || ''} onChange={e => {
                                const newUpgrades = [...formData.upgrades];
                                newUpgrades[idx].description = e.target.value;
                                setFormData({...formData, upgrades: newUpgrades});
                              }} placeholder="Brief description for customers" />
                           </div>
                           <div className="flex-grow">
                              <label className="text-xs text-slate-500">Image URL</label>
                              <input type="text" className="w-full p-2 border rounded text-sm" value={u.image || ''} onChange={e => {
                                const newUpgrades = [...formData.upgrades];
                                newUpgrades[idx].image = e.target.value;
                                setFormData({...formData, upgrades: newUpgrades});
                              }} placeholder="https://..." />
                           </div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
           )}

           {/* --- TAB: PROTECTION --- */}
           {activeTab === 'protection' && (
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Ticket Protection Offer (Step 4)</h3>
                    <label className="flex items-center text-sm cursor-pointer">
                       <input type="checkbox" className="mr-2" checked={formData.protectionConfig?.enabled} onChange={e => setFormData({...formData, protectionConfig: {...formData.protectionConfig, enabled: e.target.checked}})} /> Enable
                    </label>
                 </div>
                 <div className={`space-y-4 p-4 border rounded bg-slate-50 ${!formData.protectionConfig?.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-500 mb-1">Offer Title</label>
                            <input type="text" className="w-full p-2 border rounded" value={formData.protectionConfig?.title || ''} onChange={e => setFormData({...formData, protectionConfig: {...formData.protectionConfig, title: e.target.value}})} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Cost (% of Subtotal)</label>
                            <input type="number" className="w-full p-2 border rounded" value={formData.protectionConfig?.percentage || 10} onChange={e => setFormData({...formData, protectionConfig: {...formData.protectionConfig, percentage: parseFloat(e.target.value)}})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Short Description</label>
                        <input type="text" className="w-full p-2 border rounded" value={formData.protectionConfig?.description || ''} onChange={e => setFormData({...formData, protectionConfig: {...formData.protectionConfig, description: e.target.value}})} />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Selling Points (Displayed on Card)</label>
                        <textarea className="w-full p-2 border rounded text-sm h-32" value={formData.protectionConfig?.sellingPoints || ''} onChange={e => setFormData({...formData, protectionConfig: {...formData.protectionConfig, sellingPoints: e.target.value}})} />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Legal Terms (Popup Content)</label>
                        <textarea className="w-full p-2 border rounded text-sm h-40" value={formData.protectionConfig?.legalText || ''} onChange={e => setFormData({...formData, protectionConfig: {...formData.protectionConfig, legalText: e.target.value}})} />
                    </div>
                 </div>
              </div>
           )}

           {/* --- TAB: ONE CLICK UPSELL --- */}
           {activeTab === 'one-click' && (
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Post-Purchase Upsell (Step 5)</h3>
                    <label className="flex items-center text-sm cursor-pointer">
                       <input type="checkbox" className="mr-2" checked={formData.upsellConfig?.enabled} onChange={e => setFormData({...formData, upsellConfig: {...formData.upsellConfig, enabled: e.target.checked}})} /> Enable
                    </label>
                 </div>
                 <div className={`space-y-4 p-4 border rounded bg-slate-50 ${!formData.upsellConfig?.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Main Heading</label>
                        <input type="text" className="w-full p-2 border rounded" value={formData.upsellConfig?.title || ''} onChange={e => setFormData({...formData, upsellConfig: {...formData.upsellConfig, title: e.target.value}})} />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Description / Sales Text</label>
                        <textarea className="w-full p-2 border rounded" rows={2} value={formData.upsellConfig?.description || ''} onChange={e => setFormData({...formData, upsellConfig: {...formData.upsellConfig, description: e.target.value}})} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Item Name</label>
                            <input type="text" className="w-full p-2 border rounded" value={formData.upsellConfig?.itemName || ''} onChange={e => setFormData({...formData, upsellConfig: {...formData.upsellConfig, itemName: e.target.value}})} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Offer Price ($)</label>
                            <input type="number" className="w-full p-2 border rounded" value={formData.upsellConfig?.price || 0} onChange={e => setFormData({...formData, upsellConfig: {...formData.upsellConfig, price: parseFloat(e.target.value)}})} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Original Retail Price ($)</label>
                            <input type="number" className="w-full p-2 border rounded" value={formData.upsellConfig?.retailPrice || 0} onChange={e => setFormData({...formData, upsellConfig: {...formData.upsellConfig, retailPrice: parseFloat(e.target.value)}})} />
                            <p className="text-[10px] text-slate-400">Leave 0 to hide strikethrough</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Image URL</label>
                        <input type="text" className="w-full p-2 border rounded" value={formData.upsellConfig?.image || ''} onChange={e => setFormData({...formData, upsellConfig: {...formData.upsellConfig, image: e.target.value}})} />
                         <p className="text-[10px] text-slate-400">Leave blank to hide image</p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">"No Thanks" Text</label>
                        <input type="text" className="w-full p-2 border rounded" value={formData.upsellConfig?.noThanksText || ''} onChange={e => setFormData({...formData, upsellConfig: {...formData.upsellConfig, noThanksText: e.target.value}})} />
                    </div>
                 </div>
              </div>
           )}

           {/* --- TAB: SETTINGS --- */}
           {activeTab === 'settings' && (
              <div className="space-y-4">
                  <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Sales Tax Rate (%)</label>
                   <input type="number" className="w-full p-2 border rounded" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: e.target.value})} placeholder="Leave 0 to hide" />
                   <p className="text-xs text-slate-400 mt-1">Percentage. Leave 0 to hide line item.</p>
                 </div>
                 <div className="pt-4 border-t">
                   <label className="block text-sm font-medium text-slate-700 mb-2">Processing Fees</label>
                   <div className="flex gap-4 mb-2">
                       <label className="flex items-center cursor-pointer">
                           <input type="radio" name="feeType" value="flat" checked={formData.feeType !== 'percent'} onChange={() => setFormData({...formData, feeType: 'flat'})} className="mr-2" />
                           Flat Fee ($)
                       </label>
                       <label className="flex items-center cursor-pointer">
                           <input type="radio" name="feeType" value="percent" checked={formData.feeType === 'percent'} onChange={() => setFormData({...formData, feeType: 'percent'})} className="mr-2" />
                           Percentage (%)
                       </label>
                   </div>
                   <input type="number" className="w-full p-2 border rounded" value={formData.feeRate} onChange={e => setFormData({...formData, feeRate: e.target.value})} placeholder="0" />
                   <p className="text-xs text-slate-400 mt-1">{formData.feeType === 'percent' ? 'Percent of subtotal (e.g. 3.5 for 3.5%)' : 'Fixed amount added per ticket (e.g. 2.00)'}</p>
                 </div>
                 <div className="pt-4 border-t">
                     <label className="block text-sm font-medium text-slate-700 mb-2">Terms & Conditions Text</label>
                     <textarea 
                         className="w-full p-2 border rounded text-sm h-32" 
                         value={formData.termsText || ''} 
                         onChange={e => setFormData({...formData, termsText: e.target.value})} 
                         placeholder="Enter legal text here..." 
                     />
                 </div>
              </div>
           )}
        </div>

        <div className="flex justify-end pt-6 border-t mt-6">
            <button onClick={handleSaveEvent} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded font-bold shadow">Save Event</button>
        </div>
      </div>
    );
  }

  // Regular Dashboard View
  return (
    <div className="space-y-6">
      {showEmbed && <EmbedModal evtId={showEmbed} onClose={() => setShowEmbed(null)} />}

      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <button onClick={() => auth.signOut()} className="text-sm text-red-500 flex items-center hover:underline">
              <LogOut size={16} className="mr-1"/> Sign Out
          </button>
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
            termsText: 'By proceeding, you agree to the standard terms and conditions of All Nashville Roadshow. All sales are final. No refunds or exchanges.',
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
             <button 
               className={`px-3 py-1 text-xs font-bold rounded-md ${eventFilter === 'active' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
               onClick={() => setEventFilter('active')}
             >Active</button>
             <button 
               className={`px-3 py-1 text-xs font-bold rounded-md ${eventFilter === 'past' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
               onClick={() => setEventFilter('past')}
             >Past</button>
          </div>
        </div>
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No {eventFilter} events found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEvents.map(evt => {
              const stats = getEventStats(evt.id);
              const isExpanded = expandedStats === evt.id;
              
              return (
                <div key={evt.id} className="bg-white">
                   <div className="p-6 hover:bg-slate-50 flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-grow">
                        <div className="font-bold text-lg text-slate-800">{evt.name}</div>
                        <div className="text-sm text-slate-500 flex gap-4">
                          <span>{new Date(evt.start).toLocaleDateString()}</span>
                          <span>{stats.ticketCount} Tickets Sold</span>
                          <span className="text-green-600 font-bold">${stats.revenue.toFixed(2)} Rev</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                         {/* Embed Button */}
                         <button onClick={() => setShowEmbed(evt.id)} className="text-slate-400 hover:text-amber-600 flex items-center font-bold px-2" title="Get Embed Code">
                           <Code size={20} />
                         </button>

                        <button onClick={() => setExpandedStats(isExpanded ? null : evt.id)} className={`text-sm font-bold flex items-center px-3 py-2 rounded ${isExpanded ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                          <BarChart3 size={14} className="mr-2"/> Stats {isExpanded ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>}
                        </button>
                        <button onClick={() => { setFormData(evt); setIsEditing(true); setActiveTab('details'); }} className="text-sm text-blue-600 hover:underline font-medium px-2">Edit</button>
                        <button onClick={() => handleCloneEvent(evt)} className="text-sm text-slate-500 hover:text-amber-600 flex items-center font-bold px-2">
                          <Copy size={14} className="mr-1"/> Clone
                        </button>
                      </div>
                   </div>
                   
                   {/* Expanded Stats Panel */}
                   {isExpanded && (
                     <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-4 animate-fade-in">
                        <div className="text-center p-3 bg-white rounded shadow-sm">
                           <div className="text-xs text-slate-500 uppercase tracking-wider">Ticket Sales</div>
                           <div className="font-bold text-lg">${stats.ticketsRev.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded shadow-sm">
                           <div className="text-xs text-slate-500 uppercase tracking-wider">Upgrades</div>
                           <div className="font-bold text-lg">${stats.upgradesRev.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded shadow-sm">
                           <div className="text-xs text-slate-500 uppercase tracking-wider">Fees Collected</div>
                           <div className="font-bold text-lg text-slate-600">${stats.feesRev.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded shadow-sm">
                           <div className="text-xs text-slate-500 uppercase tracking-wider">Tax Collected</div>
                           <div className="font-bold text-lg text-slate-600">${stats.taxRev.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 border border-green-100 rounded shadow-sm">
                           <div className="text-xs text-green-700 uppercase tracking-wider">Net Total</div>
                           <div className="font-bold text-lg text-green-700">${stats.revenue.toFixed(2)}</div>
                        </div>
                     </div>
                   )}
                   
                   {/* Mini Order List for this Event (Last 5) */}
                   {isExpanded && (
                      <div className="px-6 pb-6 pt-2 bg-slate-50 border-t border-slate-100">
                         <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Recent Orders</h4>
                         {orders.filter(o => o.eventId === evt.id).slice(0, 5).map(o => (
                           <div key={o.id} className="flex justify-between items-center text-sm bg-white p-2 mb-1 rounded border border-slate-200">
                              <span>{o.customer?.name || 'Draft'} <span className="text-slate-400">({o.id.slice(0,6)})</span></span>
                              <div className="flex items-center gap-3">
                                 <span>${o.financials?.total?.toFixed(2) || '0.00'}</span>
                                 {o.status === 'paid' && (
                                    <button onClick={() => { setPrintOrderId(o.id); navigateTo('print_view'); }} className="text-slate-400 hover:text-slate-800" title="Print Ticket">
                                       <Printer size={14} className="inline"/>
                                    </button>
                                 )}
                              </div>
                           </div>
                         ))}
                      </div>
                   )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}