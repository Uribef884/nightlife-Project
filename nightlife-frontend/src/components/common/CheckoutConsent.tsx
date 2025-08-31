import Link from 'next/link';

interface CheckoutConsentProps {
  className?: string;
}

export default function CheckoutConsent({ className = '' }: CheckoutConsentProps) {
  return (
    <p className={`text-xs text-gray-400 text-center ${className}`}>
      Al confirmar tu compra, aceptas los{' '}
      <Link href="/terms/purchase" className="text-purple-400 hover:text-purple-300 underline">
        Términos de Compra
      </Link>
      .
    </p>
  );
}
