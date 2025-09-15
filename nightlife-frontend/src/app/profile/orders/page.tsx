'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/domain/auth/ProtectedRoute';

interface Order {
  id: string;
  clubName: string;
  date: string;
  totalPaid: number;
  status: 'APPROVED' | 'PENDING' | 'DECLINED' | 'VOIDED';
  items: {
    type: 'ticket' | 'menu';
    name: string;
    quantity: number;
    price: number;
  }[];
  createdAt: string;
}

function OrdersContent() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch('/api/orders');
      // const data = await response.json();
      
      // Mock data for now
      const mockOrders: Order[] = [
        {
          id: '1',
          clubName: 'Club Example',
          date: '2024-01-15',
          totalPaid: 150000,
          status: 'APPROVED',
          items: [
            { type: 'ticket', name: 'Entrada General', quantity: 2, price: 50000 },
            { type: 'menu', name: 'Cerveza', quantity: 4, price: 50000 }
          ],
          createdAt: '2024-01-10T10:30:00Z'
        },
        {
          id: '2',
          clubName: 'Another Club',
          date: '2024-01-20',
          totalPaid: 75000,
          status: 'PENDING',
          items: [
            { type: 'ticket', name: 'VIP', quantity: 1, price: 75000 }
          ],
          createdAt: '2024-01-18T15:45:00Z'
        }
      ];
      
      setOrders(mockOrders);
    } catch (err) {
      setError('Error al cargar las órdenes');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'DECLINED':
        return 'bg-red-100 text-red-800';
      case 'VOIDED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Aprobada';
      case 'PENDING':
        return 'Pendiente';
      case 'DECLINED':
        return 'Rechazada';
      case 'VOIDED':
        return 'Anulada';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-nl-secondary mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Cargando órdenes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm sm:text-base text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchOrders}
            className="bg-nl-secondary hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm sm:text-base transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-nl-secondary hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 mb-4 transition-colors"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm sm:text-base">Volver al perfil</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Historial de Órdenes</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
            Aquí puedes ver todas tus compras y reservas
          </p>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sm:p-8 text-center">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tienes órdenes aún
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
              Cuando hagas una compra, aparecerá aquí
            </p>
            <Link
              href="/clubs"
              className="bg-nl-secondary hover:bg-purple-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-md font-medium text-sm sm:text-base transition-colors"
            >
              Explorar clubs
            </Link>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-2 sm:space-y-0">
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                        {order.clubName}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Fecha del evento: {formatDate(order.date)}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
                        Orden realizada: {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col sm:text-right space-y-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full w-fit ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                      <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                        {formatPrice(order.totalPaid)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Items de la orden:
                    </h4>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm space-y-1 sm:space-y-0">
                          <div className="flex items-center flex-wrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 sm:mr-3 ${
                              item.type === 'ticket' 
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                            }`}>
                              {item.type === 'ticket' ? 'Entrada' : 'Menú'}
                            </span>
                            <span className="text-gray-900 dark:text-white">{item.name}</span>
                            <span className="text-gray-500 dark:text-gray-400 ml-2">x{item.quantity}</span>
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.status === 'APPROVED' && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Link
                        href={`/profile/qrs?order=${order.id}`}
                        className="inline-flex items-center text-nl-secondary hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-xs sm:text-sm font-medium transition-colors"
                      >
                        Ver códigos QR
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
