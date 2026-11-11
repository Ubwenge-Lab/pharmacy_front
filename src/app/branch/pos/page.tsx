'use client';

/**
 * /branch/pos — Point of Sale (Uganda)
 * Walk-in counter sales module.
 * Staff can add items from branch inventory, set payment method,
 * and complete the sale. A printable receipt is shown on completion.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errorHandler';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  ShoppingCartIcon,
  PrinterIcon,
  CheckCircleIcon,
  BanknotesIcon,
  ArrowPathIcon,
  QrCodeIcon,
  HashtagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Medication {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  requiresPrescription: boolean;
}

interface CartItem {
  medication: Medication;
  qty: number;
}

type PaymentMethod = 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'CARD' | 'INSURANCE';

interface Receipt {
  receiptNumber: string;
  receiptType?: string;
  date: string;
  pharmacy: { name: string; address: string; phone: string };
  customer: { name: string; phone: string };
  items: { name: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  taxRate?: number;
  taxAmount?: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
}

interface DailySummary {
  date: string;
  branchId?: string;
  totalRevenue: number;
  totalTransactions: number;
  totalItemsSold: number;
  byPaymentMethod: Record<string, { count: number; amount: number }>;
}

// ─── Payment labels ──────────────────────────────────────────────────────────

const PM_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  MTN_MOMO: 'MTN MoMo',
  AIRTEL_MONEY: 'Airtel Money',
  CARD: 'Card',
  INSURANCE: 'Insurance',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function POSPage() {
  const { t } = useTranslation();
  const receiptRef = useRef<HTMLDivElement>(null);

  // Inventory
  const fetchMedications = useCallback(async (signal: AbortSignal) => {
    const res = await api.get('/medications/pharmacy/my-medications', { signal });
    return (Array.isArray(res.data) ? res.data : res.data?.data ?? []) as Medication[];
  }, []);
  const { data: meds, loading: medsLoading, error: medsError } = useFetch<Medication[]>(fetchMedications, []);
  useEffect(() => { if (medsError) toast.error('Failed to load inventory'); }, [medsError]);

  // Summary
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get('/pos/sales/summary');
      setSummary(res.data);
    } catch { /* silent */ }
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Cart state
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Scan Rx (prescription QR / ID) + branch QR
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [scanModal, setScanModal] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [qrData, setQrData] = useState<{ deepLink: string; qrDataUrl: string; branchName: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const medications = meds ?? [];
  const filtered = medications.filter(m =>
    m.quantity > 0 &&
    (m.name.toLowerCase().includes(search.toLowerCase()) ||
     m.category.toLowerCase().includes(search.toLowerCase()))
  );

  // Cart math
  const subtotal = cart.reduce((s, i) => s + i.medication.price * i.qty, 0);
  const discountedTotal = Math.max(0, subtotal - discount);
  const change = Math.max(0, parseFloat(amountReceived || '0') - discountedTotal);

  // ── Cart actions ─────────────────────────────────────────────────────────

  const addToCart = (med: Medication) => {
    setCart(prev => {
      const existing = prev.find(i => i.medication.id === med.id);
      if (existing) {
        if (existing.qty >= med.quantity) {
          toast.error(`Only ${med.quantity} units available`);
          return prev;
        }
        return prev.map(i => i.medication.id === med.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { medication: med, qty: 1 }];
    });
  };

  const updateQty = (medId: string, delta: number) => {
    setCart(prev =>
      prev.flatMap(i => {
        if (i.medication.id !== medId) return [i];
        const newQty = i.qty + delta;
        if (newQty <= 0) return [];
        if (newQty > i.medication.quantity) {
          toast.error(`Only ${i.medication.quantity} units available`);
          return [i];
        }
        return [{ ...i, qty: newQty }];
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setAmountReceived('');
    setPatientName('');
    setPatientPhone('');
    setNotes('');
    setReceipt(null);
    setPrescriptionId(null);
  };

  // ── Scan Rx: verify a prescription (by ID or QR payload) and prefill the cart ──

  const handleScanRx = async () => {
    const input = scanInput.trim();
    if (!input) { toast.error('Paste the prescription ID or QR payload'); return; }
    setScanning(true);
    try {
      const res = await api.post('/prescriptions/verify', { qrCodePayload: input });
      const rx = res.data;
      if (rx.status !== 'APPROVED') {
        toast.error(`Prescription is ${rx.status} — only APPROVED prescriptions can be dispensed`);
        return;
      }
      const meds = (rx.prescriptionMedications ?? [])
        .filter((m: any) => m.matchedMedication)
        .map((m: any) => ({
          medication: {
            id: m.matchedMedication.id,
            name: m.matchedMedication.name,
            category: '',
            price: Number(m.matchedMedication.price),
            quantity: m.matchedMedication.quantity,
            requiresPrescription: true,
          },
          qty: m.quantity,
        }));
      if (meds.length === 0) {
        toast.error('No matched medications on this prescription');
        return;
      }
      setCart(meds);
      setPrescriptionId(rx.id);
      setScanModal(false);
      setScanInput('');
      toast.success(`Prescription ${rx.id.slice(0, 8)}… loaded (${meds.length} item(s))`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setScanning(false);
    }
  };

  // ── Branch QR: patient scans to open this branch in the portal ────────────

  const handleShowQr = async () => {
    setQrModal(true);
    if (qrData) return;
    setQrLoading(true);
    try {
      const branchId = summary?.branchId;
      if (!branchId) { toast.error('Branch not resolved — check the daily summary'); return; }
      const res = await api.get(`/branches/${branchId}/qr`);
      setQrData(res.data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setQrLoading(false);
    }
  };

  // ── Process sale ─────────────────────────────────────────────────────────

  const handleSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    const received = parseFloat(amountReceived || '0');
    if (received < discountedTotal) {
      toast.error(`Amount received (${received.toLocaleString()}) is less than total (${discountedTotal.toLocaleString()})`);
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post('/pos/sales', {
        items: cart.map(i => ({ medicationId: i.medication.id, quantity: i.qty })),
        paymentMethod,
        amountReceived: received,
        discount,
        patientName: patientName || undefined,
        patientPhone: patientPhone || undefined,
        prescriptionId: prescriptionId || undefined,
        notes: notes || undefined,
      });
      setReceipt(res.data.receipt);
      toast.success(`Sale ${res.data.saleNumber} completed!`);
      loadSummary();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Receipt</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: monospace; font-size: 12px; padding: 8px; max-width: 72mm; margin: 0 auto; }
        h2 { text-align: center; margin: 0 0 4px; font-size: 15px; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 2px 4px; }
        .right { text-align: right; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .total { font-weight: bold; font-size: 14px; }
        .muted { font-size: 11px; }
      </style>
      </head><body>
      ${receiptRef.current.innerHTML}
      </body></html>
    `);
    w.print();
    w.close();
  };

  // ── Receipt panel ─────────────────────────────────────────────────────────

  if (receipt) {
    return (
      <div className="max-w-lg mx-auto py-8 px-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6 flex items-center gap-3">
          <CheckCircleIcon className="w-8 h-8 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Sale Completed</p>
            <p className="text-green-700 text-sm">{receipt.receiptNumber}</p>
          </div>
        </div>

        {/* Printable receipt */}
        <div ref={receiptRef} className="bg-white border border-gray-200 rounded-xl p-6 text-sm font-mono mb-6">
          <h2 className="text-center text-base font-bold">{receipt.pharmacy.name}</h2>
          <p className="text-center text-xs text-gray-500">{receipt.pharmacy.address}</p>
          <p className="text-center text-xs text-gray-500">{receipt.pharmacy.phone}</p>
          <hr className="my-3 border-dashed" />
          <div className="text-xs text-gray-600 mb-1 flex justify-between">
            <span>Receipt: <b>{receipt.receiptNumber}</b></span>
            <span className="font-bold text-brand-teal">WALK-IN POS</span>
          </div>
          <div className="text-xs text-gray-600 mb-1">Date: {new Date(receipt.date).toLocaleString()}</div>
          {receipt.customer.name && receipt.customer.name !== 'Walk-in Customer' && (
            <div className="text-xs text-gray-600">Customer: {receipt.customer.name} {receipt.customer.phone}</div>
          )}
          <hr className="my-3 border-dashed" />
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dashed">
                <th className="text-left py-1">Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, i) => (
                <tr key={i} className="border-b border-dotted">
                  <td className="py-1">{item.name}</td>
                  <td className="text-right">{item.qty}</td>
                  <td className="text-right">{item.unitPrice.toLocaleString()}</td>
                  <td className="text-right">{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="my-3 border-dashed" />
          <div className="flex justify-between"><span>Subtotal</span><span>{receipt.subtotal.toLocaleString()}</span></div>
          {receipt.discount > 0 && (
            <div className="flex justify-between text-green-700"><span>Discount</span><span>-{receipt.discount.toLocaleString()}</span></div>
          )}
          <div className="flex justify-between font-bold text-base mt-1"><span>TOTAL</span><span>{receipt.total.toLocaleString()} RWF</span></div>
          {(receipt.taxAmount ?? 0) > 0 && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>incl. Tax ({(receipt.taxRate ?? 0) * 100}%)</span><span>{receipt.taxAmount!.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between mt-1"><span>Payment</span><span>{PM_LABELS[receipt.paymentMethod as PaymentMethod] ?? receipt.paymentMethod}</span></div>
          <div className="flex justify-between"><span>Received</span><span>{receipt.amountReceived.toLocaleString()}</span></div>
          {receipt.change > 0 && (
            <div className="flex justify-between font-semibold text-blue-700"><span>Change</span><span>{receipt.change.toLocaleString()}</span></div>
          )}
          <hr className="my-3 border-dashed" />
          <p className="text-center text-xs text-gray-400">Thank you for your purchase!</p>
        </div>

        <div className="flex gap-3">
          <button onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white py-3 rounded-xl font-medium transition-colors">
            <PrinterIcon className="w-5 h-5" /> Print Receipt
          </button>
          <button onClick={clearCart}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-teal hover:bg-brand-teal/90 text-white py-3 rounded-xl font-medium transition-colors">
            <ArrowPathIcon className="w-5 h-5" /> New Sale
          </button>
        </div>
      </div>
    );
  }

  // ── Main POS UI ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-80px)]">

      {/* Left: Inventory search */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header + summary */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Point of Sale</h1>
            {summary && (
              <p className="text-sm text-gray-500 mt-1">
                Today: <b>{summary.totalTransactions}</b> sales · <b>{summary.totalRevenue.toLocaleString()} RWF</b>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {prescriptionId && (
              <span className="text-xs bg-teal-100 text-teal-700 px-2.5 py-1.5 rounded-full flex items-center gap-1">
                Rx {prescriptionId.slice(0, 8)}… <button onClick={() => setPrescriptionId(null)}><XMarkIcon className="w-3.5 h-3.5" /></button>
              </span>
            )}
            <button
              onClick={() => setScanModal(true)}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-brand-teal text-brand-teal hover:bg-brand-teal/10 flex items-center gap-1.5"
            >
              <HashtagIcon className="w-4 h-4" /> Scan Rx
            </button>
            <button
              onClick={handleShowQr}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:border-brand-teal hover:text-brand-teal flex items-center gap-1.5"
            >
              <QrCodeIcon className="w-4 h-4" /> Branch QR
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search medications..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </div>

        {/* Medication grid */}
        {medsLoading ? (
          <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center text-gray-400 py-16">No medications found</div>
            ) : filtered.map(med => (
              <button
                key={med.id}
                onClick={() => addToCart(med)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-left hover:border-brand-teal hover:shadow-md transition-all group"
              >
                <p className="font-medium text-sm text-gray-800 dark:text-white truncate group-hover:text-brand-teal">{med.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{med.category}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-brand-teal">{med.price.toLocaleString()} RWF</span>
                  <span className={`text-xs ${med.quantity <= 5 ? 'text-red-500' : 'text-gray-400'}`}>
                    {med.quantity} left
                  </span>
                </div>
                {med.requiresPrescription && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mt-1 inline-block">Rx</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Cart + checkout */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Cart header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ShoppingCartIcon className="w-5 h-5 text-brand-teal" />
            <span className="font-semibold text-gray-800 dark:text-white">Cart</span>
            {cart.length > 0 && (
              <span className="bg-brand-teal text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <TrashIcon className="w-4 h-4" /> Clear
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-300">
              <ShoppingCartIcon className="w-10 h-10 mb-2" />
              <p className="text-sm">Tap a medication to add</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {cart.map(({ medication: med, qty }) => (
                <div key={med.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{med.name}</p>
                    <p className="text-xs text-gray-400">{med.price.toLocaleString()} RWF each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(med.id, -1)}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <MinusIcon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{qty}</span>
                    <button onClick={() => updateQty(med.id, 1)}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <PlusIcon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-brand-teal w-20 text-right">
                    {(med.price * qty).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout section */}
        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 space-y-3">

          {/* Customer (optional) */}
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Customer name (opt.)"
              value={patientName}
              onChange={e => setPatientName(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
            <input
              placeholder="Phone (opt.)"
              value={patientPhone}
              onChange={e => setPatientPhone(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
          </div>

          {/* Discount */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-20 shrink-0">Discount</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={discount || ''}
              onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
            <span className="text-xs text-gray-400">RWF</span>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>Subtotal</span><span>{subtotal.toLocaleString()} RWF</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span><span>-{discount.toLocaleString()} RWF</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-gray-600">
              <span>Total</span><span>{discountedTotal.toLocaleString()} RWF</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.entries(PM_LABELS) as [PaymentMethod, string][]).map(([pm, label]) => (
              <button
                key={pm}
                onClick={() => setPaymentMethod(pm)}
                className={`text-xs py-2 rounded-lg font-medium transition-colors ${
                  paymentMethod === pm
                    ? 'bg-brand-teal text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Amount received */}
          <div className="flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              type="number"
              min="0"
              placeholder="Amount received"
              value={amountReceived}
              onChange={e => setAmountReceived(e.target.value)}
              className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-teal font-semibold"
            />
          </div>

          {change > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-2.5 flex justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">Change</span>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{change.toLocaleString()} RWF</span>
            </div>
          )}

          {/* Confirm sale */}
          <button
            onClick={handleSale}
            disabled={processing || cart.length === 0}
            className="w-full py-3.5 rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" /> Processing...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5" /> Complete Sale
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scan Rx modal */}
      {scanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setScanModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <HashtagIcon className="w-5 h-5 text-brand-teal" /> Scan Prescription
              </h2>
              <button onClick={() => setScanModal(false)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Paste the prescription ID or the scanned QR payload. Only APPROVED prescriptions can be dispensed.
            </p>
            <textarea
              rows={3}
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder='{"id":"…","hash":"…"} or prescription id'
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
            <button
              onClick={handleScanRx}
              disabled={scanning}
              className="mt-4 w-full py-3 rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {scanning ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <HashtagIcon className="w-5 h-5" />}
              Load into Cart
            </button>
          </div>
        </div>
      )}

      {/* Branch QR modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setQrModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <QrCodeIcon className="w-5 h-5 text-brand-teal" /> Branch QR
              </h2>
              <button onClick={() => setQrModal(false)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            {qrLoading ? (
              <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : qrData ? (
              <>
                <img src={qrData.qrDataUrl} alt="Branch QR" className="mx-auto w-48 h-48 rounded-xl border border-gray-200" />
                <p className="text-sm font-medium text-gray-800 dark:text-white mt-3">{qrData.branchName}</p>
                <p className="text-xs text-gray-400 mt-1 break-all">{qrData.deepLink}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Patient scans to open this branch and order — print it and place it at the counter.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 py-8">Could not load the QR code.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
