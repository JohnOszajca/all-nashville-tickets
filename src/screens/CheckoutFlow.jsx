import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Calendar, MapPin, Minus, Plus, AlertCircle, CreditCard, ArrowRight, ChevronLeft, Image as ImageIcon, CheckCircle, Shield, ShieldCheck, FileText, X, Check } from 'lucide-react';
import SuccessReceipt from '../components/SuccessReceipt';

export default function CheckoutFlow({ events, db, appId, activeEventId }) {
  const [step, setStep] = useState(1); 
  const [cart, setCart] = useState({}); 
  const [upgradesCart, setUpgradesCart] = useState({}); 
  const [customer, setCustomer] = useState({ name: '', email: '' });
  const [orderId, setOrderId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState({}); 
  
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showProtectionModal, setShowProtectionModal] = useState(false);

  const event = events.find(e => e.id === activeEventId);

  // Helper to fetch live order for receipt
  const ReceiptFetcher = ({ orderId }) => {
    const [order, setOrder] = useState(null);
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), (doc) => {
            setOrder({ id: doc.id, ...doc.data() });
        });
        return () => unsub();
    }, [orderId]);

    if (!order) return <div className="text-center p-10">Generating Receipt...</div>;
    return <SuccessReceipt order={order} event={event} />;
  };

  if (!event) return <div className="p-10 text-center">No events currently available.</div>;

  // --- Derived Financials ---
  const totalTicketQty = Object.values(cart).reduce((a,b)=>a+b,0);
  const ticketTotal = (event.tickets || []).reduce((sum, t) => sum + (t.price * (cart[t.id] || 0)), 0);
  const upgradeTotal = (event.upgrades || []).reduce((sum, u) => sum + (u.price * (upgradesCart[u.id] || 0)), 0);
  const subtotalNoFee = ticketTotal + upgradeTotal;

  // Dynamic Fee Logic
  let feeTotal = 0;
  if (event.feeRate && event.feeRate > 0) {
      if (event.feeType === 'percent') {
          feeTotal = subtotalNoFee * (event.feeRate / 100);
      } else {
          feeTotal = event.feeRate * totalTicketQty;
      }
  }
  
  const subtotal = subtotalNoFee + feeTotal;
  const tax = (event.taxRate && event.taxRate > 0) ? (subtotal * (event.taxRate / 100)) : 0;
  const grandTotal = subtotal + tax;

  // --- Actions ---
  const handleLeadCapture = async () => {
    const newErrors = {};
    if (!customer.name) newErrors.name = "Name is required";
    if (!customer.email) newErrors.email = "Email is required";
    if (totalTicketQty === 0) newErrors.tickets = "Please select at least one ticket";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setIsProcessing(true);
    try {
      const orderData = {
        eventId: event.id,
        eventName: event.name,
        eventStart: event.start,
        eventLocation: event.location,
        customer,
        items: Object.keys(cart).map(tid => {
            const t = event.tickets.find(tk => tk.id.toString() === tid);
            return { ...t, qty: cart[tid], type: 'ticket' };
        }).filter(i => i.qty > 0),
        status: 'draft', 
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderData);
      setOrderId(docRef.id);
      setStep(2);
    } catch (e) {
      console.error(e);
    }
    setIsProcessing(false);
  };

  const handlePayment = async () => {
    if (!acceptedTerms) {
        setErrors({ ...errors, terms: "Please accept the terms to continue." });
        return;
    }
    setErrors({ ...errors, terms: null });

    setIsProcessing(true);
    
    const items = [
      ...Object.keys(cart).map(tid => {
          const t = event.tickets.find(tk => tk.id.toString() === tid);
          return { ...t, qty: cart[tid], type: 'ticket' };
      }).filter(i => i.qty > 0),
      ...Object.keys(upgradesCart).map(uid => {
          const u = event.upgrades.find(uk => uk.id.toString() === uid);
          return { ...u, qty: upgradesCart[uid], type: 'upgrade' };
      }).filter(i => i.qty > 0)
    ];

    await new Promise(r => setTimeout(r, 1500)); // Simulate auth

    const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
    await updateDoc(orderRef, {
      items: items,
      termsAccepted: true,
      termsAcceptedAt: serverTimestamp(),
      financials: { ticketTotal, upgradeTotal, feeTotal, tax, total: grandTotal },
    });

    setStep(4); // Go to Ticket Protection
    setIsProcessing(false);
  };

  const handleProtection = async (accepted, price) => {
      setIsProcessing(true);
      const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
      
      if (accepted) {
          await updateDoc(orderRef, {
              upsells: [{ name: 'Ticket Protection', price: price, paid: true }]
          });
      }
      
      if (event.upsellConfig?.enabled) {
          setStep(5);
      } else {
          await finalizeOrder(orderRef);
          setStep(6);
      }
      setIsProcessing(false);
  };

  const handleCustomUpsell = async (accepted, upsellItem, price) => {
    setIsProcessing(true);
    const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
    
    if (accepted) {
       await updateDoc(orderRef, {
           customUpsell: { name: upsellItem, price: price, paid: true }
       });
    }
    
    await finalizeOrder(orderRef);
    setStep(6); 
    setIsProcessing(false);
  };

  const finalizeOrder = async (orderRef) => {
      await updateDoc(orderRef, {
          status: 'paid',
          paidAt: serverTimestamp(),
          checkIns: {}
      });
  };

  // --- Step Renderers ---
  const renderStep1 = () => (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-3">{event.name}</h2>
        <div className="flex flex-col md:flex-row md:items-center text-slate-800 space-y-2 md:space-y-0 md:space-x-6 text-base">
          <span className="flex items-center font-bold"><Calendar size={20} className="mr-2 text-amber-500"/> {new Date(event.start).toLocaleString()}</span>
          <span className="flex items-center font-bold"><MapPin size={20} className="mr-2 text-amber-500"/> {event.location}</span>
        </div>
      </div>

      <div className={`bg-white p-6 rounded-xl shadow-sm border mb-6 transition ${errors.tickets ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'}`}>
        <div className="flex justify-between items-center mb-4">
           <h3 className="font-bold text-lg">Select Tickets</h3>
           {errors.tickets && <span className="text-red-500 text-sm font-bold animate-pulse">{errors.tickets}</span>}
        </div>
        <div className="space-y-4">
          {event.tickets.map(ticket => (
            <div key={ticket.id} className={`flex justify-between items-center p-3 rounded-lg border ${cart[ticket.id] > 0 ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
              <div>
                <div className="font-bold">{ticket.name}</div>
                <div className="text-slate-500 text-sm">${ticket.price}</div>
                {ticket.qty <= 0 && <span className="text-xs text-red-500 font-bold flex items-center"><AlertCircle size={10} className="mr-1"/> Sold Out</span>}
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  disabled={!cart[ticket.id]}
                  onClick={() => setCart({...cart, [ticket.id]: (cart[ticket.id] || 0) - 1})} 
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-50">
                  <Minus size={16} />
                </button>
                <span className="font-bold w-6 text-center">{cart[ticket.id] || 0}</span>
                <button 
                  disabled={ticket.qty <= (cart[ticket.id] || 0)} 
                  onClick={() => setCart({...cart, [ticket.id]: (cart[ticket.id] || 0) + 1})} 
                  className="w-8 h-8 rounded-full bg-slate-900 hover:bg-amber-500 flex items-center justify-center text-white transition disabled:bg-slate-300">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-lg mb-4">Your Details</h3>
        <div className="grid gap-4">
          <div>
            <input 
                type="text" 
                placeholder="Full Name" 
                className={`w-full p-3 border rounded-lg outline-none ${errors.name ? 'border-red-500 bg-red-50' : 'focus:ring-2 focus:ring-amber-500'}`}
                value={customer.name}
                onChange={e => setCustomer({...customer, name: e.target.value})}
            />
            {errors.name && <div className="text-red-500 text-xs mt-1">{errors.name}</div>}
          </div>
          <div>
            <input 
                type="email" 
                placeholder="Email Address" 
                className={`w-full p-3 border rounded-lg outline-none ${errors.email ? 'border-red-500 bg-red-50' : 'focus:ring-2 focus:ring-amber-500'}`}
                value={customer.email}
                onChange={e => setCustomer({...customer, email: e.target.value})}
            />
             {errors.email && <div className="text-red-500 text-xs mt-1">{errors.email}</div>}
          </div>
        </div>
      </div>

      <div className="mt-8">
         <button 
            onClick={handleLeadCapture} 
            disabled={isProcessing}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl shadow-lg text-lg flex justify-between px-6 items-center transition transform active:scale-95">
            <span>Next Step</span>
            <span>${ticketTotal} <ArrowRight className="inline ml-1" /></span>
         </button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const availableUpgrades = (event.upgrades || []).filter(u => u.qty > 0);
    
    return (
      <div className="animate-fade-in">
         <button onClick={() => setStep(1)} className="text-slate-500 mb-4 flex items-center hover:text-slate-800"><ChevronLeft size={16} /> Back</button>
         
         <div className="mb-6">
           <h2 className="text-2xl font-bold">{event.upgradesHeading || 'Enhance Your Experience'}</h2>
           <p className="text-slate-600">{event.upgradesDescription || 'Customize your night with these exclusive add-ons.'}</p>
         </div>
         
         {availableUpgrades.length > 0 ? (
           <div className="space-y-4 mb-8">
             {availableUpgrades.map(upgrade => (
               <div key={upgrade.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden group flex flex-col md:flex-row">
                  <div className="w-full md:w-32 h-32 md:h-auto bg-slate-200 flex-shrink-0 relative">
                    {upgrade.image ? (
                      <img src={upgrade.image} alt={upgrade.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon /></div>
                    )}
                  </div>
                  
                  <div className="p-4 flex-grow flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                       <div>
                          <h4 className="font-bold text-lg">{upgrade.name}</h4>
                          <p className="text-slate-500 text-sm mt-1 mb-2 pr-4">{upgrade.description || "No description available."}</p>
                       </div>
                       <div className="text-right hidden md:block">
                          <div className="text-xs text-slate-400 font-bold uppercase mb-1">Price</div>
                          <div className="font-bold text-lg">${upgrade.price}</div>
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-slate-400 hidden md:block">{upgrade.qty} remaining</div>
                      <div className="flex items-center space-x-3 ml-auto">
                        <div className="font-bold text-lg md:hidden mr-4">${upgrade.price}</div>
                        <button 
                           onClick={() => setUpgradesCart({...upgradesCart, [upgrade.id]: Math.max(0, (upgradesCart[upgrade.id] || 0) - 1)})}
                           className="w-8 h-8 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center border border-slate-300"><Minus size={16}/></button>
                        <span className="font-bold w-6 text-center">{upgradesCart[upgrade.id] || 0}</span>
                        <button 
                           disabled={upgrade.qty <= (upgradesCart[upgrade.id] || 0)}
                           onClick={() => setUpgradesCart({...upgradesCart, [upgrade.id]: (upgradesCart[upgrade.id] || 0) + 1})}
                           className="w-8 h-8 rounded bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center shadow"><Plus size={16}/></button>
                      </div>
                    </div>
                  </div>
               </div>
             ))}
           </div>
         ) : (
           <div className="text-center py-10 bg-slate-50 rounded-xl mb-6">No available upgrades for this event.</div>
         )}
  
         <div className="bg-slate-900 text-white p-6 rounded-xl flex justify-between items-center shadow-xl z-20">
            <div>
              <div className="text-slate-400 text-sm">Total with Add-ons</div>
              <div className="text-2xl font-bold">${ticketTotal + upgradeTotal}</div>
            </div>
            <button onClick={() => setStep(3)} className="bg-white text-slate-900 px-6 py-3 rounded-lg font-bold hover:bg-slate-100 flex items-center">
              Checkout <ArrowRight size={16} className="ml-2"/>
            </button>
         </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="animate-fade-in max-w-lg mx-auto">
       <button onClick={() => setStep(2)} className="text-slate-500 mb-4 flex items-center hover:text-slate-800"><ChevronLeft size={16} /> Back</button>
       <h2 className="text-2xl font-bold mb-6">Payment</h2>

       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 space-y-3">
         <div className="flex justify-between text-sm">
           <span>Tickets ({totalTicketQty})</span>
           <span>${ticketTotal.toFixed(2)}</span>
         </div>
         {upgradeTotal > 0 && (
            <div className="flex justify-between text-sm">
                <span>Upgrades</span>
                <span>${upgradeTotal.toFixed(2)}</span>
            </div>
         )}
         {feeTotal > 0 && (
            <div className="flex justify-between text-sm">
                <span>Processing Fee {event.feeType === 'percent' ? `(${event.feeRate}%)` : ''}</span>
                <span>${feeTotal.toFixed(2)}</span>
            </div>
         )}
         {tax > 0 && (
            <div className="flex justify-between text-sm">
                <span>Sales Tax ({event.taxRate}%)</span>
                <span>${tax.toFixed(2)}</span>
            </div>
         )}
         <div className="border-t pt-3 flex justify-between font-bold text-lg">
           <span>Total Due</span>
           <span>${grandTotal.toFixed(2)}</span>
         </div>
       </div>

       <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
          <div className="mb-4 flex items-center space-x-2 text-slate-700">
             <CreditCard size={20} />
             <span className="font-bold">Card Information</span>
          </div>
          <div className="space-y-4">
            <input type="text" placeholder="Card Number" className="w-full p-3 border rounded-lg bg-slate-50" defaultValue="4242 4242 4242 4242" />
            <div className="flex gap-4">
               <input type="text" placeholder="MM/YY" className="w-1/2 p-3 border rounded-lg bg-slate-50" defaultValue="12/26" />
               <input type="text" placeholder="CVC" className="w-1/2 p-3 border rounded-lg bg-slate-50" defaultValue="123" />
            </div>
            
            {/* Terms Checkbox */}
            <div className="flex items-start mt-4">
                <input 
                    type="checkbox" 
                    id="terms" 
                    className={`mt-1 mr-3 w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer ${errors.terms ? 'ring-2 ring-red-500 border-red-500' : ''}`}
                    checked={acceptedTerms}
                    onChange={e => {
                        setAcceptedTerms(e.target.checked);
                        if(e.target.checked && errors.terms) setErrors({...errors, terms: null});
                    }}
                />
                <label htmlFor="terms" className="text-sm text-slate-600 cursor-pointer">
                    I understand and agree to the <button onClick={() => setShowTermsModal(true)} className="text-amber-600 underline font-bold">Terms & Conditions</button>. I authorize All Nashville Roadshow to charge my card for the total amount above.
                </label>
            </div>
            
            {errors.terms && <div className="text-red-500 text-sm font-bold ml-8 animate-pulse">{errors.terms}</div>}

            <button 
              onClick={handlePayment} 
              disabled={isProcessing}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-lg transition flex justify-center items-center">
              {isProcessing ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : `Pay $${grandTotal.toFixed(2)}`}
            </button>
            <div className="text-xs text-center text-slate-400 flex items-center justify-center gap-1">
               <div className="w-2 h-2 bg-green-500 rounded-full"></div> Secure 256-bit SSL Encrypted
            </div>
          </div>
       </div>

       {/* Terms Modal */}
       {showTermsModal && (
           <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
               <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
                   <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                       <h3 className="font-bold flex items-center"><FileText className="mr-2"/> Terms & Conditions</h3>
                       <button onClick={() => setShowTermsModal(false)}><X size={20}/></button>
                   </div>
                   <div className="p-6 overflow-y-auto flex-grow">
                       <p className="text-sm text-slate-600 whitespace-pre-wrap">{event.termsText || "No terms available."}</p>
                   </div>
                   <div className="p-4 border-t bg-slate-50 text-right">
                       <button onClick={() => setShowTermsModal(false)} className="bg-slate-900 text-white px-4 py-2 rounded font-bold">Close</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );

  // --- Step 4: Ticket Protection ---
  const renderStep4 = () => {
      const config = event.protectionConfig || {};
      const percentage = config.percentage || 10;
      // Protection Cost Logic: % of Subtotal (before fees/tax) or min $5
      const protectionCost = Math.max(5, Math.ceil(subtotalNoFee * (percentage / 100)));
      
      return (
        <div className="animate-fade-in text-center max-w-xl mx-auto pt-6">
            <div className="mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={32} className="text-green-600" />
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{config.title || 'Protect Your Order'}</h2>
                <p className="text-slate-600 max-w-sm mx-auto">{config.description || "Get a full refund if you can't attend due to qualifying reasons."}</p>
            </div>

            <div className="bg-white border-2 border-green-500 rounded-xl p-6 shadow-lg mb-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg uppercase">Recommended</div>
                <div className="flex justify-between items-center mb-4">
                    <div className="text-left">
                        <div className="font-bold text-xl text-slate-900">Ticket Protection</div>
                        <div className="text-sm text-slate-500">100% Money Back Guarantee</div>
                    </div>
                    <div className="text-2xl font-bold text-green-600">${protectionCost.toFixed(2)}</div>
                </div>
                
                {config.sellingPoints && (
                    <div className="bg-green-50 p-4 rounded-lg text-left text-sm text-slate-700 mb-6 border border-green-100">
                        <div className="font-bold text-green-800 mb-2 flex items-center">
                            <Check size={16} className="mr-2" /> What is Covered:
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">
                            {config.sellingPoints}
                        </div>
                    </div>
                )}
                
                <button onClick={() => setShowProtectionModal(true)} className="text-xs text-slate-400 underline mb-4 block w-full text-left">View Full Protection Terms</button>

                <button 
                    onClick={() => handleProtection(true, protectionCost)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg shadow transition transform hover:scale-[1.02] flex justify-center items-center">
                    <CheckCircle size={20} className="mr-2" /> Yes, Protect My Order
                </button>
            </div>

            <button 
                onClick={() => handleProtection(false, 0)}
                className="text-slate-400 hover:text-slate-600 text-sm underline mt-2">
                No thanks, I will take the risk
            </button>

            {/* Protection Terms Modal */}
            {showProtectionModal && (
               <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in text-left">
                   <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
                       <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                           <h3 className="font-bold flex items-center"><Shield size={20} className="mr-2"/> Protection Terms</h3>
                           <button onClick={() => setShowProtectionModal(false)}><X size={20}/></button>
                       </div>
                       <div className="p-6 overflow-y-auto flex-grow">
                           <p className="text-sm text-slate-600 whitespace-pre-wrap">{config.legalText || "No terms available."}</p>
                       </div>
                       <div className="p-4 border-t bg-slate-50 text-right">
                           <button onClick={() => setShowProtectionModal(false)} className="bg-slate-900 text-white px-4 py-2 rounded font-bold">Close</button>
                       </div>
                   </div>
               </div>
            )}
        </div>
      );
  };

  // --- Step 5: Custom Upsell ---
  const renderStep5 = () => {
      const config = event.upsellConfig || {};
      return (
        <div className="animate-fade-in text-center max-w-xl mx-auto pt-10">
          <div className="bg-white p-8 rounded-2xl shadow-2xl border-4 border-amber-400">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{config.title || 'Wait! One Last Thing...'}</h2>
            <p className="text-slate-600 mb-6">{config.description || 'Special offer just for you.'}</p>
            
            {config.image && (
                <img src={config.image} alt="Upsell" className="w-full h-48 object-cover rounded-lg mb-6" />
            )}

            <div className="bg-slate-100 p-6 rounded-xl mb-6">
               <div className="text-4xl font-bold text-slate-900 mb-1">
                   ${config.price} 
                   {config.retailPrice > 0 && (
                       <span className="text-lg text-slate-500 line-through font-normal ml-2">${config.retailPrice}</span>
                   )}
               </div>
               {config.retailPrice > config.price && (
                   <div className="text-sm text-green-600 font-bold">You save ${(config.retailPrice - config.price).toFixed(2)} instantly</div>
               )}
            </div>
    
            <button onClick={() => handleCustomUpsell(true, config.itemName || 'Special Offer', config.price)} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl mb-3 text-lg shadow-lg transform transition hover:scale-105">
               {config.itemName ? `Yes! Add ${config.itemName}` : 'Yes! Add to Order'}
            </button>
            <button onClick={() => handleCustomUpsell(false)} className="text-slate-400 hover:text-slate-600 text-sm underline">
               {config.noThanksText || 'No thanks'}
            </button>
          </div>
        </div>
      );
  };

  // Step 6: Receipt (Handled by main render return below)
  if (step === 6) {
      return <ReceiptFetcher orderId={orderId} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
       {step <= 3 && (
           <div className="bg-white shadow-sm py-4 mb-6">
              <div className="max-w-xl mx-auto px-4 flex justify-between">
                  {[1,2,3].map(s => (
                      <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${step >= s ? 'border-amber-500 bg-amber-50 text-amber-500' : 'border-slate-200 text-slate-300'}`}>{s}</div>
                  ))}
              </div>
           </div>
       )}

       <div className="max-w-xl mx-auto px-4">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
       </div>
    </div>
  );
}