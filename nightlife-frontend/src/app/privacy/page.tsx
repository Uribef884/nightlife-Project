export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-white mb-6">Política de Privacidad</h1>
      
      <div className="prose prose-invert max-w-none">
        <h2 className="text-2xl font-semibold text-white mb-4">1. Información que Recopilamos</h2>
        <p className="text-gray-300 mb-4">
          Recopilamos información que nos proporcionas directamente, como cuando creas una cuenta, 
          realizas una compra o te comunicas con nosotros. Esto incluye tu nombre, email, información 
          de pago y preferencias.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">2. Cómo Usamos tu Información</h2>
        <p className="text-gray-300 mb-4">
          Utilizamos tu información para proporcionar, mantener y mejorar nuestros servicios, 
          procesar transacciones, enviar notificaciones importantes y personalizar tu experiencia.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">3. Compartir Información</h2>
        <p className="text-gray-300 mb-4">
          No vendemos, alquilamos ni compartimos tu información personal con terceros, excepto 
          cuando es necesario para proporcionar nuestros servicios o cuando la ley lo requiere.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">4. Seguridad de Datos</h2>
        <p className="text-gray-300 mb-4">
          Implementamos medidas de seguridad técnicas y organizativas para proteger tu información 
          personal contra acceso no autorizado, alteración, divulgación o destrucción.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">5. Cookies y Tecnologías Similares</h2>
        <p className="text-gray-300 mb-4">
          Utilizamos cookies y tecnologías similares para mejorar tu experiencia, analizar el uso 
          del sitio y personalizar el contenido. Puedes controlar el uso de cookies en tu navegador.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">6. Retención de Datos</h2>
        <p className="text-gray-300 mb-4">
          Conservamos tu información personal solo durante el tiempo necesario para cumplir con 
          los propósitos descritos en esta política o según lo requiera la ley.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">7. Tus Derechos</h2>
        <p className="text-gray-300 mb-4">
          Tienes derecho a acceder, corregir, eliminar o restringir el procesamiento de tu 
          información personal. También puedes retirar tu consentimiento en cualquier momento.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">8. Transferencias Internacionales</h2>
        <p className="text-gray-300 mb-4">
          Tu información puede ser transferida y procesada en países diferentes al tuyo. 
          Nos aseguramos de que estas transferencias cumplan con las leyes de protección de datos aplicables.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">9. Cambios en esta Política</h2>
        <p className="text-gray-300 mb-4">
          Podemos actualizar esta política de privacidad ocasionalmente. Te notificaremos sobre 
          cambios significativos y publicaremos la versión actualizada en nuestra plataforma.
        </p>

        <h2 className="text-2xl font-semibold text-white mb-4">10. Contacto</h2>
        <p className="text-gray-300 mb-4">
          Si tienes preguntas sobre esta política de privacidad o sobre cómo manejamos tu información, 
          contáctanos a través de nuestra plataforma.
        </p>

        <p className="text-sm text-gray-400 mt-8">
          Última actualización: {new Date().toLocaleDateString('es-ES')}
        </p>
      </div>
    </div>
  );
}
