<template>
  <div class="form-sheet">
    <!-- ══════════ Barra de estado de la hoja ══════════ -->
    <div class="fs-barra">
      <div class="fs-barra-info">
        <template v-if="resp?.configurado && !resp?.error && hoja">
          <v-chip size="small" color="success" variant="tonal" prepend-icon="mdi-google-spreadsheet">
            {{ hoja.titulo || 'Hoja de Google' }}<template v-if="hoja.pestana"> · {{ hoja.pestana }}</template>
          </v-chip>
          <span class="fs-vivo"><span class="fs-punto" /> En vivo · leído a las {{ horaLectura }}</span>
        </template>
        <span v-else-if="cargando && !resp" class="fs-vivo">Leyendo la hoja…</span>
      </div>
      <div class="fs-barra-acciones">
        <v-btn v-if="resp?.es_admin" size="small" variant="tonal" prepend-icon="mdi-link-variant"
          @click="abrirConexion">Conectar hoja</v-btn>
        <button class="btn-primary" :disabled="cargando" @click="cargar()">
          <v-icon :icon="cargando ? 'mdi-loading' : 'mdi-refresh'" size="16" :class="{ 'fs-girar': cargando }" />
          <span>Actualizar</span>
        </button>
      </div>
    </div>

    <!-- ══════════ Sin hoja conectada ══════════ -->
    <div v-if="resp && !resp.configurado" class="fs-aviso">
      <v-icon icon="mdi-google-spreadsheet" size="46" />
      <h3>{{ etiqueta }} todavía no está conectado a su Google Sheet</h3>
      <p>
        Los leads de este canal los vuelca Zapier en una hoja de Google. Al conectarla, aparecerán aquí como
        tarjetas y se actualizarán solos cada vez que abras este módulo.
      </p>
      <v-btn v-if="resp.es_admin" color="primary" variant="flat" prepend-icon="mdi-link-variant"
        @click="abrirConexion">Conectar hoja</v-btn>
      <small v-else>Pídele a un administrador de Trade Cars que conecte la hoja.</small>
    </div>

    <!-- ══════════ Hoja conectada pero con un problema ══════════ -->
    <div v-else-if="resp?.error" class="fs-aviso fs-aviso--error">
      <v-icon :icon="iconoError" size="46" />
      <h3>{{ tituloError }}</h3>
      <p>{{ resp.error.mensaje }}</p>
      <div class="fs-aviso-botones">
        <v-btn v-if="resp.es_admin && (resp.error.causa === 'sin_google' || resp.error.causa === 'token')"
          color="primary" variant="flat" prepend-icon="mdi-google" href="/api/tradecars/google-auth">
          {{ resp.error.causa === 'token' ? 'Reconectar Google' : 'Conectar Google' }}
        </v-btn>
        <v-btn v-if="resp.es_admin" variant="tonal" prepend-icon="mdi-link-variant" @click="abrirConexion">
          Revisar la conexión
        </v-btn>
        <v-btn variant="text" prepend-icon="mdi-refresh" @click="cargar()">Reintentar</v-btn>
      </div>
      <small v-if="!resp.es_admin">Avísale a un administrador de Trade Cars.</small>
    </div>

    <!-- ══════════ No se pudo ni llegar al servidor ══════════ -->
    <div v-else-if="errorRed" class="fs-aviso fs-aviso--error">
      <v-icon icon="mdi-cloud-alert-outline" size="46" />
      <h3>No se pudo cargar {{ etiqueta }}</h3>
      <p>{{ errorRed }}</p>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="cargar()">Reintentar</v-btn>
    </div>

    <!-- ══════════ Tarjetas ══════════ -->
    <template v-else-if="resp?.configurado">
      <v-alert v-if="resp.tabla_estado_disponible === false" type="warning" variant="tonal" density="compact" class="mb-3">
        Falta correr <code>sql/tradecars_formularios_sheets.sql</code> en Supabase: mientras tanto se ven los leads
        pero no se puede guardar su estado ni sus notas.
      </v-alert>
      <v-alert v-if="resp.truncado" type="info" variant="tonal" density="compact" class="mb-3">
        La hoja tiene {{ resp.total }} leads; se muestran los {{ tarjetas.length }} más recientes.
      </v-alert>

      <div class="sol-toolbar">
        <div class="sol-filtros">
          <v-chip v-for="e in ['todos', ...ESTADOS_FORMULARIO]" :key="e" size="small"
            :variant="estadoFiltro === e ? 'flat' : 'tonal'"
            :color="estadoFiltro === e ? colorEstado(e) : undefined"
            style="cursor: pointer; text-transform: capitalize;" @click="estadoFiltro = e">
            {{ e }}
            <span v-if="e !== 'todos'" style="margin-left:5px; opacity:.75;">{{ contarEstado(e) }}</span>
          </v-chip>
        </div>
        <v-text-field v-model="busqueda" prepend-inner-icon="mdi-magnify"
          placeholder="Buscar nombre, celular, correo, placa…" density="compact" hide-details
          style="max-width: 320px;" />
      </div>

      <div v-if="tarjetasFiltradas.length" class="sol-grid">
        <v-card v-for="s in tarjetasFiltradas" :key="s.lead_key" class="sol-card"
          :class="{ 'sol-card--open': expandida === s.lead_key }" @click="alternar(s)">

          <div class="sol-card-head">
            <v-avatar :color="colorCanal" size="38" variant="tonal">
              <v-icon :icon="iconoCanal" size="20" />
            </v-avatar>
            <div class="sol-card-ident">
              <div class="sol-card-nombre">{{ s.nombre || 'Sin nombre' }}</div>
              <div class="sol-card-fecha">{{ formatFecha(s.fecha) }}</div>
            </div>
            <v-chip :color="colorEstado(s.estado)" size="small" variant="flat" style="text-transform: capitalize;">
              {{ s.estado }}
            </v-chip>
          </div>

          <div class="sol-card-resumen">
            <div v-if="tieneVehiculo(s)" class="sol-veh">
              <v-icon icon="mdi-car" size="15" />
              <strong>{{ [s.marca, s.modelo].filter(Boolean).join(' ') || 'Vehículo sin especificar' }}</strong>
              <span v-if="s.anio">· {{ s.anio }}</span>
            </div>
            <div class="sol-meta">
              <span v-if="s.placa"><v-icon icon="mdi-card-text-outline" size="13" /> {{ s.placa }}</span>
              <span v-if="s.kilometraje !== null"><v-icon icon="mdi-speedometer" size="13" /> {{ s.kilometraje.toLocaleString('es-PE') }} km</span>
              <span v-if="s.distrito"><v-icon icon="mdi-map-marker" size="13" /> {{ s.distrito }}</span>
              <span v-if="!tieneVehiculo(s) && s.celular"><v-icon icon="mdi-phone" size="13" /> {{ s.celular }}</span>
              <span v-if="!tieneVehiculo(s) && s.correo"><v-icon icon="mdi-email-outline" size="13" /> {{ s.correo }}</span>
              <span v-if="s.campana" class="fs-campana"><v-icon icon="mdi-bullhorn-outline" size="13" /> {{ s.campana }}</span>
            </div>
            <div v-if="s.fuera_de_hoja" class="fs-fuera">
              <v-icon icon="mdi-alert-outline" size="13" /> Esta fila ya no está en la hoja
            </div>
            <div v-if="s.mensaje && expandida !== s.lead_key" class="sol-msg-preview">"{{ s.mensaje }}"</div>
          </div>

          <v-expand-transition>
            <div v-if="expandida === s.lead_key" class="sol-card-detalle" @click.stop>
              <v-divider class="mb-3" />

              <div class="sol-campos">
                <div class="sol-campo"><span>Nombre</span><strong>{{ s.nombre || '—' }}</strong></div>
                <div class="sol-campo"><span>Celular</span><strong>{{ s.celular || '—' }}</strong></div>
                <div class="sol-campo"><span>Correo</span><strong>{{ s.correo || '—' }}</strong></div>
                <div v-if="s.marca" class="sol-campo"><span>Marca</span><strong>{{ s.marca }}</strong></div>
                <div v-if="s.modelo" class="sol-campo"><span>Modelo</span><strong>{{ s.modelo }}</strong></div>
                <div v-if="s.anio" class="sol-campo"><span>Año</span><strong>{{ s.anio }}</strong></div>
                <div v-if="s.placa" class="sol-campo"><span>Placa</span><strong>{{ s.placa }}</strong></div>
                <div v-if="s.kilometraje !== null" class="sol-campo"><span>Kilometraje</span><strong>{{ s.kilometraje.toLocaleString('es-PE') }} km</strong></div>
                <div v-if="s.distrito" class="sol-campo"><span>Distrito</span><strong>{{ s.distrito }}</strong></div>
                <div v-if="s.tiene_deuda" class="sol-campo">
                  <span>¿Tiene deuda?</span>
                  <strong :style="{ color: s.tiene_deuda === 'si' ? '#e53935' : undefined }">
                    {{ s.tiene_deuda === 'si' ? 'Sí' : s.tiene_deuda === 'no' ? 'No' : s.tiene_deuda }}
                  </strong>
                </div>
                <div class="sol-campo"><span>Origen</span><strong>{{ etiqueta }}</strong></div>
                <div v-if="s.campana" class="sol-campo"><span>Campaña</span><strong>{{ s.campana }}</strong></div>
                <div v-if="s.fila" class="sol-campo"><span>Fila en la hoja</span><strong>{{ s.fila }}</strong></div>
              </div>

              <!-- Preguntas propias del formulario que no se reconocieron: nada se descarta -->
              <template v-if="s.extras.length">
                <div class="sol-mensaje-label" style="margin-top:14px;">Otros datos del formulario</div>
                <div class="sol-campos">
                  <div v-for="x in s.extras" :key="x.campo" class="sol-campo">
                    <span>{{ x.campo }}</span><strong>{{ x.valor }}</strong>
                  </div>
                </div>
              </template>

              <div v-if="s.mensaje" class="sol-mensaje">
                <div class="sol-mensaje-label">Mensaje del cliente</div>
                <div>{{ s.mensaje }}</div>
              </div>

              <div style="margin-top: 12px;">
                <v-text-field v-model.number="borrador.precio_ofrecido" type="number" label="Precio ofrecido (S/)"
                  density="compact" hide-details prepend-inner-icon="mdi-cash" style="max-width: 240px;"
                  :disabled="!puedeGuardar" />
              </div>

              <v-textarea v-model="borrador.notas" label="Notas internas" rows="2" density="compact" hide-details
                class="mt-3" auto-grow :disabled="!puedeGuardar" />

              <div class="sol-acciones">
                <v-select v-model="borrador.estado" :items="ESTADOS_FORMULARIO" label="Estado" density="compact"
                  hide-details style="max-width: 170px; text-transform: capitalize;" :disabled="!puedeGuardar" />
                <v-btn color="primary" variant="flat" size="small" :loading="guardando" :disabled="!puedeGuardar"
                  @click="guardar(s)">
                  <v-icon icon="mdi-content-save" start size="16" /> Guardar
                </v-btn>
                <v-btn v-if="s.celular" color="success" variant="tonal" size="small"
                  :href="waLink(s)" target="_blank" @click.stop>
                  <v-icon icon="mdi-whatsapp" start size="16" /> WhatsApp
                </v-btn>
                <v-btn v-if="s.correo" variant="tonal" size="small" :href="`mailto:${s.correo}`" @click.stop>
                  <v-icon icon="mdi-email" start size="16" /> Correo
                </v-btn>
                <v-btn v-if="!s.cliente_id" color="secondary" variant="tonal" size="small"
                  :disabled="!puedeGuardar" @click="crearCliente(s)">
                  <v-icon icon="mdi-account-plus" start size="16" /> Crear cliente
                </v-btn>
                <v-chip v-else size="small" color="secondary" variant="tonal" prepend-icon="mdi-account-check">
                  Cliente creado
                </v-chip>
              </div>
              <small v-if="s.atendido_por" class="fs-atendido">
                Última gestión: {{ s.atendido_por }}<template v-if="s.atendido_en"> · {{ formatFecha(s.atendido_en) }}</template>
              </small>
            </div>
          </v-expand-transition>
        </v-card>
      </div>

      <div v-else class="sol-empty">
        <v-icon icon="mdi-inbox-outline" size="44" />
        <p v-if="tarjetas.length">No hay leads que coincidan con el filtro.</p>
        <p v-else>La hoja no tiene leads todavía.</p>
        <small>Los leads llegan a la hoja desde {{ etiqueta.replace('Formularios ', '') }} a través de Zapier.</small>
      </div>
    </template>

    <!-- Primera carga -->
    <div v-else-if="cargando" class="sol-empty">
      <v-progress-circular indeterminate color="primary" />
      <p>Leyendo la hoja de Google…</p>
    </div>

    <!-- ══════════ Ventana: conectar la hoja ══════════ -->
    <v-dialog v-model="conexion.abierto" max-width="820" scrollable>
      <v-card>
        <v-card-title class="pt-4">
          Conectar la hoja de {{ etiqueta.replace('Formularios ', '') }}
          <div class="fs-sub">Cada canal tiene su propia hoja de Google, donde Zapier guarda los leads.</div>
        </v-card-title>

        <v-card-text>
          <!-- Paso 1: cuenta de Google -->
          <div class="fs-paso">
            <div class="fs-paso-titulo"><span class="fs-num">1</span> Cuenta de Google</div>
            <p class="fs-paso-txt">
              Se conecta <b>una sola vez para los tres canales</b>. Debe ser la cuenta de Google que ve las hojas de
              IG, FB y TikTok (por ejemplo, la del gerente de marketing).
            </p>
            <div class="fs-paso-fila">
              <v-chip v-if="google.cargando" size="small">Revisando…</v-chip>
              <v-chip v-else-if="google.connected && !google.vencido" size="small" color="success" variant="tonal"
                prepend-icon="mdi-check-circle">
                Conectado<template v-if="google.email"> como {{ google.email }}</template>
              </v-chip>
              <v-chip v-else-if="google.vencido" size="small" color="warning" variant="tonal" prepend-icon="mdi-alert">
                La conexión venció
              </v-chip>
              <v-chip v-else size="small" color="grey" variant="tonal" prepend-icon="mdi-link-off">Sin conectar</v-chip>
              <v-btn size="small" :variant="google.connected && !google.vencido ? 'text' : 'flat'"
                :color="google.connected && !google.vencido ? undefined : 'primary'" prepend-icon="mdi-google"
                href="/api/tradecars/google-auth">
                {{ google.connected ? 'Cambiar cuenta' : 'Conectar con Google' }}
              </v-btn>
            </div>
          </div>

          <!-- Paso 2: la hoja -->
          <div class="fs-paso">
            <div class="fs-paso-titulo"><span class="fs-num">2</span> La hoja de este canal</div>
            <p class="fs-paso-txt">
              Abre la hoja en Google, copia la dirección de la barra del navegador y pégala aquí. Si la hoja tiene varias
              pestañas, abre la de los leads antes de copiar (el enlace ya recuerda cuál es), o escribe su nombre abajo.
            </p>
            <v-text-field v-model="conexion.url" label="Enlace de la hoja de Google" density="compact"
              variant="outlined" hide-details prepend-inner-icon="mdi-link-variant"
              placeholder="https://docs.google.com/spreadsheets/d/…" />
            <v-text-field v-model="conexion.pestana" label="Nombre de la pestaña (opcional)" density="compact"
              variant="outlined" hide-details class="mt-3" style="max-width: 320px;" />
            <div class="fs-paso-fila mt-3">
              <v-btn size="small" variant="tonal" prepend-icon="mdi-flask-outline" :loading="conexion.probando"
                :disabled="!conexion.url.trim()" @click="probarConexion">Probar lectura</v-btn>
              <a v-if="resp?.conexion?.url" :href="resp.conexion.url" target="_blank" class="fs-enlace">
                Hoja conectada ahora <v-icon icon="mdi-open-in-new" size="13" />
              </a>
            </div>
          </div>

          <!-- Resultado de la prueba -->
          <v-alert v-if="conexion.prueba && !conexion.prueba.ok" :type="conexion.prueba.causa === 'sin_google' ? 'info' : 'error'"
            variant="tonal" density="compact" class="mt-1">
            {{ conexion.prueba.mensaje }}
          </v-alert>

          <div v-if="conexion.prueba?.ok" class="fs-paso">
            <div class="fs-paso-titulo"><span class="fs-num">3</span> Revisa que las columnas estén bien</div>
            <p class="fs-paso-txt">
              Se leyeron <b>{{ conexion.prueba.total_filas }}</b> filas de «{{ conexion.prueba.hoja?.pestana }}».
              Las columnas se reconocen solas por su nombre; si alguna quedó mal, elígela aquí.
            </p>
            <div class="fs-mapeo">
              <v-select v-for="campo in CAMPOS_FORMULARIO" :key="campo"
                :model-value="columnaDe(campo)" :items="opcionesPara(campo)" :label="ETIQUETA_CAMPO[campo]"
                density="compact" variant="outlined" hide-details
                @update:model-value="(v: string) => elegirColumna(campo, v)" />
            </div>
            <div v-if="conexion.prueba.sin_mapear?.length" class="fs-txt-chico">
              Columnas sin asignar (saldrán como «Otros datos» en cada tarjeta):
              {{ conexion.prueba.sin_mapear.join(', ') }}
            </div>

            <div v-if="conexion.prueba.muestra?.length" class="fs-muestra">
              <div class="sol-mensaje-label">Así se verán las primeras tarjetas</div>
              <div v-for="m in conexion.prueba.muestra" :key="m.lead_key" class="fs-muestra-fila">
                <strong>{{ m.nombre || 'Sin nombre' }}</strong>
                <span>{{ m.celular || 'sin celular' }}</span>
                <span>{{ m.correo || 'sin correo' }}</span>
                <span>{{ [m.marca, m.modelo, m.anio].filter(Boolean).join(' ') || 'sin vehículo' }}</span>
                <span>{{ formatFecha(m.fecha) }}</span>
              </div>
            </div>
            <v-btn size="small" variant="text" prepend-icon="mdi-refresh" class="mt-2" :loading="conexion.probando"
              @click="probarConexion">Volver a probar con estos cambios</v-btn>
          </div>
        </v-card-text>

        <v-card-actions style="padding: 8px 20px 18px;">
          <v-btn v-if="resp?.configurado" color="error" variant="text" :loading="conexion.guardando"
            @click="desconectar">Desconectar hoja</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="conexion.abierto = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="conexion.guardando" :disabled="!conexion.url.trim()"
            @click="guardarConexion">Guardar conexión</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Tarjetas de los formularios de Instagram / Facebook / TikTok.
 *
 * Misma interfaz que "Solicitudes web" (tarjetas expandibles con estado, notas, WhatsApp, correo y
 * "Crear cliente"), pero los leads salen de un Google Sheet por canal, leído EN VIVO:
 *   · al abrir el submódulo,
 *   · al tocar "Actualizar",
 *   · al volver a esta pestaña del navegador,
 *   · y cada minuto mientras se está mirando (se pausa si hay una tarjeta abierta, para no
 *     pisar lo que alguien está escribiendo).
 *
 * La hoja es de solo lectura: el estado/notas/precio de cada tarjeta se guardan en Supabase
 * (POST /api/tradecars/formularios), atados al lead por una clave estable, no por el n.º de fila.
 */
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'
import {
  CANALES_FORMULARIO, CAMPOS_FORMULARIO, ETIQUETA_CAMPO, ESTADOS_FORMULARIO,
  type CanalFormulario,
} from '@/utils/tradecarsFormularios'

