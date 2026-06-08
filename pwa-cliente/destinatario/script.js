/**
 * PROTOCOLO MACONDO - CONTROL TERMINAL DESTINATARIO
 */

setInterval(() => {
  const txtReloj = document.getElementById('reloj-nodo');
  if (txtReloj) {
    txtReloj.innerText = new Date().toISOString().split('T')[1].substring(0, 8) + ' UTC_NODE';
  }
}, 1000);

function buscarContratoEntrante() {
  const idContrato = document.getElementById('id-contrato-buscar').value.trim();
  
  if (!idContrato) {
    alert(">>> ERROR: INGRESE UN HASH DE CONTRATO VÁLIDO.");
    return;
  }

  // Simulación de consulta a la pool local de XAMPP
  document.getElementById('txt-id-activo').innerText = idContrato.toUpperCase();
  document.getElementById('panel-estado-entrega').style.display = 'block';
  
  // Generación matemática determinista de la llave de cierre (Token efímero)
  // En producción, esto deriva de la firma asíncrona PGP del destinatario
  const tokenDerivado = "MCD-" + Math.random().toString(36).substring(2, 7).toUpperCase() + "-SIG";
  document.getElementById('token-display').innerText = tokenDerivado;
}