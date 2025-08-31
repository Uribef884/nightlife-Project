export default function PurchaseTermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-white mb-6">Términos de Compra</h1>
      
      <div className="prose prose-invert max-w-none">
        <h2 className="text-2xl font-semibold text-white mb-4">1. Confirmación de Compra</h2>
        <p className="text-gray-300 mb-4">
          Al confirmar tu compra en NightLife, aceptas estos términos de compra y reconoces que 
          has revisado toda la información de tu pedido antes de proceder con el pago.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">2. Precios y Disponibilidad</h2>
        <p className="text-gray-300 mb-4">
          Todos los precios mostrados están en pesos colombianos (COP) e incluyen IVA cuando aplique. 
          Los precios pueden cambiar sin previo aviso. La disponibilidad de tickets y menús está sujeta 
          a confirmación en tiempo real.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">3. Proceso de Pago</h2>
        <p className="text-gray-300 mb-4">
          Al realizar el pago, autorizas a NightLife a procesar tu transacción. Los pagos se procesan 
          a través de proveedores de pago seguros. Una vez confirmado el pago, recibirás una confirmación 
          por email.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">4. Confirmación y Entrega</h2>
        <p className="text-gray-300 mb-4">
          Después de una compra exitosa, recibirás tickets digitales o confirmaciones por email. 
          Para tickets de eventos, asegúrate de presentar tu confirmación en la entrada del club.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">5. Política de Cancelación</h2>
        <p className="text-gray-300 mb-4">
          Las cancelaciones están sujetas a las políticas específicas de cada club y evento. 
          Algunos tickets pueden no ser reembolsables. Consulta con el club antes de realizar tu compra.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">6. Responsabilidades del Usuario</h2>
        <p className="text-gray-300 mb-4">
          Es tu responsabilidad verificar la información de tu pedido, incluyendo fechas, horarios, 
          ubicaciones y detalles del evento antes de confirmar la compra.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">7. Limitaciones</h2>
        <p className="text-gray-300 mb-4">
          NightLife actúa como intermediario entre usuarios y clubes. No somos responsables por 
          cambios en eventos, cancelaciones o modificaciones realizadas por los clubes.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">8. Contacto y Soporte</h2>
        <p className="text-gray-300 mb-4">
          Para consultas sobre tu compra, contáctanos a través de nuestra plataforma. 
          Proporcionaremos asistencia para resolver cualquier problema relacionado con tu transacción.
        </p>

        <p className="text-sm text-gray-400 mt-8">
          Última actualización: {new Date().toLocaleDateString('es-ES')}
        </p>
      </div>
    </div>
  );
}