const props = defineProps<{ canal: CanalFormulario }>()
const emit = defineEmits<{
  (e: 'notificar', texto: string, color?: string): void
  (e: 'cliente-creado'): void
}>()

const client = useSupabaseClient()
const etiqueta = computed(() => CANALES_FORMULARIO[props.canal].etiqueta)
const notify = (t: string, c = 'success') => emit('notificar', t, c)

/* ── Apariencia por canal ── */
const iconoCanal = computed(() => ({ ig: 'mdi-instagram', fb: 'mdi-facebook', tiktok: 'mdi-music-note' }[props.canal]))
const colorCanal = computed(() => ({ ig: 'pink', fb: 'info', tiktok: 'cyan' }[props.canal]))
function colorEstado(e: string) {
  const m: Record<string, string> = {
    nuevo: 'info', contactado: 'warning', tasado: 'purple', comprado: 'success', descartado: 'error', todos: 'primary',
  }
  return m[e] || 'grey'
}

/* ── Carga en vivo ── */
const resp = ref<any>(null)
const cargando = ref(false)
const errorRed = ref('')

const tarjetas = computed<any[]>(() => resp.value?.tarjetas ?? [])
const hoja = computed(() => resp.value?.hoja ?? null)
const horaLectura = computed(() => {
  const d = new Date(resp.value?.actualizado_en || Date.now())
  return d.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

async function cargar(silencioso = false) {
  if (cargando.value) return
  cargando.value = true
  if (!silencioso) errorRed.value = ''
  try {
    resp.value = await $fetch<any>('/api/tradecars/formularios', { query: { canal: props.canal }, cache: 'no-store' })
    errorRed.value = ''
  } catch (e: any) {
    // En una actualización silenciosa no se tapa lo que ya se ve con un error de red pasajero
    if (!silencioso || !resp.value) errorRed.value = e?.data?.statusMessage || e?.message || 'Error de red'
  } finally {
    cargando.value = false
  }
}

let timer: any = null
const alVolver = () => { if (document.visibilityState === 'visible' && !expandida.value && !conexion.abierto) cargar(true) }
onMounted(() => {
  cargar()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && !expandida.value && !conexion.abierto) cargar(true)
  }, 60_000)
  window.addEventListener('focus', alVolver)
  document.addEventListener('visibilitychange', alVolver)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('focus', alVolver)
  document.removeEventListener('visibilitychange', alVolver)
})

