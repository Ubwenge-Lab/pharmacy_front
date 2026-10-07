// frontend/src/app/patient/checkout/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errorHandler';
import Link from 'next/link';
import { ArrowLeftIcon, MapPinIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { PaymentMethod } from '@/types';

export default function CheckoutPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, getTotal, clearCart, pharmacyId, branchId } = useCart();
  const [loading, setLoading] = useState(false);
  const [uploadingPrescription, setUploadingPrescription] = useState(false);

  // Order type (DELIVERY | PICKUP) - matches backend DTO field name
  const [orderType, setOrderType] = useState<'DELIVERY' | 'PICKUP'>('PICKUP');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Payment method - matches backend enum exactly
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MTN_MOMO');

  // Prescription state - separate upload flow via /upload/prescription + /prescriptions
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);

  // branchId comes from the cart (set when the patient first adds a medication from a branch)

  const hasPrescription = items.some(i => i.requiresPrescription);
  const subtotal = getTotal();
  const deliveryFee = orderType === 'DELIVERY' ? 1000 : 0;
  const total = subtotal + deliveryFee;

  // Step 1: Upload prescription file to /upload/prescription
  // Step 2: Create prescription record via /prescriptions
  // Step 3: Use returned prescriptionId in the order
  const handleUploadPrescription = async () => {
    if (!prescriptionFile) {
      toast.error(t('form.selectPrescriptionFirst'));
      return;
    }

    setUploadingPrescription(true);
    try {
      // Step 1: Upload the file
      const uploadFormData = new FormData();
      uploadFormData.append('file', prescriptionFile);
      const uploadRes = await api.post('/upload/prescription', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { url, fileName, fileType } = uploadRes.data;

      // Step 2: Create the prescription record
      const prescriptionRes = await api.post('/prescriptions', {
        fileUrl: url,
        fileName,
        fileType,
      });

      setPrescriptionId(prescriptionRes.data.prescription?.id || prescriptionRes.data.id);
      setPrescriptionUploaded(true);
      toast.success(t('success.prescriptionUploaded'));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingPrescription(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      toast.error(t('form.enterDeliveryAddress'));
      return;
    }
    if (hasPrescription && !prescriptionId) {
      toast.error(t('form.uploadConfirmPrescription'));
      return;
    }
    if (!branchId) {
      toast.error(t('form.unableToDeterminePharmacy'));
      return;
    }
    setLoading(true);
    try {
      // POST /orders — JSON body matching CreateOrderDto exactly
      const orderPayload: {
        pharmacyId: string;
        branchId: string;
        type: 'DELIVERY' | 'PICKUP';
        paymentMethod: PaymentMethod;
        items: { medicationId: string; quantity: number }[];
        deliveryAddress?: string;
        prescriptionId?: string;
      } = {
        pharmacyId: pharmacyId!,
        branchId: branchId!,
        type: orderType,                // matches DTO field name: 'type'
        paymentMethod,
        items: items.map(i => ({
          medicationId: i.medicationId,
          quantity: i.quantity,
        })),
      };

      if (orderType === 'DELIVERY') {
        orderPayload.deliveryAddress = deliveryAddress;
      }

      if (prescriptionId) {
        orderPayload.prescriptionId = prescriptionId;
      }

      const res = await api.post('/orders', orderPayload);
      clearCart();
      toast.success(t('success.orderPlaced'));
      router.push(`/patient/orders/${res.data.id}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="space-y-6">
      <div className="bg-linear-to-r from-brand-navy to-brand-navy-dark rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold">{t('checkout.title')}</h1>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl m-6 shadow-sm p-12 text-center">
        <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-800 dark:text-gray-200 text-lg font-semibold mb-4">{t('checkout2.cartEmpty')}</p>
        <Link href="/patient/search">
          <button className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-md">{t('checkout2.browseMedications')}</button>
        </Link>
      </div>
    </div>
  );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
    <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
      <ArrowLeftIcon className="w-4 h-4" /> {t('checkout2.backToCart')}
      </button>

    <div className="bg-linear-to-r from-brand-navy to-brand-navy-dark rounded-2xl p-8 text-white">
      <h1 className="text-3xl font-bold mb-1">{t('checkout.title')}</h1>
      <p className="text-blue-100">{t('checkout.subtitle')}</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: Options */}
        <div className="lg:col-span-2 space-y-5">

        {/* Order Type (maps to DTO field: type) */}
          <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-lg text-gray-800 mb-4">{t('checkout2.fulfillmentMethod')}</h2>
          <div className="grid grid-cols-2 gap-4">
            {(['PICKUP', 'DELIVERY'] as const).map(type => (
                <button key={type} onClick={() => setOrderType(type)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${orderType === type ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'}`}>
                <span className="text-3xl">{type === 'PICKUP' ? '' : ''}</span>
                <span className="font-semibold text-sm text-gray-800">{type === 'PICKUP' ? t('checkout.pickup') : t('checkout.delivery')}</span>
                <span className="text-xs text-gray-500">{type === 'PICKUP' ? t('checkout2.free') : '+1,000 RWF'}</span>
              </button>
            ))}
            </div>
            {/* delivery address form field*/}
          {orderType === 'DELIVERY' && (
              <div className="mt-4">
              <label  htmlFor="deliveryAddress" className="block text-sm font-semibold text-gray-700 mb-1">{t('checkout2.deliveryAddress')}</label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea id="deliveryAddress" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none" rows={2}
                    placeholder={t('checkout2.deliveryAddressPlaceholder')} />
              </div>
            </div>
          )}
          </div>

        {/* Prescription Upload (if required) */}
          {hasPrescription && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6">
            <h2 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-yellow-600" />
              {t('medications.prescriptionRequired')}
              </h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('checkout2.prescriptionRequiredDesc')}
              </p>

            {!prescriptionUploaded ? (
                <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('checkout2.selectPrescriptionFile')}</label>
                  <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => setPrescriptionFile(e.target.files?.[0] || null)}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2"
                    />
                  {prescriptionFile && (
                      <p className="text-xs text-gray-500 mt-1">{prescriptionFile.name}</p>
                  )}
                  </div>
                <button
                    type="button"
                    onClick={handleUploadPrescription}
                    disabled={!prescriptionFile || uploadingPrescription}
                    className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                  >
                  {uploadingPrescription
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('pendingApproval.uploading')}</>
                    : t('checkout2.uploadPrescription')}
                  </button>
              </div>
            ) : (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-600 text-xl"></span>
                <div>
                  <p className="text-sm font-semibold text-green-800">{t('checkout2.prescriptionUploaded')}</p>
                  <p className="text-xs text-green-600">{prescriptionFile?.name}</p>
                </div>
                <button
                    type="button"
                    onClick={() => { setPrescriptionUploaded(false); setPrescriptionId(null); setPrescriptionFile(null); }}
                    className="ml-auto text-xs text-gray-500 hover:text-red-500 underline"
                  >
                  {t('checkout2.changePrescription')}
                  </button>
              </div>
            )}
            </div>
        )}

          {/* Payment Method */}
          <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-lg text-gray-800 mb-4">{t('checkout2.paymentMethod')}</h2>
          <div className="space-y-3">
            {[
                { value: 'MTN_MOMO', label: 'MTN Mobile Money', emoji: '' },
                { value: 'AIRTEL_MONEY', label: 'Airtel Money', emoji: '' },
                { value: 'CARD', label: 'Debit / Credit Card', emoji: '' },
                { value: 'INSURANCE', label: t('checkout2.insurancePayment'), emoji: '' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === opt.value ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'}`}>
                <input
                    type="radio"
                    name="payment"
                    value={opt.value}
                    checked={paymentMethod === opt.value}
                    onChange={() => setPaymentMethod(opt.value as PaymentMethod)}
                    className="text-teal-500"
                  />
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-sm font-medium text-gray-800">{opt.label}</span>
              </label>
            ))}
            </div>
        </div>
      </div>

      {/* RIGHT: Summary */}
        <div>
        <div className="bg-white rounded-2xl shadow p-6 sticky top-6">
          <h2 className="font-bold text-lg text-gray-800 mb-4">{t('checkout2.orderSummary')}</h2>
          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
            {items.map(item => (
                <div key={item.medicationId} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.name} × {item.quantity}</span>
                <span className="font-semibold text-gray-900">{(item.price * item.quantity).toLocaleString()} RWF</span>
              </div>
            ))}
            </div>
          <div className="border-t border-gray-200 pt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t('cart.subtotal')}</span><span>{subtotal.toLocaleString()} RWF</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('checkout2.delivery')}</span><span>{deliveryFee > 0 ? `${deliveryFee.toLocaleString()} RWF` : t('checkout2.free')}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>{t('cart.total')}</span><span className="text-blue-600">{total.toLocaleString()} RWF</span>
            </div>
          </div>
          <button
              onClick={handlePlaceOrder}
              disabled={loading || (hasPrescription && !prescriptionId)}
              className="w-full mt-4 bg-linear-to-r from-brand-navy to-brand-navy-dark text-white py-3.5 rounded-xl font-bold text-sm hover:from-blue-800 hover:to-blue-900 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
            {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('checkout2.placingOrder')}</>
              : t('checkout2.placeOrder')}
            </button>
          {hasPrescription && !prescriptionId && (
              <p className="text-xs text-yellow-600 mt-2 text-center">{t('checkout2.uploadPrescriptionToContinue')}</p>
          )}
          </div>
      </div>
    </div>
  </div>
);
}