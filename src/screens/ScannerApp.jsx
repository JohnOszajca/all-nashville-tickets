import React, { useState, useMemo, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { QrCode, Search, ChevronLeft, CheckCircle, ShieldCheck, Tag, Lock, LogOut, Camera, X, Calendar, User, Printer, FileCheck } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function ScannerApp({ events, orders, db, appId }) {
  // --- AUTH STATE ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
        setUser(u);
        setAuthLoading(false);
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

  // --- SCANNER STATE ---
  const [activeEvent, setActiveEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedOrderId, setScannedOrderId] = useState(null); 
  const [isScanning, setIsScanning] = useState(false); 

  const scannedOrder = useMemo(() => 
      orders.find(o => o.id === scannedOrderId), 
  [orders, scannedOrderId]);

  // --- LOADING SCREEN ---
  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-100">Loading Scanner...</div>;

  // --- LOGIN SCREEN ---
  if (!user || user.isAnonymous) {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Lock className="text-amber-500" size={32} />
                      </div>
                      <h2 className="text-2xl font-bold text-slate-900">Staff Access</h2>
                      <p className="text-slate-500">Please log in to access the scanner.</p>
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
          </div>
      );
  }

  // --- 1. EVENT SELECTOR VIEW ---
  if (!activeEvent) {
      return (
          <div className="min-h-screen bg-slate-100 pb-10">
              <div className="bg-slate-900 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-10">
                  <h2 className="font-bold text-lg flex items-center"><Calendar className="mr-2 text-amber-500"/> Select Event</h2>
                  <button onClick={() => auth.signOut()} className="text-xs text-slate-400 hover:text-white flex items-center"><LogOut size={14} className="mr-1"/> Exit</button>
              </div>
              <div className="p-4 space-y-3">
                  {events.length === 0 && <div className="text-center text-slate-400 mt-10">No events found.</div>}
                  {events.map(evt => (
                      <div key={evt.id} onClick={() => setActiveEvent(evt)} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:bg-amber-50 active:scale-95 transition">
                          <div className="font-bold text-lg text-slate-900">{evt.name}</div>
                          <div className="text-sm text-slate-500">{new Date(evt.start).toLocaleString()}</div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  // --- 2. ACTIVE EVENT SCANNER VIEW ---

  const handleScanData = (results) => {
      if (!results || !results[0]?.rawValue) return;
      const rawValue = results[0].rawValue;
      const parts = rawValue.split(':');
      const oid = parts[0];
      const order = orders.find(o => o.id === oid);
      
      if (order && order.eventId === activeEvent.id) {
          setScannedOrderId(order.id);
          setIsScanning(false);
      } else if (order) {
          alert("Wrong Event! This ticket is for " + order.eventName);
          setIsScanning(false);
      } else {
          alert("Order not found!");
          setIsScanning(false);
      }
  };

  const toggleItemCheckIn = async (orderId, itemIndex, currentStatus) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      
      const newCheckIns = { ...(order.checkIns || {}) };
      newCheckIns[itemIndex] = !currentStatus;

      const updates = { checkIns: newCheckIns };

      // Record who scanned it if checking IN
      if (!currentStatus && auth.currentUser) {
          const newMetadata = { ...(order.checkInMetadata || {}) };
          newMetadata[itemIndex] = auth.currentUser.email;
          updates.checkInMetadata = newMetadata;
      }

      const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
      await updateDoc(orderRef, updates);
    } catch (e) {
      console.error(e);
    }
  };

  const getCheckInList = (order) => {
      let list = [];
      let idx = 0;
      order.items?.forEach(item => {
          for(let i=0; i<item.qty; i++) {
              list.push({ 
                  ...item, 
                  globalIndex: idx, 
                  status: order.checkIns?.[idx] || false,
                  scannedBy: order.checkInMetadata?.[idx]
              });
              idx++;
          }
      });
      return list;
  };

  const eventOrders = orders.filter(o => o.eventId === activeEvent.id && o.status === 'paid');
  
  // --- STATS CALCULATION (TICKETS ONLY) ---
  let totalTickets = 0;
  let checkedInTickets = 0;

  eventOrders.forEach(order => {
      let itemIndex = 0; // Global index tracker to match checkIn map
      order.items?.forEach(item => {
          const isTicket = item.type === 'ticket';
          for(let i=0; i<item.qty; i++) {
              if (isTicket) {
                  totalTickets++;
                  // Check if this specific index was checked in
                  if (order.checkIns?.[itemIndex] === true) {
                      checkedInTickets++;
                  }
              }
              itemIndex++; // Always increment to keep sync
          }
      });
  });

  const filteredOrders = eventOrders.filter(o => {
    const term = searchTerm.toLowerCase();
    return o.customer?.name?.toLowerCase().includes(term) || 
           o.id.includes(term) ||
           o.customer?.email?.toLowerCase().includes(term);
  });

  // --- CAMERA OVERLAY ---
  if (isScanning) {
      return (
          <div className="fixed inset-0 bg-black z-50 flex flex-col">
              <div className="p-4 flex justify-between items-center bg-black/50 absolute top-0 left-0 right-0 z-10 text-white">
                  <h3 className="font-bold text-lg">Scan QR Code</h3>
                  <button onClick={() => setIsScanning(false)} className="p-2 bg-slate-800 rounded-full"><X /></button>
              </div>
              <div className="flex-grow flex items-center justify-center bg-black">
                  <div className="w-full max-w-md aspect-square relative">
                      <Scanner onScan={handleScanData} components={{ audio: false, finder: false }} styles={{ container: { width: '100%', height: '100%' } }} />
                      <div className="absolute inset-0 border-4 border-amber-500 opacity-50 pointer-events-none m-12 rounded-xl z-20"></div>
                  </div>
              </div>
          </div>
      );
  }

  // --- ORDER DETAIL MODAL ---
  if (scannedOrder) {
      const checkInList = getCheckInList(scannedOrder);
      const protection = scannedOrder.upsells?.find(u => u.name === 'Ticket Protection');
      
      // Open the print view in a new tab
      const handlePrintLink = () => {
         const url = `${window.location.origin}/?printOrderId=${scannedOrder.id}`;
         window.open(url, '_blank');
      };

      return (
          <div className="bg-slate-100 min-h-screen pb-20">
              <div className="bg-slate-900 text-white p-4 sticky top-0 z-40 shadow-lg flex justify-between items-center">
                  <button onClick={() => setScannedOrderId(null)} className="text-white flex items-center"><ChevronLeft /> Back</button>
                  <div className="font-bold">Order Details</div>
                  <div className="w-8"></div>
              </div>
              <div className="p-4">
                  {/* CUSTOMER HEADER */}
                  <div className="bg-white rounded-xl shadow p-4 mb-4 text-center">
                      <h2 className="text-2xl font-bold">{scannedOrder.customer?.name}</h2>
                      <p className="text-blue-600 font-medium mb-1">{scannedOrder.customer?.email}</p>
                      <p className="text-slate-400 text-xs uppercase mb-3">Order #{scannedOrder.id.slice(0,6)}</p>
                      
                      {/* ADMIN TOOLS */}
                      <button onClick={handlePrintLink} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg text-sm flex items-center justify-center mx-auto mb-2 border border-slate-300">
                         <Printer size={16} className="mr-2"/> View Official Receipt
                      </button>

                      {protection && <div className="flex justify-center mt-2"><span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded flex items-center"><ShieldCheck size={12} className="mr-1"/> Protection</span></div>}
                  </div>

                  {/* LEGAL / TERMS AUDIT BOX */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs text-slate-500">
                     <div className="flex items-center text-slate-700 font-bold mb-1">
                        <FileCheck size={14} className="mr-1 text-green-600"/> Terms of Service Verification
                     </div>
                     <div className="flex justify-between">
                         <span>Status:</span>
                         <span className="font-mono text-slate-900">{scannedOrder.termsAccepted ? 'ACCEPTED' : 'N/A'}</span>
                     </div>
                     <div className="flex justify-between">
                         <span>Date:</span>
                         <span className="font-mono text-slate-900">{scannedOrder.termsAcceptedAt ? new Date(scannedOrder.termsAcceptedAt.seconds * 1000).toLocaleString() : '-'}</span>
                     </div>
                  </div>

                  {/* CHECK IN LIST */}
                  <div className="space-y-3">
                      {checkInList.map((item) => (
                          <div key={item.globalIndex} onClick={() => toggleItemCheckIn(scannedOrder.id, item.globalIndex, item.status)} className={`p-4 rounded-xl border-2 flex flex-col cursor-pointer transition ${item.status ? 'bg-green-50 border-green-500' : 'bg-white border-slate-200'}`}>
                              <div className="flex justify-between items-center w-full">
                                  <div><div className="font-bold text-lg">{item.name}</div><div className="text-xs text-slate-500 uppercase">{item.type} • Ticket #{item.globalIndex + 1}</div></div>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.status ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}><CheckCircle size={20} /></div>
                              </div>
                              {/* DISPLAY WHO SCANNED THIS ITEM */}
                              {item.status && item.scannedBy && (
                                  <div className="text-[10px] text-green-600 font-medium mt-2 pt-2 border-t border-green-200 w-full text-right">
                                      Verified by: {item.scannedBy}
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
                  <button onClick={() => {
                        const updates = {};
                        const newMetadata = {};
                        checkInList.forEach(i => {
                             updates[i.globalIndex] = true;
                             if(auth.currentUser) newMetadata[i.globalIndex] = auth.currentUser.email;
                        });
                        const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', scannedOrder.id);
                        updateDoc(orderRef, { checkIns: updates, checkInMetadata: newMetadata });
                    }} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800">Check In ALL Items</button>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-slate-100 min-h-screen pb-20">
      {/* HEADER WITH STATS */}
      <div className="bg-slate-900 text-white sticky top-0 z-40 shadow-lg">
          <div className="p-4 pb-2 flex justify-between items-center">
             <div className="flex items-center">
                 <button onClick={() => setActiveEvent(null)} className="mr-3 text-slate-400 hover:text-white"><ChevronLeft /></button>
                 <div className="font-bold truncate max-w-[200px]">{activeEvent.name}</div>
             </div>
             <div className="text-xs bg-slate-800 px-2 py-1 rounded text-amber-500 font-mono">
                 {checkedInTickets} / {totalTickets}
             </div>
          </div>
          <div className="px-4 pb-4 flex gap-2">
             <div className="relative flex-grow">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input type="text" placeholder="Search..." className="w-full pl-9 pr-4 py-2 rounded bg-slate-800 text-white text-sm border-none focus:ring-1 focus:ring-amber-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             <button onClick={() => setIsScanning(true)} className="bg-amber-500 text-white p-2 rounded font-bold shadow flex items-center justify-center"><Camera size={20} /></button>
          </div>
      </div>

      <div className="p-2 space-y-1">
         {filteredOrders.length === 0 ? (
            <div className="text-center text-slate-400 mt-10">No orders found.</div>
         ) : (
            filteredOrders.map(order => {
               // Check if ALL items in this order are checked in
               const totalItems = order.items?.reduce((acc, i) => acc + i.qty, 0) || 0;
               const checkedCount = Object.values(order.checkIns || {}).filter(v => v === true).length;
               const isFullyCheckedIn = totalItems > 0 && checkedCount >= totalItems;
               
               return (
                   <div key={order.id} onClick={() => setScannedOrderId(order.id)} className={`bg-white rounded border shadow-sm cursor-pointer flex items-center p-2 border-l-4 ${isFullyCheckedIn ? 'border-l-green-500' : 'border-l-yellow-400'}`}>
                       <div className="flex-grow ml-2">
                           <div className="font-bold text-sm text-slate-900">{order.customer?.name}</div>
                           <div className="text-xs text-slate-500 flex gap-2">
                               <span>ID: {order.id.slice(0,6)}</span>
                               <span>•</span>
                               <span>{order.customer?.email}</span>
                           </div>
                       </div>
                       <div className={`text-xs font-bold px-2 py-1 rounded ${isFullyCheckedIn ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                           {checkedCount}/{totalItems}
                       </div>
                   </div>
               );
            })
         )}
      </div>
      
    </div>
  );
}