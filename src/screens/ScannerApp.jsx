import React, { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { QrCode, Search, ChevronLeft, CheckCircle, ShieldCheck, Tag } from 'lucide-react';

export default function ScannerApp({ events, orders, db, appId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedOrderId, setScannedOrderId] = useState(null); 
  const [highlightedIndex, setHighlightedIndex] = useState(null); 

  const scannedOrder = useMemo(() => 
      orders.find(o => o.id === scannedOrderId), 
  [orders, scannedOrderId]);

  const handleScan = (qrString) => {
      const [oid, idx] = qrString.split(':');
      const order = orders.find(o => o.id === oid);
      
      if (order) {
          setScannedOrderId(order.id);
          setHighlightedIndex(idx ? parseInt(idx) : null);
      } else {
          alert("Order not found");
      }
  };

  const toggleItemCheckIn = async (orderId, itemIndex, currentStatus) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const newCheckIns = { ...(order.checkIns || {}) };
      newCheckIns[itemIndex] = !currentStatus;

      const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
      await updateDoc(orderRef, { checkIns: newCheckIns });
    } catch (e) {
      console.error(e);
    }
  };

  const getCheckInList = (order) => {
      let list = [];
      let idx = 0;
      order.items?.forEach(item => {
          for(let i=0; i<item.qty; i++) {
              list.push({ ...item, globalIndex: idx, status: order.checkIns?.[idx] || false });
              idx++;
          }
      });
      return list;
  };

  const paidOrders = orders.filter(o => o.status === 'paid');
  const filteredOrders = paidOrders.filter(o => {
    const matchesSearch = o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.id.includes(searchTerm);
    return matchesSearch;
  });

  if (scannedOrder) {
      const checkInList = getCheckInList(scannedOrder);
      const protection = scannedOrder.upsells?.find(u => u.name === 'Ticket Protection');
      
      return (
          <div className="bg-slate-100 min-h-screen pb-20">
              <div className="bg-slate-900 text-white p-4 sticky top-0 z-40 shadow-lg flex justify-between items-center">
                  <button onClick={() => { setScannedOrderId(null); setHighlightedIndex(null); }} className="text-white flex items-center"><ChevronLeft /> Back</button>
                  <div className="font-bold">Checking In</div>
                  <div className="w-8"></div>
              </div>
              
              <div className="p-4">
                  <div className="bg-white rounded-xl shadow p-4 mb-4 text-center">
                      <h2 className="text-2xl font-bold">{scannedOrder.customer?.name}</h2>
                      <p className="text-slate-500">Order #{scannedOrder.id.slice(0,6)}</p>
                      
                      {protection && (
                          <div className="flex justify-center mt-2">
                             <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded flex items-center">
                                <ShieldCheck size={12} className="mr-1"/> Protection
                             </span>
                          </div>
                      )}
                  </div>

                  <div className="space-y-3">
                      {checkInList.map((item) => (
                          <div 
                            key={item.globalIndex} 
                            onClick={() => toggleItemCheckIn(scannedOrder.id, item.globalIndex, item.status)}
                            className={`p-4 rounded-xl border-2 flex justify-between items-center cursor-pointer transition ${
                                item.status 
                                ? 'bg-green-50 border-green-500' 
                                : (highlightedIndex === item.globalIndex ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-300' : 'bg-white border-slate-200')
                            }`}
                          >
                              <div>
                                  <div className="font-bold text-lg">{item.name}</div>
                                  <div className="text-xs text-slate-500 uppercase">{item.type} • Ticket #{item.globalIndex + 1}</div>
                              </div>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.status ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                  <CheckCircle size={20} />
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-slate-100 min-h-screen pb-20">
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-40 shadow-lg flex gap-2">
          <div className="relative flex-grow">
             <Search className="absolute left-3 top-3 text-slate-400" size={18} />
             <input type="text" placeholder="Search Guest Name or ID..." className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800 text-white border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
      </div>

      <div className="p-4 space-y-4">
         {filteredOrders.length === 0 ? (
            <div className="text-center text-slate-400 mt-10">No orders found.</div>
         ) : (
            filteredOrders.map(order => (
               <div key={order.id} onClick={() => setScannedOrderId(order.id)} className="bg-white rounded-xl shadow-sm border-l-4 border-amber-500 p-4 cursor-pointer hover:bg-slate-50">
                   <h3 className="font-bold text-lg text-slate-900">{order.customer?.name}</h3>
                   <p className="text-xs text-slate-500">ID: #{order.id.slice(0,6)}</p>
               </div>
            ))
         )}
      </div>
    </div>
  );
}