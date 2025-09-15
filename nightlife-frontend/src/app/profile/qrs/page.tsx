'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/domain/auth/ProtectedRoute';

interface QRCode {
  id: string;
  orderId: string;
  clubName: string;
  date: string;
  type: 'ticket' | 'menu';
  itemName: string;
  qrCode: string;
  isUsed: boolean;
  usedAt?: string;
  expiresAt: string;
}

function QRsContent() {
  const { user } = useAuth();
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);

  useEffect(() => {
    fetchQRCodes();
  }, []);

  const fetchQRCodes = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch('/api/qr-codes');
      // const data = await response.json();
      
      // Mock data for now
      const mockQRCodes: QRCode[] = [
        {
          id: '1',
          orderId: '1',
          clubName: 'Club Example',
          date: '2024-01-15',
          type: 'ticket',
          itemName: 'Entrada General',
          qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          isUsed: false,
          expiresAt: '2024-01-16T23:59:59Z'
        },
        {
          id: '2',
          orderId: '1',
          clubName: 'Club Example',
          date: '2024-01-15',
          type: 'menu',
          itemName: 'Cerveza',
          qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          isUsed: true,
          usedAt: '2024-01-15T22:30:00Z',
          expiresAt: '2024-01-16T23:59:59Z'
        }
      ];
      
      setQrCodes(mockQRCodes);
    } catch (err) {
      setError('Error al cargar los códigos QR');
      console.error('Error fetching QR codes:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const downloadQR = (qrCode: QRCode) => {
    const link = document.createElement('a');
    link.href = qrCode.qrCode;
    link.download = `qr-${qrCode.clubName}-${qrCode.itemName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyQRToClipboard = async (qrCode: QRCode) => {
    try {
      // Convert base64 to blob
      const response = await fetch(qrCode.qrCode);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      alert('Código QR copiado al portapapeles');
    } catch (err) {
      console.error('Error copying QR code:', err);
      alert('Error al copiar el código QR');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-nl-secondary mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Cargando códigos QR...</p>
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
            onClick={fetchQRCodes}
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Mis Códigos QR</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
            Aquí tienes todos tus códigos QR para acceder a los clubs
          </p>
        </div>

        {/* QR Codes Grid */}
        {qrCodes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sm:p-8 text-center">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tienes códigos QR aún
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
              Cuando hagas una compra, tus códigos QR aparecerán aquí
            </p>
            <Link
              href="/clubs"
              className="bg-nl-secondary hover:bg-purple-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-md font-medium text-sm sm:text-base transition-colors"
            >
              Explorar clubs
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {qrCodes.map((qrCode) => (
              <div
                key={qrCode.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow ${
                  qrCode.isUsed ? 'opacity-75' : ''
                }`}
              >
                <div className="p-4 sm:p-6">
                  {/* QR Code Image */}
                  <div className="text-center mb-4">
                    <div className="inline-block p-2 sm:p-4 bg-white rounded-lg shadow-sm">
                      <img
                        src={qrCode.qrCode}
                        alt={`QR Code for ${qrCode.itemName}`}
                        className="w-24 h-24 sm:w-32 sm:h-32 mx-auto"
                      />
                    </div>
                  </div>

                  {/* QR Code Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium w-fit ${
                        qrCode.type === 'ticket' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }`}>
                        {qrCode.type === 'ticket' ? 'Entrada' : 'Menú'}
                      </span>
                      {qrCode.isUsed ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 w-fit">
                          Usado
                        </span>
                      ) : isExpired(qrCode.expiresAt) ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 w-fit">
                          Expirado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 w-fit">
                          Activo
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                      {qrCode.itemName}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {qrCode.clubName}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
                      Fecha: {formatDate(qrCode.date)}
                    </p>
                    
                    {qrCode.isUsed && qrCode.usedAt && (
                      <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                        Usado el: {formatDate(qrCode.usedAt)}
                      </p>
                    )}
                    
                    {!qrCode.isUsed && isExpired(qrCode.expiresAt) && (
                      <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                        Expirado el: {formatDate(qrCode.expiresAt)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {!qrCode.isUsed && !isExpired(qrCode.expiresAt) && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setSelectedQR(qrCode)}
                        className="w-full bg-nl-secondary hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                      >
                        Ver en pantalla completa
                      </button>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => downloadQR(qrCode)}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                        >
                          Descargar
                        </button>
                        <button
                          onClick={() => copyQRToClipboard(qrCode)}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full Screen QR Modal */}
        {selectedQR && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {selectedQR.itemName}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
                  {selectedQR.clubName} - {formatDate(selectedQR.date)}
                </p>
                
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm mb-4 sm:mb-6">
                  <img
                    src={selectedQR.qrCode}
                    alt={`QR Code for ${selectedQR.itemName}`}
                    className="w-48 h-48 sm:w-64 sm:h-64 mx-auto"
                  />
                </div>
                
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
                  Muestra este código QR en la entrada del club
                </p>
                
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={() => downloadQR(selectedQR)}
                    className="flex-1 bg-nl-secondary hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium text-sm sm:text-base transition-colors"
                  >
                    Descargar
                  </button>
                  <button
                    onClick={() => setSelectedQR(null)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium text-sm sm:text-base transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QRsPage() {
  return (
    <ProtectedRoute>
      <QRsContent />
    </ProtectedRoute>
  );
}
