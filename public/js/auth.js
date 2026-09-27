// Manejo de Autenticación y Sesión del Sistema Contable

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const alertContainer = document.getElementById('alertContainer');
  const btnQuickAdmin = document.getElementById('btnQuickAdmin');
  const btnQuickContador = document.getElementById('btnQuickContador');

  // Si ya hay usuario logueado en la página de login, redirigir a dashboard
  if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    const session = getSession();
    if (session) {
      window.location.href = 'dashboard.html';
    }
  }

  // Botones de acceso rápido
  if (btnQuickAdmin) {
    btnQuickAdmin.addEventListener('click', () => {
      document.getElementById('email').value = 'admin@contable.com';
      document.getElementById('password').value = 'admin123';
    });
  }

  if (btnQuickContador) {
    btnQuickContador.addEventListener('click', () => {
      document.getElementById('email').value = 'contador@contable.com';
      document.getElementById('password').value = 'conta123';
    });
  }

  // Envío del formulario de login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAlert('', 'clear');

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
          saveSession(data.usuario);
          showAlert('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 800);
        } else {
          showAlert(data.message || 'Error al iniciar sesión.', 'danger');
        }
      } catch (error) {
        console.error('Error de login:', error);
        showAlert('No se pudo conectar con el servidor backend.', 'danger');
      }
    });
  }
});

// Guardar datos de usuario en localStorage
function saveSession(usuario) {
  localStorage.setItem('usuario_contable', JSON.stringify(usuario));
}

// Obtener datos de la sesión actual (Por defecto Administrador en modo Escritorio)
function getSession() {
  const data = localStorage.getItem('usuario_contable');
  if (data) {
    try { return JSON.parse(data); } catch(e){}
  }
  const defaultUser = {
    id: 1,
    nombre: 'Administrador',
    email: 'admin@contable.com',
    rol_id: 1,
    rol_nombre: 'Administrador'
  };
  localStorage.setItem('usuario_contable', JSON.stringify(defaultUser));
  return defaultUser;
}

// Reiniciar sesión en escritorio (Redirige a Dashboard)
function logout() {
  localStorage.removeItem('usuario_contable');
  window.location.href = 'dashboard.html';
}

// Cerrar Aplicación de Escritorio
function cerrarAplicacion() {
  if (confirm('¿Deseas salir y cerrar la aplicación contable?')) {
    try {
      window.close();
    } catch(e) {
      console.log('Cierre de ventana');
    }
  }
}

// Mostrar alertas dinámicas
function showAlert(message, type = 'info') {
  const container = document.getElementById('alertContainer');
  if (!container) return;

  if (type === 'clear') {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

// Verificar sesión requerida en páginas protegidas
function checkAuthRequirement() {
  const session = getSession();
  
  // Actualizar nombre de usuario y rol en el Navbar si existen los elementos
  const navUserEl = document.getElementById('navUserName');
  const navRoleEl = document.getElementById('navUserRole');

  if (navUserEl) navUserEl.textContent = session.nombre || 'Administrador';
  if (navRoleEl) {
    navRoleEl.textContent = session.rol_nombre || 'Administrador';
    navRoleEl.className = 'badge bg-danger ms-2';
  }

  return session;
}
