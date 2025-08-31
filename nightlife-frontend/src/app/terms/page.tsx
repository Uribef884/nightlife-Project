export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-white mb-6">Términos de Servicio</h1>
      
      <div className="prose prose-invert max-w-none">
        <h2 className="text-2xl font-semibold text-white mb-4">1. Aceptación de los Términos</h2>
        <p className="text-gray-300 mb-4">
          Al acceder y utilizar NightLife, aceptas estar sujeto a estos Términos de Servicio. 
          Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar nuestro servicio.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">2. Descripción del Servicio</h2>
        <p className="text-gray-300 mb-4">
          NightLife es una plataforma que conecta usuarios con clubes nocturnos, permitiendo la compra 
          de tickets y menús, así como la gestión de reservas y eventos.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">3. Uso del Servicio</h2>
        <p className="text-gray-300 mb-4">
          Te comprometes a utilizar el servicio solo para fines legales y de acuerdo con estos términos. 
          No debes usar el servicio para actividades ilegales o que puedan dañar a otros usuarios.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">4. Compras y Pagos</h2>
        <p className="text-gray-300 mb-4">
          Todas las compras están sujetas a disponibilidad y confirmación. Los precios pueden cambiar 
          sin previo aviso. Al realizar una compra, aceptas pagar el precio total indicado.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">5. Política de Reembolsos</h2>
        <p className="text-gray-300 mb-4">
          Los reembolsos están sujetos a las políticas de cada club y evento. Consulta con el club 
          específico para conocer su política de reembolsos antes de realizar tu compra.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">6. Privacidad</h2>
        <p className="text-gray-300 mb-4">
          Tu privacidad es importante para nosotros. Consulta nuestra Política de Privacidad para 
          entender cómo recopilamos, usamos y protegemos tu información.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">7. Limitación de Responsabilidad</h2>
        <p className="text-gray-300 mb-4">
          NightLife no será responsable por daños indirectos, incidentales o consecuentes que 
          puedan resultar del uso de nuestro servicio.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">8. Modificaciones</h2>
        <p className="text-gray-300 mb-4">
          Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios 
          entrarán en vigor inmediatamente después de su publicación en la plataforma.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">9. Contacto</h2>
        <p className="text-gray-300 mb-4">
          Si tienes preguntas sobre estos términos, contáctanos a través de nuestra plataforma 
          o en el email de soporte proporcionado.
        </p>

        <p className="text-sm text-gray-400 mt-8">
          Última actualización: {new Date().toLocaleDateString('es-ES')}
        </p>
      </div>
    </div>
  );
}
