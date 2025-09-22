// nightlife-frontend/src/app/profile/orders/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/domain/auth/ProtectedRoute';
import { apiFetch, apiUrl } from '@/lib/apiClient';

// ... your interfaces stay the same ...

function OrdersContent() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [qrLoading, setQrLoading] = useState(false);
  const [selectedQR, setSelectedQR] = useState<any | null>(null);

  // ✅ Numeric coercion + COP formatting
  const toAmount = (v: unknown): number => {
    const n =
      typeof v === 'string'
        ? Number(v.replace(/,/g, '').trim())
        : typeof v === 'number'
        ? v
        : 0;

    if (!Number.isFinite(n)) return 0;
    if (Number.isInteger(n) && n > 1_000_000 && n % 100 === 0) {
      return n / 100;
    }
    return n;
  };

  const toCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchPurchases();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
      setError('Debes iniciar sesión para ver tus compras');
    }
  }, [isAuthenticated, authLoading]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      // TODO: Backend should include the following fields in the API response:
      // - ticketPurchases[].includedQrCodeEncrypted (for included menu QRs)
      // - unified_purchase_transaction.qrPayload (exposed on purchase root as qrPayload)
      const data = await apiFetch<any[]>(apiUrl('/unified-purchases'));
      setPurchases(data);
    } catch (err) {
      setError('Error al cargar las compras');
      console.error('Error fetching purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatShortDate = (dateString: string) => {
    // Handle date-only strings (YYYY-MM-DD) from database
    if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // This is a date-only string, parse it as local date to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
    }
    
    // Handle full datetime strings
    return new Date(dateString).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
  };

  const formatFullDate = (dateString: string) => {
    // Handle date-only strings (YYYY-MM-DD) from database
    if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // This is a date-only string, parse it as local date to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    // Handle full datetime strings
    return new Date(dateString).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Entregado';
      case 'PENDING':  return 'Pendiente';
      case 'DECLINED': return 'Rechazado';
      case 'VOIDED':   return 'Anulado';
      case 'ERROR':    return 'Error';
      default:         return status;
    }
  };

  const toggleExpanded = (purchaseId: string) => {
    setExpandedPurchase(expandedPurchase === purchaseId ? null : purchaseId);
  };

  // -----------------------------
  // Helpers for robust field-picking
  // -----------------------------

  /** Case-insensitive key scan for any of the provided regexes. Returns first matching value. */
  const pickByKeyRegex = (obj: any, regexes: RegExp[]): string | undefined => {
    if (!obj || typeof obj !== 'object') return undefined;
    const keys = Object.keys(obj);
    for (const rx of regexes) {
      const k = keys.find((key) => rx.test(key));
      if (k && typeof obj[k] === 'string' && obj[k]) {
        return obj[k] as string;
      }
    }
    return undefined;
  };

  /** Safely detect "has included items" across legacy/typo fields */
  const hasIncluded = (tp: any): boolean =>
    !!(tp?.hasIncludedItems ?? tp?.hasincludedItems ?? tp?.ticket?.includesMenuItem);

  /**
   * Pick the included-menu QR payload for a ticket purchase.
   * Priority:
   *  1) includedQrCodeEncrypted (and common aliases)
   *  2) Regex scan for included QR patterns
   *  3) If nothing found: return {} (do NOT reuse ticket QR)
   */
  const pickIncludedQR = (tp: any): { payload?: string } => {
    if (!hasIncluded(tp)) return {};

    // Try known exact fields first
    const direct =
      tp?.includedQrCodeEncrypted ||
      tp?.included_qr_code_encrypted ||
      tp?.includedQR ||
      tp?.menuIncludedQrEncrypted ||
      tp?.included?.qrCodeEncrypted;

    if (typeof direct === 'string' && direct) {
      return { payload: direct };
    }

    // Try regex scan for any "included.*qr.*(encrypted|payload)" patterns
    const scanned =
      pickByKeyRegex(tp, [/^included.*qr.*encrypted$/i, /^included.*qr.*payload$/i]) ||
      pickByKeyRegex(tp?.included, [/qr.*encrypted/i, /qr.*payload/i]);

    if (scanned) {
      return { payload: scanned };
    }

    // If still nothing: return {} (do NOT fabricate or reuse the ticket QR)
    console.warn('[QR Included Missing] hasIncludedItems=true but no included QR payload found', {
      ticketPurchaseId: tp?.id,
      keys: Object.keys(tp || {}),
    });
    return {};
  };

  /**
   * Pick the transaction-wide menu QR for a purchase with menu items.
   * Priority:
   *  1) purchase.qrPayload
   *  2) purchase.menuQrPayload, purchase.menu_qr_payload
   *  3) purchase.unifiedPurchaseTransaction?.qrPayload
   *  4) Any key on purchase or purchase.unifiedPurchaseTransaction matching /qr.*payload/i
   *  5) If none found: return {} (do NOT look into individual menuPurchases)
   */
  const pickMenuTransactionQR = (purchase: any): { payload?: string } => {
    const hasStandaloneMenu = Array.isArray(purchase?.menuPurchases) && purchase.menuPurchases.length > 0;
    if (!hasStandaloneMenu) return {};

    // 1) canonical qrPayload
    if (typeof purchase?.qrPayload === 'string' && purchase.qrPayload) {
      return { payload: purchase.qrPayload };
    }

    // 2) menu-specific aliases
    if (typeof purchase?.menuQrPayload === 'string' && purchase.menuQrPayload) {
      return { payload: purchase.menuQrPayload };
    }
    if (typeof purchase?.menu_qr_payload === 'string' && purchase.menu_qr_payload) {
      return { payload: purchase.menu_qr_payload };
    }

    // 3) unifiedPurchaseTransaction.qrPayload
    if (typeof purchase?.unifiedPurchaseTransaction?.qrPayload === 'string' && purchase.unifiedPurchaseTransaction.qrPayload) {
      return { payload: purchase.unifiedPurchaseTransaction.qrPayload };
    }

    // 4) regex scan on purchase and unifiedPurchaseTransaction
    const purchaseMatch = pickByKeyRegex(purchase, [/qr.*payload/i]);
    if (purchaseMatch) {
      return { payload: purchaseMatch };
    }

    const transactionMatch = pickByKeyRegex(purchase?.unifiedPurchaseTransaction, [/qr.*payload/i]);
    if (transactionMatch) {
      return { payload: transactionMatch };
    }

    // If none found: return {} (do NOT look into individual menuPurchases, and do NOT fabricate)
    console.warn('[QR Menu Tx Missing] menuPurchases present but no transaction QR payload found', {
      purchaseId: purchase?.id,
      keys: Object.keys(purchase || {}),
      unifiedPurchaseTransactionKeys: purchase?.unifiedPurchaseTransaction ? Object.keys(purchase.unifiedPurchaseTransaction) : 'N/A',
    });
    return {};
  };

  /**
   * Generate QR codes for a purchase using correct sources & show missing cards when payloads not found
   */
  const generateQRCodes = async (purchase: any) => {
    const codes: any[] = [];


    // 1) Individual ticket QRs + included-menu per ticket
    for (const [index, tp] of (purchase.ticketPurchases || []).entries()) {
      const ticketName = tp?.ticket?.name ?? 'Entrada';
      const eventName  = tp?.ticket?.event?.name;

      // Ticket QR - always push if qrCodeEncrypted exists
      if (tp?.qrCodeEncrypted) {
        try {
          const qrImage = await generateQRImageDataUrl(tp.qrCodeEncrypted);
          codes.push({
            id: `ticket-${purchase.id}-${index}`,
            type: 'ticket',
            itemName: eventName ? `${eventName} - ${ticketName}` : ticketName,
            clubName: purchase.club?.name || 'Club desconocido',
            date: purchase.date || purchase.createdAt,
            qrCode: qrImage,
            isUsed: !!tp.isUsed,
            usedAt: tp.usedAt,
            expiresAt: purchase.date
              ? (() => {
                  // Handle date-only strings (YYYY-MM-DD) from database
                  if (purchase.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [year, month, day] = purchase.date.split('-').map(Number);
                    // Create event end time (1 AM next day in Colombia timezone)
                    const eventEndDate = new Date(year, month - 1, day + 1, 1, 0, 0);
                    return eventEndDate.toISOString();
                  }
                  return new Date(purchase.date).toISOString();
                })()
              : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        } catch (err) {
          console.error('Error generating ticket QR image:', err);
        }
      } else {
        console.warn('Missing qrCodeEncrypted for ticketPurchase index', index, tp);
      }

      // Included menu QR - show missing card if no payload found
      if (hasIncluded(tp)) {
        const { payload: includedPayload } = pickIncludedQR(tp);
        if (includedPayload) {
          try {
            const includedImg = await generateQRImageDataUrl(includedPayload);
            codes.push({
              id: `ticket-menu-${purchase.id}-${index}`,
              type: 'menu',
              itemName: `Menú incluido - ${eventName ? `${eventName} - ${ticketName}` : ticketName}`,
              clubName: purchase.club?.name || 'Club desconocido',
              date: purchase.date || purchase.createdAt,
              qrCode: includedImg,
              isUsed: !!tp.isUsedMenu,
              usedAt: tp.menuQRUsedAt,
              expiresAt: purchase.date
                ? (() => {
                    // Handle date-only strings (YYYY-MM-DD) from database
                    if (purchase.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      const [year, month, day] = purchase.date.split('-').map(Number);
                      // Create event end time (1 AM next day in Colombia timezone)
                      const eventEndDate = new Date(year, month - 1, day + 1, 1, 0, 0);
                      return eventEndDate.toISOString();
                    }
                    // Handle full datetime strings
                    return new Date(purchase.date).toISOString();
                  })()
                : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });
          } catch (err) {
            console.error('Error generating INCLUDED menu QR image:', err);
          }
        } else {
          // Show missing card for included menu QR
          codes.push({
            id: `ticket-menu-missing-${purchase.id}-${index}`,
            type: 'menu-missing',
            itemName: 'Menú incluido — faltante',
            reason: 'El QR de menú incluido no está disponible todavía',
            clubName: purchase.club?.name || 'Club desconocido',
            date: purchase.date || purchase.createdAt,
          });
        }
      }
    }

    // 2) Single menu QR for the whole transaction - show missing card if no payload found
    if (purchase.menuPurchases?.length > 0) {
      const { payload: menuTxPayload } = pickMenuTransactionQR(purchase);
      if (menuTxPayload) {
        try {
          const menuQr = await generateQRImageDataUrl(menuTxPayload);
          codes.push({
            id: `menu-transaction-${purchase.id}`,
            type: 'menu',
            itemName: `Orden de menú - ${purchase.menuPurchases.length} ítem${purchase.menuPurchases.length > 1 ? 's' : ''}`,
            clubName: purchase.club?.name || 'Club desconocido',
            date: purchase.date || purchase.createdAt,
            qrCode: menuQr,
            isUsed: purchase.menuPurchases.some((mp: any) => mp.isUsed) || false,
            usedAt: purchase.menuPurchases.find((mp: any) => mp.usedAt)?.usedAt,
            expiresAt: purchase.date
              ? (() => {
                  // Handle date-only strings (YYYY-MM-DD) from database
                  if (purchase.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [year, month, day] = purchase.date.split('-').map(Number);
                    // Create event end time (1 AM next day in Colombia timezone)
                    const eventEndDate = new Date(year, month - 1, day + 1, 1, 0, 0);
                    return eventEndDate.toISOString();
                  }
                  // Handle full datetime strings
                  return new Date(purchase.date).toISOString();
                })()
              : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        } catch (err) {
          console.error('Error generating MENU TRANSACTION QR image:', err);
        }
      } else {
        // Show missing card for transaction menu QR
        codes.push({
          id: `menu-transaction-missing-${purchase.id}`,
          type: 'menu-missing',
          itemName: 'Orden de menú — faltante',
          reason: 'El QR de menú de la orden no está disponible todavía',
          clubName: purchase.club?.name || 'Club desconocido',
          date: purchase.date || purchase.createdAt,
        });
      }
    }

    return codes;
  };

  // QR image from encrypted payload
  const generateQRImageDataUrl = async (encryptedQR: string): Promise<string> => {
    try {
      const QRCode = (await import('qrcode')).default;
      return await QRCode.toDataURL(encryptedQR, {
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
    } catch (error) {
      console.error('Error generating QR image:', error);
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    }
  };

  const showQRCodes = async (purchase: any) => {
    setSelectedPurchase(purchase);
    setQrLoading(true);


    try {
      const codes = await generateQRCodes(purchase);
      setQrCodes(codes);
    } catch (error) {
      console.error('Error generating QR codes:', error);
      setQrCodes([]);
    } finally {
      setQrLoading(false);
    }
  };

  const closeQRModal = () => {
    setSelectedPurchase(null);
    setQrCodes([]);
  };

  const openQRViewer = (qrCode: any) => {
    // Only open viewer for real QR items, not missing ones
    if (qrCode.type !== 'menu-missing') {
      setSelectedQR(qrCode);
    }
  };
  const closeQRViewer = () => setSelectedQR(null);

  // Lock body scroll while QR viewer is open
  useEffect(() => {
    if (!selectedQR) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedQR]);

  // ESC to close
  useEffect(() => {
    if (!selectedQR) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeQRViewer();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedQR]);

  const formatDate = (dateString: string) => {
    // Handle date-only strings (YYYY-MM-DD) from database
    if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // This is a date-only string, parse it as local date to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    
    // Handle full datetime strings
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const isExpired = (expiresAt: string) => {
    if (!expiresAt) return false;
    
    // Handle date-only strings (YYYY-MM-DD) from database
    if (expiresAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // This is a date-only string, parse it as local date to avoid timezone issues
      const [year, month, day] = expiresAt.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      
      // Create event end time (1 AM next day in Colombia timezone)
      const eventEndDate = new Date(year, month - 1, day + 1, 1, 0, 0);
      
      // Get current time in Colombia timezone (UTC-5)
      const nowUTC = new Date();
      const colombiaOffset = -5 * 60; // Colombia is UTC-5
      const nowColombia = new Date(nowUTC.getTime() + (colombiaOffset * 60 * 1000));
      
      return nowColombia > eventEndDate;
    }
    
    // Handle full datetime strings
    return new Date(expiresAt) < new Date();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-nl-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nl-secondary mx-auto mb-4"></div>
          <p className="text-sm text-white/70">
            {authLoading ? 'Verificando autenticación...' : 'Cargando compras...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-nl-bg flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          {!isAuthenticated ? (
            <Link href="/auth/login" className="bg-nl-accent hover:bg-red-700 text-white px-4 py-2 rounded-2xl text-sm transition-colors">
              Iniciar Sesión
            </Link>
          ) : (
            <button onClick={fetchPurchases} className="bg-nl-accent hover:bg-red-700 text-white px-4 py-2 rounded-2xl text-sm transition-colors">
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nl-bg">
      {/* Header */}
      <div className="bg-nl-bg border-b border-white/10 px-4 py-4">
        <div className="flex items-center">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-nl-secondary hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm sm:text-base">Volver al perfil</span>
          </Link>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 py-4">
        {purchases.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-white/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-white/90 mb-2">No tienes compras aún</h3>
            <p className="text-sm text-white/70 mb-6">Cuando hagas una compra, aparecerá aquí</p>
            <Link href="/" className="bg-nl-secondary hover:bg-purple-700 text-white px-6 py-3 rounded-2xl font-medium text-sm transition-colors">
              Explorar clubs
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map((purchase) => {
              const ticketSubtotal = toAmount(purchase.ticketSubtotal);
              const menuSubtotal = toAmount(purchase.menuSubtotal);
              const totalPaid = toAmount(purchase.totalPaid);
              const subtotal = ticketSubtotal + menuSubtotal;
              const serviceFee = totalPaid - subtotal;

              return (
                <div key={purchase.id} className="rounded-2xl border border-nl-secondary/30 bg-nl-card shadow-soft overflow-hidden">
                  {/* Header */}
                  <div className="p-4 flex items-center cursor-pointer hover:border-nl-secondary/60 transition-colors" onClick={() => toggleExpanded(purchase.id)}>
                    <div className="relative w-16 h-16 shrink-0 rounded-2xl overflow-hidden ring-2 ring-nl-secondary/60 bg-black/20 mr-4">
                      {purchase.club?.profileImageUrl ? (
                        <img src={purchase.club.profileImageUrl} alt={purchase.club.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#6B3FA0]/20 to-black/60">
                          <span className="text-white/80 font-semibold text-lg">{purchase.club?.name?.charAt(0) || 'C'}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white/90 font-semibold text-lg leading-tight truncate">
                        {purchase.club?.name || 'Club desconocido'}
                      </h3>
                      <p className="text-white/70 text-sm">
                        {getStatusText(purchase.paymentStatus)} - {formatShortDate(purchase.createdAt)}
                      </p>
                    </div>

                    <div className="ml-2">
                      <svg className={`w-6 h-6 text-nl-accent transition-transform ${expandedPurchase === purchase.id ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0Z" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandedPurchase === purchase.id && (
                    <div className="border-t border-white/10 bg-white/5">
                      <div className="p-4 space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-white/90 mb-3">Items comprados</h4>
                          <div className="space-y-3">
                            {/* Tickets */}
                            {purchase.ticketPurchases?.map((tp: any, index: number) => {
                              const includes = hasIncluded(tp);
                              return (
                                <div key={`ticket-${index}`} className="flex items-center text-sm">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 bg-white/10 text-white/80">
                                    Entrada
                                  </span>
                                  <div className="flex-1">
                                    <div className="flex flex-col">
                                      {tp.ticket?.event ? (
                                        <div className="flex flex-col">
                                          <span className="text-white/90 font-medium">{tp.ticket.event.name}</span>
                                          <span className="text-sm text-white/70">- {tp.ticket.name}</span>
                                        </div>
                                      ) : (
                                        <span className="text-white/90">{tp.ticket?.name}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      {includes && <span className="text-xs text-white/70">(Incluye menú)</span>}
                                      {tp.isUsed && <span className="text-xs text-green-400">✓ Usada</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Menu items */}
                            {purchase.menuPurchases?.map((mp: any, index: number) => (
                              <div key={`menu-${index}`} className="flex items-center text-sm">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 bg-white/10 text-white/80">
                                  Menú
                                </span>
                                <div className="flex-1">
                                  <div className="flex flex-col">
                                    <span className="text-white/90">{mp.menuItem?.name}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                      {mp.variant && <span className="text-xs text-white/60">({mp.variant.name})</span>}
                                      <span className="text-xs text-white/60">x{mp.quantity}</span>
                                      {mp.isUsed && <span className="text-xs text-green-400">✓ Usado</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Prices */}
                        <div>
                          <h4 className="text-sm font-semibold text-white/90 mb-2">Desglose de precios</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-white/70">Subtotal:</span>
                              <span className="font-medium text-white/90">{toCOP(subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/70">Cargo por servicio:</span>
                              <span className="font-medium text-white/90">{toCOP(serviceFee)}</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t border-white/10 pt-2">
                              <span className="text-white/90">Total Pagado:</span>
                              <span className="text-white/90">{toCOP(totalPaid)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="text-xs text-white/60 space-y-1">
                          <p>ID de transacción: {purchase.id}</p>
                          <p>Compra realizada: {formatFullDate(purchase.createdAt)}</p>
                          {purchase.date && <p>Fecha del evento: {formatFullDate(purchase.date)}</p>}
                          {purchase.customerFullName && <p>Comprador: {purchase.customerFullName}</p>}
                        </div>

                        {/* Button */}
                        <div className="pt-4 border-t border-white/10">
                          <button
                            onClick={() => showQRCodes(purchase)}
                            className="w-full bg-nl-secondary hover:bg-purple-700 text-white px-4 py-3 rounded-2xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                          >
                            <svg
                              className="w-5 h-5"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              role="img"
                            >
                              {/* TL finder (ring) */}
                              <path
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M3 3h8v8H3V3Zm2 2v4h4V5H5Z"
                              />
                              {/* TR finder (ring) */}
                              <path
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M13 3h8v8h-8V3Zm2 2v4h4V5h-4Z"
                              />
                              {/* BL finder (ring) */}
                              <path
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M3 13h8v8H3v-8Zm2 2v4h4v-4H5Z"
                              />
                              {/* BR solid block */}
                              <rect x="13" y="13" width="8" height="8" rx="1" className="fill-current" />
                            </svg>
                            Mostrar Códigos QR
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Codes Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-4">
          <div className="bg-nl-card rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white/90">
                  Códigos QR - {selectedPurchase.club?.name || 'Club desconocido'}
                </h3>
                <p className="text-sm text-white/70 mt-1">{formatFullDate(selectedPurchase.createdAt)}</p>
              </div>
              <button onClick={closeQRModal} className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shadow-lg">
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {qrLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nl-secondary mx-auto mb-4"></div>
                <p className="text-sm text-white/70">Generando códigos QR...</p>
              </div>
            ) : qrCodes.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text白/90 mb-2">No hay códigos QR disponibles</h3>
                <p className="text-sm text-white/70">Esta compra no tiene códigos QR asociados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {qrCodes.map((qrCode) => (
                  <div key={qrCode.id} className={`bg-white/5 rounded-xl p-4 border border-white/10 ${qrCode.isUsed ? 'opacity-75' : ''}`}>
                    {/* QR Code Image or Missing Placeholder */}
                    <div className="text-center mb-3">
                      {qrCode.type === 'menu-missing' ? (
                        <div className="inline-block p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <svg className="w-24 h-24 mx-auto text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="inline-block p-3 bg-white rounded-lg cursor-pointer hover:scale-105 transition-transform" onClick={() => openQRViewer(qrCode)}>
                          <img
                            src={qrCode.qrCode}
                            alt={`QR Code for ${qrCode.itemName}`}
                            className="w-24 h-24 mx-auto"
                            style={{ imageRendering: 'pixelated' as any }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          qrCode.type === 'ticket' 
                            ? 'bg-purple-100 text-purple-800' 
                            : qrCode.type === 'menu-missing'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {qrCode.type === 'ticket' ? 'Entrada' : qrCode.type === 'menu-missing' ? 'Faltante' : 'Menú'}
                        </span>
                        {qrCode.type === 'menu-missing' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">No disponible</span>
                        ) : qrCode.isUsed ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Usado</span>
                        ) : isExpired(qrCode.expiresAt) ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Expirado</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Activo</span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-white/90">{qrCode.itemName}</h4>
                      <p className="text-xs text-white/70">Fecha: {formatDate(qrCode.date)}</p>

                      {/* Missing QR reason */}
                      {qrCode.type === 'menu-missing' && qrCode.reason && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {qrCode.reason}
                          </span>
                        </div>
                      )}

                      {/* Small audit chip if a fallback was used */}
                      {qrCode.fallbackNote && (
                        <p className="text-[11px] text-yellow-300/90">
                          {qrCode.fallbackNote}
                        </p>
                      )}

                      {qrCode.isUsed && qrCode.usedAt && <p className="text-xs text-green-400">Usado el: {formatDate(qrCode.usedAt)}</p>}
                      {!qrCode.isUsed && isExpired(qrCode.expiresAt) && <p className="text-xs text-red-400">Expirado el: {formatDate(qrCode.expiresAt)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-Screen QR Viewer - Lightbox Style (kept improved) */}
      {selectedQR && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-black" onClick={closeQRViewer}>
          <div className="relative w-full h-full max-w-5xl mx-auto max-h-[100vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Cerrar visor de QR"
              onClick={closeQRViewer}
              className="absolute right-4 top-4 flex items-center justify-center h-10 w-10 rounded-full bg-white text-black shadow-lg hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <span className="sr-only">Cerrar</span>
              <svg className="w-6 h-6" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="w-full h-full flex items-center justify-center p-6">
              <div className="text-center">
                <div className="inline-block bg-white rounded-2xl shadow-2xl border-2 border-white p-6">
                  <div className="max-w-[min(90vw,90vh)] max-h-[90vh]">
                    <img
                      src={selectedQR.qrCode}
                      alt={`QR Code for ${selectedQR.itemName}`}
                      className="w-full h-auto object-contain"
                      style={{ imageRendering: 'pixelated' as any }}
                    />
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${selectedQR.type === 'ticket' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'}`}>
                      {selectedQR.type === 'ticket' ? 'Entrada' : 'Menú'}
                    </span>
                    {selectedQR.isUsed ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-300 border border-green-500/30">Usado</span>
                    ) : isExpired(selectedQR.expiresAt) ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-500/20 text-red-300 border border-red-500/30">Expirado</span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">Activo</span>
                    )}
                  </div>

                  <h4 className="text-lg font-bold text-white leading-tight">{selectedQR.itemName}</h4>
                  <p className="text-sm text-white/80">Fecha: {formatDate(selectedQR.date)}</p>
                  {selectedQR.isUsed && selectedQR.usedAt && <p className="text-sm text-green-400 font-medium">Usado el: {formatDate(selectedQR.usedAt)}</p>}
                  {!selectedQR.isUsed && isExpired(selectedQR.expiresAt) && <p className="text-sm text-red-400 font-medium">Expirado el: {formatDate(selectedQR.expiresAt)}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <OrdersContent />
    </ProtectedRoute>
  );
}
