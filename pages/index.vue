<template>
  <div class="login-container">
    <div class="login-content">
      <!-- Left Column: Login Form -->
      <div class="login-left">
        <div class="login-form-wrapper">
          <div class="brand-header mb-8 d-flex align-center">
            <v-img src="@/assets/img/Aleflogo.png" max-width="60" class="mr-3" />
            <h1 class="brand-title">Alef Company</h1>
          </div>

          <div class="login-card">
            <VForm @submit.prevent="submit" class="login-form">
              <div class="mb-4">
                <VTextField v-model="email" placeholder="Email" variant="outlined" bg-color="transparent"
                  class="custom-input" hide-details="auto" :rules="[ruleRequired, ruleEmail]"></VTextField>
              </div>

              <div class="mb-6">
                <VTextField v-model="password" placeholder="Contraseña" type="password" variant="outlined"
                  bg-color="transparent" class="custom-input" hide-details="auto" :rules="[ruleRequired, rulePassLen]">
                </VTextField>
              </div>

              <VBtn type="submit" block height="50" class="neon-btn mb-6" :loading="loading">
                INICIAR SESIÓN
              </VBtn>

              <div class="text-center">
                <NuxtLink to="/reset-password" class="text-caption text-grey-lighten-1 text-decoration-none">¿Olvidaste
                  tu
                  contraseña?</NuxtLink>
              </div>

              <div class="text-center mt-4">
                <span class="text-caption text-grey-darken-1">¿No tienes una cuenta? <NuxtLink to="/signup"
                    class="text-white font-weight-bold text-decoration-none">Regístrate</NuxtLink></span>
              </div>
            </VForm>
          </div>
        </div>
      </div>

      <!-- Right Column: Visual -->
      <div class="login-right hidden-md-and-down">
        <div class="brain-visual">
          <v-img src="@/assets/img/futuristic_brain_login.png" cover class="h-100 w-100"></v-img>
          <!-- Overlay removed to match reference pure image look -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const client = useSupabaseClient();
const router = useRouter();

// Estado del formulario
const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");

// Reglas de validación
const ruleRequired = (v) => !!v || 'Requerido';
const ruleEmail = (v) => /.+@.+\..+/.test(v) || 'Email inválido';
const rulePassLen = (v) => (v && v.length >= 6) || 'Mínimo 6 caracteres';

const submit = async () => {
  loading.value = true;
  errorMsg.value = "";

  try {
    let finalSession = null;
    let authSession = null;

    // 1. Intentar Autenticación Nativa (Supabase Auth)
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email: email.value,
      password: password.value
    });

    if (!authError && authData?.user) {
      console.log("Login nativo exitoso");
      authSession = authData.user;

      // Obtener datos adicionales del perfil si es necesario
      const { data: rpcData } = await client.rpc('login_dashboard', {
        p_email: email.value,
        p_password: password.value
      });

      if (rpcData) {
        finalSession = rpcData;
      } else {
        // Fallback perfil
        const { data: profileData } = await client
          .from('dashboardlogin')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        finalSession = {
          id: authData.user.id,
          email: authData.user.email,
          full_name: profileData?.full_name || profileData?.nombre || 'Usuario Verificado',
          role: profileData?.role || 'authenticated'
        };
      }
    } else {
      console.log("Login nativo falló, intentando RPC legacy...");

      // 2. Si falla Auth nativo, intentar validar con el sistema antiguo (RPC)
      const { data: rpcData, error: rpcError } = await client.rpc('login_dashboard', {
        p_email: email.value,
        p_password: password.value
      });

      if (rpcData) {
        console.log("RPC legacy exitoso. Intentando migración automática a Supabase Auth...");
        finalSession = rpcData;

        // 3. MIGRACION AUTOMÁTICA (Auto-SignUp)
        const { data: signUpData, error: signUpError } = await client.auth.signUp({
          email: email.value,
          password: password.value,
          options: {
            data: {
              full_name: rpcData.nombre || rpcData.full_name
            }
          }
        });

        if (!signUpError && signUpData?.session) {
          await client.auth.setSession(signUpData.session);
        }

      } else {
        throw new Error("Credenciales incorrectas");
      }
    }

    if (finalSession) {
      // Login exitoso
      const userSession = useCookie('dashboard_session');
      userSession.value = finalSession;

      // Redirigir según el correo
      const emailLower = email.value.toLowerCase();

      if (emailLower === "bazanjuanpa@gmail.com") {
        router.push('/pruebas/HealUp');
      } else if (emailLower === "elroby75@hotmail.com") {
        router.push('/pruebas/BradaPerfumes');
      } else {
        router.push('/pruebas/AlefCompany');
      }
    } else {
      alert("No se pudo iniciar sesión. Verifique sus credenciales.");
    }

  } catch (e) {
    console.error("Login Error:", e);
    let msg = "Error de inicio de sesión";
    if (e.message.includes("Invalid login credentials")) msg = "Credenciales inválidas";
    else if (e.message) msg = e.message;

    alert(msg);
  } finally {
    loading.value = false;
  }
};
</script>
