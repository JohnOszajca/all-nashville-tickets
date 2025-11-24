import React from 'react';
import { Printer, ShieldCheck, CheckCircle } from 'lucide-react';
import QRCode from "react-qr-code"; // Import the REAL generator

export default function SuccessReceipt({ order, event }) {
  const allTickets = [];
  let ticketIndex = 0;
  
  order.items?.forEach(item => {
     for(let i = 0; i < item.qty; i++) {
        allTickets.push({
            ...item,
            uniqueIndex: ticketIndex,
            uniqueQrData: `${order.id}:${ticketIndex}`
        });
        ticketIndex++;
     }
  });

  const upsellItems = [];
  if (order.upsells && Array.isArray(order.upsells)) {
      upsellItems.push(...order.upsells);
  }
  if (order.customUpsell) {
      upsellItems.push(order.customUpsell);
  }

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto pb-10">
       {/* SCREEN ONLY HEADER */}
       <div className="bg-slate-900 text-white p-8 text-center rounded-t-xl no-print">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 shadow-lg bg-green-500 text-white" style={{WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
             <CheckCircle size={48} strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-bold mb-2">You're Going!</h1>
          <p className="text-slate-300">Order #{order.id?.slice(0,8)} confirmed.</p>
       </div>
       
       <div className="bg-white shadow-lg rounded-b-xl overflow-hidden p-8">
          {/* Receipt Section */}
          <div className="mb-8 border-b border-slate-200 pb-8">
            <h3 className="font-bold text-lg mb-4 uppercase tracking-wide text-slate-500">Receipt</h3>
            <div className="space-y-2">
                {order.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                        <span>{item.qty}x {item.name}</span>
                        <span>${(item.price * item.qty).toFixed(2)}</span>
                    </div>
                ))}
                {upsellItems.map((u, i) => (
                    <div key={`up-${i}`} className="flex justify-between text-sm text-green-600 font-medium">
                        <span className="flex items-center">{u.name === 'Ticket Protection' && <ShieldCheck size={14} className="mr-1"/>} 1x {u.name}</span>
                        <span>${u.price.toFixed(2)}</span>
                    </div>
                ))}
                
                {order.financials?.feeTotal > 0 && (
                    <div className="flex justify-between text-sm text-slate-500 pt-2">
                        <span>Processing Fees</span>
                        <span>${order.financials.feeTotal.toFixed(2)}</span>
                    </div>
                )}
                {order.financials?.tax > 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
                        <span>Sales Tax</span>
                        <span>${order.financials.tax.toFixed(2)}</span>
                    </div>
                )}
                
                <div className="flex justify-between font-bold text-xl pt-4 border-t mt-4">
                    <span>Total Paid</span>
                    <span>${(order.financials?.total + upsellItems.reduce((sum, u) => sum + u.price, 0)).toFixed(2)}</span>
                </div>
            </div>
            {order.termsAccepted && (
                <div className="mt-4 text-xs text-slate-400 flex items-center">
                    <CheckCircle size={12} className="mr-1"/> Terms & Conditions Accepted {order.termsAcceptedAt ? new Date(order.termsAcceptedAt.seconds * 1000).toLocaleDateString() : ''}
                </div>
            )}
          </div>

          {/* INDIVIDUAL TICKETS (THIS IS WHAT PRINTS) */}
          <div>
             <h3 className="font-bold text-lg mb-6 uppercase tracking-wide text-slate-500 text-center no-print">Your Tickets</h3>
             <div className="space-y-6">
                {allTickets.map((t) => (
                    <div key={t.uniqueIndex} className="border-2 border-slate-900 rounded-xl overflow-hidden print-ticket break-inside-avoid page-break">
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center" style={{WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                            <div className="flex items-center gap-4">
                                {/* PRINTABLE GREEN CHECKMARK FOR TICKET HEADER */}
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600" style={{WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                    <CheckCircle size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-lg">{event?.name || 'Event Ticket'}</div>
                                    <div className="text-xs text-slate-300">{event?.start ? new Date(event.start).toLocaleString() : ''}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="bg-white text-slate-900 text-xs font-bold px-2 py-1 rounded uppercase" style={{WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>{t.type}</div>
                            </div>
                        </div>
                        <div className="p-4 flex justify-between items-center bg-white">
                            <div>
                                <div className="text-slate-500 text-xs uppercase">Attendee</div>
                                <div className="font-bold text-lg mb-2">{order.customer?.name}</div>
                                <div className="text-slate-500 text-xs uppercase">Item</div>
                                <div className="font-bold text-amber-600">{t.name}</div>
                            </div>
                            <div className="text-center">
                                {/* THE REAL QR CODE GENERATOR */}
                                <div className="bg-white p-2">
                                   <QRCode 
                                     size={96} 
                                     style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                     value={t.uniqueQrData} 
                                     viewBox={`0 0 256 256`}
                                   />
                                </div>
                                {/* We keep the text ID below it just in case */}
                                <div className="text-[10px] text-slate-400 font-mono mt-1">{t.uniqueQrData}</div>
                            </div>
                        </div>
                        <div className="bg-slate-100 p-2 text-center text-xs text-slate-500 border-t">
                            Present this code for entry. Valid for one scan only.
                        </div>
                    </div>
                ))}
             </div>
          </div>
          
          <div className="text-center space-y-4 mt-8 no-print">
             <p className="text-slate-600">A copy has been sent to <span className="font-bold text-slate-800">{order.customer?.email}</span></p>
             <button className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 w-full flex justify-center items-center" onClick={handlePrint}>
                <Printer size={18} className="mr-2"/> Print / Save PDF
             </button>
          </div>
       </div>
    </div>
  );
}