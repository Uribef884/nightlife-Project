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

  // ✅ NEW: safe numeric coercion + COP formatting
  const toAmount = (v: unknown): number => {
    // Coerce to number first
    const n =
      typeof v === 'string'
        ? Number(v.replace(/,/g, '').trim()) // defensive: strip commas if any
        : typeof v === 'number'
        ? v
        : 0;

    if (!Number.isFinite(n)) return 0;

    // Optional cents heuristic (kept conservative to avoid false positives):
    // some services return integer cents; if it's HUGE and looks like cents, divide by 100
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
      maximumFractionDigits: 2, // fees can have decimals
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
      const data = await apiFetch<any[]>(apiUrl('/unified-purchases'));
      setPurchases(data);
    } catch (err) {
      setError('Error al cargar las compras');
      console.error('Error fetching purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'text-green-600';
      case 'PENDING':
        return 'text-yellow-600';
      case 'DECLINED':
        return 'text-red-600';
      case 'VOIDED':
        return 'text-gray-600';
      case 'ERROR':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Entregado';
      case 'PENDING':
        return 'Pendiente';
      case 'DECLINED':
        return 'Rechazado';
      case 'VOIDED':
        return 'Anulado';
      case 'ERROR':
        return 'Error';
      default:
        return status;
    }
  };

  const toggleExpanded = (purchaseId: string) => {
    setExpandedPurchase(expandedPurchase === purchaseId ? null : purchaseId);
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
            <Link
              href="/auth/login"
              className="bg-nl-accent hover:bg-red-700 text-white px-4 py-2 rounded-2xl text-sm transition-colors"
            >
              Iniciar Sesión
            </Link>
          ) : (
            <button
              onClick={fetchPurchases}
              className="bg-nl-accent hover:bg-red-700 text-white px-4 py-2 rounded-2xl text-sm transition-colors"
            >
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
          <Link href="/dashboard" className="mr-4 p-2 -ml-2">
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-white/90">Órdenes</h1>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 py-4">
        {purchases.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-white/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-white/90 mb-2">
              No tienes compras aún
            </h3>
            <p className="text-sm text-white/70 mb-6">
              Cuando hagas una compra, aparecerá aquí
            </p>
            <Link
              href="/clubs"
              className="bg-nl-accent hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-medium text-sm transition-colors"
            >
              Explorar clubs
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map((purchase) => {
              // ✅ Coerce EVERYTHING to numbers before math
              const ticketSubtotal = toAmount(purchase.ticketSubtotal);
              const menuSubtotal = toAmount(purchase.menuSubtotal);
              const totalPaid = toAmount(purchase.totalPaid);
              const subtotal = ticketSubtotal + menuSubtotal;
              const serviceFee = totalPaid - subtotal;

              return (
                <div
                  key={purchase.id}
                  className="rounded-2xl border border-nl-secondary/30 bg-nl-card shadow-soft overflow-hidden"
                >
                  {/* Order Card Header */}
                  <div
                    className="p-4 flex items-center cursor-pointer hover:border-nl-secondary/60 transition-colors"
                    onClick={() => toggleExpanded(purchase.id)}
                  >
                    {/* Club Image - matching ClubCard style */}
                    <div className="relative w-16 h-16 shrink-0 rounded-2xl overflow-hidden ring-2 ring-nl-secondary/60 bg-black/20 mr-4">
                      {purchase.club?.profileImageUrl ? (
                        <img
                          src={purchase.club.profileImageUrl}
                          alt={purchase.club.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#6B3FA0]/20 to-black/60">
                          <span className="text-white/80 font-semibold text-lg">
                            {purchase.club?.name?.charAt(0) || 'C'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white/90 font-semibold text-lg leading-tight truncate">
                        {purchase.club?.name || 'Club desconocido'}
                      </h3>
                      <p className="text-white/70 text-sm">
                        {getStatusText(purchase.paymentStatus)} - {formatDate(purchase.createdAt)}
                      </p>
                    </div>

                    <div className="ml-2">
                      <svg
                        className={`w-6 h-6 text-nl-accent transition-transform ${
                          expandedPurchase === purchase.id ? 'rotate-90' : ''
                        }`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0Z" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedPurchase === purchase.id && (
                    <div className="border-t border-white/10 bg-white/5">
                      <div className="p-4 space-y-4">
                        {/* Items List - Now at the top */}
                        <div>
                          <h4 className="text-sm font-semibold text-white/90 mb-3">Items comprados</h4>
                          <div className="space-y-3">
                            {/* Ticket Purchases */}
                            {purchase.ticketPurchases?.map((ticketPurchase: any, index: number) => (
                              <div key={`ticket-${index}`} className="flex items-center text-sm">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 bg-white/10 text-white/80">
                                  Entrada
                                </span>
                                <div className="flex-1">
                                  <div className="flex flex-col">
                                    {ticketPurchase.ticket.event ? (
                                      <div className="flex flex-col">
                                        <span className="text-white/90 font-medium">{ticketPurchase.ticket.event.name}</span>
                                        <span className="text-sm text-white/70">- {ticketPurchase.ticket.name}</span>
                                      </div>
                                    ) : (
                                      <span className="text-white/90">{ticketPurchase.ticket.name}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {ticketPurchase.ticket.includesMenuItem && (
                                      <span className="text-xs text-white/70">
                                        (Incluye menú)
                                      </span>
                                    )}
                                    {ticketPurchase.isUsed && (
                                      <span className="text-xs text-green-400">
                                        ✓ Usada
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}

                            {/* Menu Purchases */}
                            {purchase.menuPurchases?.map((menuPurchase: any, index: number) => (
                              <div key={`menu-${index}`} className="flex items-center text-sm">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 bg-white/10 text-white/80">
                                  Menú
                                </span>
                                <div className="flex-1">
                                  <div className="flex flex-col">
                                    <span className="text-white/90">{menuPurchase.menuItem.name}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                      {menuPurchase.variant && (
                                        <span className="text-xs text-white/60">
                                          ({menuPurchase.variant.name})
                                        </span>
                                      )}
                                      <span className="text-xs text-white/60">x{menuPurchase.quantity}</span>
                                      {menuPurchase.isUsed && (
                                        <span className="text-xs text-green-400">
                                          ✓ Usado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ✅ Price Breakdown — FIXED */}
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

                        {/* Order Details */}
                        <div className="text-xs text-white/60 space-y-1">
                          <p>ID de transacción: {purchase.id}</p>
                          <p>Compra realizada: {formatFullDate(purchase.createdAt)}</p>
                          {purchase.date && (
                            <p>Fecha del evento: {formatFullDate(purchase.date)}</p>
                          )}
                          {purchase.customerFullName && (
                            <p>Comprador: {purchase.customerFullName}</p>
                          )}
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
