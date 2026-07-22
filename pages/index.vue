<template>
  <div class="login-container">
    <div class="login-content">
      <!-- Left Column: Login Form -->
      <div class="login-left">
        <div class="login-form-wrapper">
          <div class="brand-header d-flex align-center">
            <v-img src="@/assets/img/logoinv.png" max-width="250" class="mt-1" />
          </div>

          <div class="login-card">
            <VForm @submit.prevent="submit" class="login-form">
              <div class="mb-0">
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


            </VForm>
          </div>
        </div>
      </div>

      <!-- Right Column: Visual -->
      <div class="login-right hidden-md-and-down">
        <div class="brain-visual">
          <v-img src="@/assets/img/futuristic_brain_login.jpeg" cover class="h-100 w-100"></v-img>
          <!-- Overlay removed to match reference pure image look -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { isSuperAdmin, getDashboardPathByCompanyId } from '@/utils/permissions';
const client = useSupabaseClient();
const router = useRouter();
const { logActivity } = useActivityLogger();

// ... existing state ref ...
const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");

// ... existing rules ...
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
          role: profileData?.role || 'authenticated',
          company_id: profileData?.company_id
        };
      }
    } else {
      console.log("Login nativo falló, intentando RPC legacy...");

      // 2. Si falla Auth nativo, intentar validar con el sistema antiguo (RPC) O API
      console.log("Login nativo falló, intentando verificación legacy...");

      let legacyUser = null;

      // Intentar primero con RPC (por compatibilidad histórica estricta)
      const { data: rpcResult, error: rpcError } = await client.rpc('login_dashboard', {
        p_email: email.value,
        p_password: password.value
      });

      if (rpcResult) {
        legacyUser = rpcResult;
      } else {
        console.log("RPC falló o devolvió null. Intentando verificación API Manual (bcrypt)...");
        try {
          const apiRes = await $fetch('/api/auth/verify-legacy', {
            method: 'POST',
            body: { email: email.value, password: password.value }
          });

          if (apiRes && apiRes.success && apiRes.user) {
            console.log("Verificación API manual exitosa");
            legacyUser = apiRes.user;
          }
        } catch (errApi) {
          console.error("API Legacy check failed:", errApi);
        }
      }

      if (legacyUser) {
        console.log("Login legacy exitoso. Intentando descripción finalSession...");
        finalSession = legacyUser;

        // 3. MIGRACION AUTOMÁTICA (Auto-SignUp)
        // Intentamos registrar al usuario en Auth para que la próxima entre directo
        const { data: signUpData, error: signUpError } = await client.auth.signUp({
          email: email.value,
          password: password.value,
          options: {
            data: {
              full_name: legacyUser.nombre || legacyUser.full_name
            }
          }
        });

        if (!signUpError && signUpData?.session) {
          console.log("Auto-migration to Supabase Auth success");
          await client.auth.setSession(signUpData.session);
        } else {
          console.warn("Auto-migration skipped or failed:", signUpError);
        }

      } else {
        throw new Error("Credenciales incorrectas");
      }
    }

    if (finalSession) {
      // Ensure company_id and role are loaded if missing (Safety check for RPC)
      if ((!finalSession.company_id || !finalSession.role) && finalSession.email) {
        const { data: profileData } = await client
          .from('dashboardlogin')
          .select('company_id, role')
          .eq('email', finalSession.email)
          .single();

        if (profileData) {
          console.log("Profile data fetched separately:", profileData);
          if (!finalSession.company_id) finalSession.company_id = profileData.company_id;
          if (!finalSession.role) finalSession.role = profileData.role;
        }
      }

      // Login exitoso
      const userSession = useCookie('dashboard_session');
      userSession.value = finalSession;
      
      // Registrar la actividad de inicio de sesión
      logActivity('Inició sesión');

      // Redirigir según el correo y ROL
      // const emailLower = email.value.toLowerCase(); // Ya no dependemos del email para la logica
      const userRole = finalSession?.role?.toLowerCase();
      const companyId = finalSession?.company_id;

      console.log("Login User Role:", userRole);
      console.log("Login Company ID:", companyId);

      // 1. SUPERADMIN -> Hub (Access to everything)
      if (userRole === 'superadmin') {
        console.log("Redirecting Superadmin to Hub");
        router.push('/admin-hub');
        return;
      }

      // 2. ADMIN or AGENT -> Specific Company Dashboard
      if (companyId && (userRole === 'admin' || userRole === 'agent' || userRole === 'agente')) {
        const targetPath = getDashboardPathByCompanyId(companyId)
        if (targetPath && targetPath !== '/') {
          console.log(`Redirecting ${userRole} to ${targetPath}`);
          router.push(targetPath)
          return
        }
      }

      // 3. Fallback General
      alert("No se encontró un dashboard asignado a este usuario.");

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