const iconoError = computed(() => ({
  sin_google: 'mdi-google', token: 'mdi-key-alert-outline', sin_acceso: 'mdi-lock-alert-outline',
  no_encontrada: 'mdi-file-question-outline',
}[resp.value?.error?.causa as string] || 'mdi-alert-circle-outline'))
const tituloError = computed(() => ({
  sin_google: 'Falta conectar Google',
  token: 'La conexión con Google venció',
  sin_acceso: 'La cuenta conectada no ve esta hoja',
  no_encontrada: 'No se encuentra la hoja o la pestaña',
}[resp.value?.error?.causa as string] || 'No se pudo leer la hoja'))

/* ── Filtros ── */
const estadoFiltro = ref('todos')
const busqueda = ref('')
const contarEstado = (e: string) => tarjetas.value.filter(s => s.estado === e).length
const tarjetasFiltradas = computed(() => {
  let lista = tarjetas.value
  if (estadoFiltro.value !== 'todos') lista = lista.filter(s => s.estado === estadoFiltro.value)
  const q = busqueda.value.trim().toLowerCase()
  if (q) {
    lista = lista.filter(s =>
      [s.nombre, s.celular, s.correo, s.placa, s.marca, s.modelo, s.distrito, s.campana]
        .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

/* ── Helpers de presentación ── */
function formatFecha(v: any) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
const tieneVehiculo = (s: any) => !!(s.marca || s.modelo || s.anio || s.placa)

function waLink(s: any) {
  const tel = String(s.celular || '').replace(/\D/g, '')
  const num = tel.length === 9 ? `51${tel}` : tel
  const auto = [s.marca, s.modelo].filter(Boolean).join(' ')
  const msg = auto
    ? `Hola ${s.nombre}, te escribimos de Trade Cars Perú por tu ${auto} que deseas vender.`
    : `Hola ${s.nombre}, te escribimos de Trade Cars Perú por tu consulta.`
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

/* ── Tarjeta abierta y sus cambios (borrador local hasta tocar Guardar) ── */
const expandida = ref<string | null>(null)
const borrador = reactive<{ estado: string; notas: string; precio_ofrecido: number | null }>({
  estado: 'nuevo', notas: '', precio_ofrecido: null,
})
const guardando = ref(false)
const puedeGuardar = computed(() => resp.value?.puede_editar === true && resp.value?.tabla_estado_disponible !== false)

function alternar(s: any) {
  if (expandida.value === s.lead_key) { expandida.value = null; return }
  expandida.value = s.lead_key
  borrador.estado = s.estado || 'nuevo'
  borrador.notas = s.notas || ''
  borrador.precio_ofrecido = s.precio_ofrecido
}

const resumenDe = (s: any) => ({
  nombre: s.nombre, celular: s.celular, correo: s.correo, fecha: s.fecha, marca: s.marca, modelo: s.modelo, placa: s.placa,
})

function aplicar(s: any, t: any) {
  s.estado = t.estado || 'nuevo'
  s.notas = t.notas
  s.precio_ofrecido = t.precio_ofrecido === null || t.precio_ofrecido === undefined ? null : Number(t.precio_ofrecido)
  s.cliente_id = t.cliente_id
  s.atendido_por = t.atendido_por
  s.atendido_en = t.atendido_en
}

async function guardar(s: any) {
  guardando.value = true
  try {
    const r = await $fetch<any>('/api/tradecars/formularios', {
      method: 'POST',
      body: {
        accion: 'guardar', canal: props.canal, lead_key: s.lead_key,
        estado: borrador.estado, notas: borrador.notas,
        precio_ofrecido: borrador.precio_ofrecido === null || (borrador.precio_ofrecido as any) === '' ? null : borrador.precio_ofrecido,
        resumen: resumenDe(s),
      },
    })
    aplicar(s, r.tarjeta)
    notify('Tarjeta actualizada')
  } catch (e: any) {
    notify(e?.data?.statusMessage || e?.message || 'No se pudo guardar', 'error')
  } finally {
    guardando.value = false
  }
}

/** Crea un cliente en el CRM a partir de la tarjeta (igual que en Solicitudes web) y la marca como contactada. */
async function crearCliente(s: any) {
  const conVehiculo = tieneVehiculo(s)
  const payload: Record<string, any> = {
    tipo: conVehiculo ? 'vendedor' : 'comprador',
    nombre_completo: s.nombre || 'Sin nombre',
    telefono: s.celular || null,
    correo: s.correo || null,
    distrito: s.distrito || null,
    canal: ({ ig: 'instagram', fb: 'facebook', tiktok: 'tiktok' } as const)[props.canal],
    estado: 'contactado',
    notas: s.mensaje || null,
  }
  if (conVehiculo) {
    payload.vehiculo_marca = s.marca || null
    payload.vehiculo_modelo = s.modelo || null
    payload.vehiculo_anio = s.anio || null
    payload.vehiculo_placa = s.placa || null
    payload.vehiculo_km = s.kilometraje ?? null
    payload.tiene_deuda = s.tiene_deuda === 'si'
  }
  const { data, error } = await (client.from('tradecars_clientes') as any).insert(payload).select('id').single()
  if (error) { notify('Error creando cliente: ' + error.message, 'error'); return }

  try {
    const r = await $fetch<any>('/api/tradecars/formularios', {
      method: 'POST',
      body: { accion: 'guardar', canal: props.canal, lead_key: s.lead_key, cliente_id: data?.id, estado: 'contactado', resumen: resumenDe(s) },
    })
    aplicar(s, r.tarjeta)
    borrador.estado = s.estado
    notify('Cliente creado desde el formulario')
    emit('cliente-creado')
  } catch (e: any) {
    notify('Se creó el cliente, pero no se pudo marcar la tarjeta: ' + (e?.data?.statusMessage || e?.message), 'error')
    emit('cliente-creado')
  }
}

/* ══════════════════════════ Ventana "Conectar hoja" ══════════════════════════ */
const conexion = reactive<{
  abierto: boolean; url: string; pestana: string; probando: boolean; guardando: boolean
  prueba: any
  /** Correcciones a la detección automática: campo → encabezado de la hoja ('' = ninguna columna). */
  correcciones: Record<string, string>
}>({ abierto: false, url: '', pestana: '', probando: false, guardando: false, prueba: null, correcciones: {} })
const google = reactive<{ cargando: boolean; connected: boolean; email?: string; vencido?: boolean }>({
  cargando: false, connected: false,
})

const NINGUNA = '— ninguna —'

/** Columna que hoy tiene asignado un campo: lo corregido a mano, y si no, lo que detectó el servidor. */
function columnaDe(campo: string): string {
  if (campo in conexion.correcciones) return conexion.correcciones[campo] || NINGUNA
  return conexion.prueba?.mapeo?.[campo] || NINGUNA
}
function opcionesPara(campo: string): string[] {
  const base: string[] = [NINGUNA, ...(conexion.prueba?.encabezados ?? [])]
  const actual = columnaDe(campo)
  // "Nombres|Apellidos" (dos columnas juntas) no es un encabezado suelto, pero tiene que poder mostrarse
  return base.includes(actual) ? base : [...base, actual]
}
function elegirColumna(campo: string, valor: string) {
  conexion.correcciones = { ...conexion.correcciones, [campo]: valor === NINGUNA ? '' : valor }
}

async function abrirConexion() {
  conexion.abierto = true
  conexion.url = resp.value?.conexion?.url || ''
  conexion.pestana = resp.value?.conexion?.pestana || ''
  conexion.prueba = null
  // Lo que ya se había corregido antes se conserva: guardar de nuevo no debe borrarlo
  conexion.correcciones = { ...(resp.value?.conexion?.mapeo_guardado || {}) }
  google.cargando = true
  try {
    const r = await $fetch<any>('/api/tradecars/google-status', { cache: 'no-store' })
    google.connected = !!r.connected; google.email = r.email; google.vencido = !!r.vencido
  } catch { google.connected = false } finally { google.cargando = false }
}

async function probarConexion() {
  conexion.probando = true
  try {
    const r = await $fetch<any>('/api/tradecars/formularios', {
      method: 'POST',
      body: { accion: 'probar', canal: props.canal, url: conexion.url, pestana: conexion.pestana, mapeo: conexion.correcciones },
    })
    conexion.prueba = r.prueba
  } catch (e: any) {
    conexion.prueba = { ok: false, causa: 'otro', mensaje: e?.data?.statusMessage || e?.message || 'No se pudo probar' }
  } finally {
    conexion.probando = false
  }
}

async function guardarConexion() {
  conexion.guardando = true
  try {
    const r = await $fetch<any>('/api/tradecars/formularios', {
      method: 'POST',
      body: { accion: 'configurar', canal: props.canal, url: conexion.url, pestana: conexion.pestana, mapeo: conexion.correcciones },
    })
    conexion.abierto = false
    notify(r.prueba?.ok ? 'Hoja conectada' : 'Hoja guardada. ' + (r.prueba?.mensaje || ''), r.prueba?.ok ? 'success' : 'warning')
    await cargar()
  } catch (e: any) {
    notify(e?.data?.statusMessage || e?.message || 'No se pudo guardar la conexión', 'error')
  } finally {
    conexion.guardando = false
  }
}

async function desconectar() {
  if (!confirm(`¿Desconectar la hoja de ${etiqueta.value}? Las tarjetas dejarán de verse hasta conectarla de nuevo (el trabajo ya guardado no se pierde).`)) return
  conexion.guardando = true
  try {
    await $fetch('/api/tradecars/formularios', { method: 'POST', body: { accion: 'quitar', canal: props.canal } })
    conexion.abierto = false
    notify('Hoja desconectada')
    await cargar()
  } catch (e: any) {
    notify(e?.data?.statusMessage || e?.message || 'No se pudo desconectar', 'error')
  } finally {
    conexion.guardando = false
  }
}
</script>

<style scoped>
.fs-barra { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.fs-barra-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-height: 32px; }
.fs-barra-acciones { display: flex; align-items: center; gap: 10px; }
.fs-vivo { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; opacity: .7; }
.fs-punto { width: 8px; height: 8px; border-radius: 50%; background: #2e9e5b; box-shadow: 0 0 0 3px rgba(46, 158, 91, .2); }
.fs-girar { animation: fs-giro 1s linear infinite; }
@keyframes fs-giro { to { transform: rotate(360deg); } }

.fs-aviso { text-align: center; padding: 56px 20px 40px; max-width: 560px; margin: 0 auto; }
.fs-aviso h3 { margin: 14px 0 6px; font-size: 17px; }
.fs-aviso p { margin: 0 0 16px; opacity: .7; font-size: 13.5px; }
.fs-aviso small { opacity: .6; }
.fs-aviso--error .v-icon { color: #e2564a; }
.fs-aviso-botones { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }

.fs-campana { opacity: .9; }
.fs-fuera { margin-top: 8px; font-size: 12px; color: #d98324; display: flex; align-items: center; gap: 4px; }
.fs-atendido { display: block; margin-top: 10px; opacity: .55; }

.fs-sub { font-size: 12.5px; opacity: .6; font-weight: 400; margin-top: 2px; white-space: normal; }
.fs-paso { margin-top: 18px; }
.fs-paso:first-child { margin-top: 4px; }
.fs-paso-titulo { display: flex; align-items: center; gap: 9px; font-weight: 600; font-size: 14px; }
.fs-num {
  width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  background: rgba(218, 165, 32, .2); color: #daa520; font-size: 12px; font-weight: 700;
}
.fs-paso-txt { font-size: 12.5px; opacity: .65; margin: 6px 0 10px; white-space: normal; }
.fs-paso-fila { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fs-enlace { font-size: 12.5px; opacity: .75; text-decoration: none; color: inherit; }
.fs-enlace:hover { text-decoration: underline; }
.fs-txt-chico { font-size: 12px; opacity: .6; margin-top: 8px; }

.fs-mapeo { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px 12px; }
.fs-muestra { margin-top: 14px; padding: 12px; border-radius: 10px; background: rgba(128, 128, 128, .1); }
.fs-muestra-fila { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; padding: 5px 0; border-top: 1px solid rgba(128, 128, 128, .18); }
.fs-muestra-fila:first-of-type { border-top: 0; }
.fs-muestra-fila strong { min-width: 150px; }

/* ---- Tarjetas: mismas reglas que "Solicitudes web" (pages/pruebas/TradeCars.vue) ---- */
.sol-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.sol-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
.sol-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; align-items: start; }
.sol-card { padding: 16px; cursor: pointer; border-radius: 14px; transition: transform .15s ease, box-shadow .15s ease; }
.sol-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 0, 0, .16); }
.sol-card--open { grid-column: 1 / -1; cursor: default; }
.sol-card-head { display: flex; align-items: center; gap: 12px; }
.sol-card-ident { flex: 1; min-width: 0; }
.sol-card-nombre { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sol-card-fecha { font-size: 12px; opacity: .6; }
.sol-card-resumen { margin-top: 12px; }
.sol-veh { display: flex; align-items: center; gap: 6px; font-size: 14px; margin-bottom: 6px; }
.sol-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12.5px; opacity: .8; }
.sol-meta span { display: inline-flex; align-items: center; gap: 4px; }
.sol-msg-preview {
  margin-top: 10px; font-size: 12.5px; font-style: italic; opacity: .65;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.sol-card-detalle { margin-top: 14px; cursor: default; }
.sol-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.sol-campo { display: flex; flex-direction: column; gap: 2px; }
.sol-campo span { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; }
.sol-campo strong { font-size: 14px; word-break: break-word; }
.sol-mensaje { margin-top: 14px; padding: 12px; border-radius: 10px; background: rgba(128, 128, 128, .1); font-size: 13.5px; }
.sol-mensaje-label { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; margin-bottom: 4px; }
.sol-acciones { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
.sol-empty { text-align: center; padding: 60px 20px; opacity: .6; }
.sol-empty p { margin: 12px 0 4px; font-size: 15px; }
</style>
