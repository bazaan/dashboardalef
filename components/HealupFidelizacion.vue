<template>
  <div class="fid-panel">

    <!-- HEADER -->
    <div class="fid-header">
      <div>
        <h2 class="fid-title">Tarjetas de fidelización</h2>
        <p class="fid-subtitle">
          {{ empresaNombre }} · tarjeta digital en Apple Wallet y Google Wallet
        </p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button v-if="vista === 'socios'" class="fid-btn-ghost" :disabled="cargando" @click="cargar">
          <v-icon icon="mdi-refresh" size="16" /> Recargar
        </button>
        <button v-if="vista === 'socios'" class="fid-btn-primary" @click="abrirAlta">+ Inscribir paciente</button>
      </div>
    </div>

    <!-- PESTAÑAS -->
    <div class="fid-tabs">
      <button :class="['fid-tab', { activa: vista === 'socios' }]" @click="vista = 'socios'">Socios</button>
      <button :class="['fid-tab', { activa: vista === 'avisos' }]" @click="vista = 'avisos'">
        Avisos a socios
      </button>
      <button :class="['fid-tab', { activa: vista === 'config' }]" @click="vista = 'config'">
        Configuración del programa
      </button>
    </div>

    <HealupFidelizacionCampanas v-if="vista === 'avisos'" />
    <HealupFidelizacionConfig v-else-if="vista === 'config'" />

    <template v-else>
    <div v-if="error" class="fid-alert">
      <div style="font-weight:600;margin-bottom:0.25rem;">No se pudo cargar el programa</div>
      <div style="font-size:0.82rem;">{{ error }}</div>
    </div>

    <div v-else-if="cargando && !stats" class="fid-empty">
      <v-progress-circular indeterminate size="28" width="3" />
      <p style="margin:0.75rem 0 0;color:var(--muted-foreground);">Consultando la plataforma…</p>
    </div>

    <template v-else>
      <!-- MÉTRICAS -->
      <div v-if="stats" class="fid-kpis">
        <div class="fid-kpi">
          <div class="fid-kpi-label">Socios</div>
          <div class="fid-kpi-value">{{ stats.total_customers ?? 0 }}</div>
          <div class="fid-kpi-hint">con tarjeta emitida</div>
        </div>
        <div class="fid-kpi">
          <div class="fid-kpi-label">Activos (30 días)</div>
          <div class="fid-kpi-value">{{ stats.active_customers ?? 0 }}</div>
          <div class="fid-kpi-hint">{{ stats.retention_rate ?? 0 }}% del total</div>
        </div>
        <div class="fid-kpi">
          <div class="fid-kpi-label">Visitas del mes</div>
          <div class="fid-kpi-value">{{ stats.visits_this_month ?? 0 }}</div>
          <div class="fid-kpi-hint">{{ stats.avg_visits_per_customer ?? 0 }} por socio en promedio</div>
        </div>
        <div class="fid-kpi">
          <div class="fid-kpi-label">Premios canjeados</div>
          <div class="fid-kpi-value">{{ stats.total_rewards_redeemed ?? 0 }}</div>
          <div class="fid-kpi-hint">{{ stats.total_points_issued ?? 0 }} puntos emitidos</div>
        </div>
      </div>

      <!-- ALTA POR QR -->
      <div v-if="urlAlta" class="fid-card fid-card--alta">
        <div>
          <div class="fid-section-label">Alta desde el mostrador</div>
          <p class="fid-text" style="margin:0 0 0.5rem;">
            El paciente escanea este enlace y su tarjeta se instala sola. Sirve para el QR de recepción.
          </p>
          <code class="fid-code">{{ urlAlta }}</code>
        </div>
        <button class="fid-btn-ghost" @click="copiar(urlAlta)">
          <v-icon icon="mdi-content-copy" size="16" /> {{ copiado ? 'Copiado' : 'Copiar enlace' }}
        </button>
      </div>

      <!-- BUSCADOR -->
      <div class="fid-toolbar">
        <h3 class="fid-h3">Socios</h3>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
          <input
            v-model="busqueda"
            class="fid-input fid-input--search"
            type="search"
            placeholder="Buscar por DNI, nombre, correo o teléfono…"
            @keyup.enter="buscar"
          />
          <button class="fid-btn-ghost" :disabled="cargando" @click="buscar">Buscar</button>
          <button v-if="queryActiva" class="fid-btn-ghost" @click="limpiarBusqueda">Limpiar</button>
        </div>
      </div>

      <p v-if="queryActiva" class="fid-nota">
        {{ total }} {{ total === 1 ? 'resultado' : 'resultados' }} para
        «{{ queryActiva }}» en todo el padrón.
      </p>

      <div v-if="socios.length === 0" class="fid-empty">
        <div style="font-size:2.2rem;margin-bottom:0.6rem;">💳</div>
        <p style="color:var(--muted-foreground);margin:0 0 1rem;">
          {{ queryActiva ? 'Ningún socio coincide con esa búsqueda.' : 'Todavía no hay socios inscritos.' }}
        </p>
        <button v-if="!queryActiva" class="fid-btn-primary" @click="abrirAlta">Inscribir al primero</button>
      </div>

      <div v-else class="fid-tabla-wrap">
        <table class="fid-tabla">
          <thead>
            <tr>
              <th>Socio</th>
              <th>DNI</th>
              <th>Contacto</th>
              <th class="num">Puntos</th>
              <th class="num">Visitas</th>
              <th>Nivel</th>
              <th>Última visita</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in socios" :key="s.id" class="fid-fila" @click="abrirFicha(s)">
              <td>{{ s.name || '—' }}</td>
              <td>
                <span v-if="s.document_id">{{ s.document_id }}</span>
                <span v-else class="fid-sin-dni" title="Sin DNI no se le puede buscar por documento">sin DNI</span>
              </td>
              <td class="fid-td-muted">{{ s.email || s.phone || '—' }}</td>
              <td class="num"><strong>{{ s.points ?? 0 }}</strong></td>
              <td class="num">{{ s.visits ?? 0 }}</td>
              <td><span class="fid-nivel">{{ s.level || '—' }}</span></td>
              <td class="fid-td-muted">{{ formatFecha(s.last_visit) }}</td>
              <td><button class="fid-btn-mini" @click.stop="abrirFicha(s)">Ver ficha</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pages > 1" class="fid-paginacion">
        <button class="fid-btn-ghost" :disabled="page <= 1 || cargando" @click="irA(page - 1)">Anterior</button>
        <span class="fid-td-muted">Página {{ page }} de {{ pages }} · {{ total }} socios</span>
        <button class="fid-btn-ghost" :disabled="page >= pages || cargando" @click="irA(page + 1)">Siguiente</button>
      </div>
    </template>
    </template>

    <!-- ══════════ FICHA DEL SOCIO ══════════ -->
    <v-dialog v-model="dialogFicha" max-width="620" scrollable>
      <div class="fid-dialog">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
          <div>
            <h3 class="fid-h3" style="margin:0;">{{ socioSel?.name || 'Socio' }}</h3>
            <p class="fid-text" style="margin:0.2rem 0 0;">
              {{ socioSel?.email || socioSel?.phone || 'sin contacto' }}
            </p>
          </div>
          <button class="fid-btn-ghost" @click="dialogFicha = false">Cerrar</button>
        </div>

        <div v-if="cargandoFicha" class="fid-text" style="display:flex;align-items:center;gap:0.5rem;margin-top:1rem;">
          <v-progress-circular indeterminate size="16" width="2" /> Cargando ficha…
        </div>

        <template v-else>
          <!-- SALDO -->
          <div class="fid-ficha-kpis">
            <div><div class="fid-kpi-label">Puntos</div><div class="fid-kpi-value">{{ socioSel?.points ?? 0 }}</div></div>
            <div><div class="fid-kpi-label">Visitas</div><div class="fid-kpi-value">{{ socioSel?.visits ?? 0 }}</div></div>
            <div><div class="fid-kpi-label">Nivel</div><div class="fid-kpi-value" style="font-size:1.1rem;">{{ socioSel?.level || '—' }}</div></div>
          </div>

          <!-- DNI -->
          <div class="fid-bloque">
            <div class="fid-section-label">Documento de identidad</div>
            <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
              <input v-model="docEdit" class="fid-input" style="max-width:200px;" placeholder="DNI, CE o pasaporte" />
              <button class="fid-btn-ghost" :disabled="guardando || docEdit === (socioSel?.document_id || '')" @click="guardarDoc">
                {{ guardando ? 'Guardando…' : 'Guardar' }}
              </button>
            </div>
            <p class="fid-nota" style="margin:0.4rem 0 0;">
              Sin DNI cargado, este socio no aparece al buscar por documento.
            </p>
            <div v-if="docError" class="fid-alert" style="margin-top:0.5rem;">{{ docError }}</div>
            <div v-if="docOk" class="fid-ok" style="margin-top:0.5rem;">Documento actualizado.</div>
          </div>

          <!-- SUMAR PUNTOS -->
          <div class="fid-bloque">
            <div class="fid-section-label">Sumar puntos</div>
            <div v-if="!serialSel" class="fid-alert">
              Este socio no tiene tarjeta emitida, así que no se le pueden sumar puntos.
            </div>
            <template v-else>
              <div class="fid-grid-puntos">
                <div>
                  <label class="fid-label">Puntos</label>
                  <input v-model="puntos.points" class="fid-input" type="number" min="1" :max="MAX_PUNTOS"
                    placeholder="Vacío = los del programa" />
                </div>
                <div>
                  <label class="fid-label">Monto S/ (opcional)</label>
                  <input v-model="puntos.amount" class="fid-input" type="number" min="0" step="0.01" />
                </div>
              </div>
              <label class="fid-label">Motivo (opcional)</label>
              <input v-model="puntos.description" class="fid-input" placeholder="Ej. Limpieza facial" />

              <label class="fid-check">
                <input v-model="puntos.countVisit" type="checkbox" />
                <span>Contar como visita nueva <em>(desmarcar si es una corrección)</em></span>
              </label>

              <p class="fid-nota">Máximo {{ MAX_PUNTOS }} por movimiento. Queda registrado a tu nombre.</p>
              <div v-if="puntosError" class="fid-alert" style="margin-bottom:0.5rem;">{{ puntosError }}</div>
              <button class="fid-btn-primary" :disabled="guardando" @click="sumarPuntos">
                {{ guardando ? 'Sumando…' : 'Sumar puntos' }}
              </button>
            </template>
          </div>

          <!-- MOVIMIENTOS -->
          <div class="fid-bloque">
            <div class="fid-section-label">Movimientos</div>
            <div v-if="!movimientos.length" class="fid-text">Sin movimientos todavía.</div>
            <div v-for="m in movimientos" :key="m.id" class="fid-mov">
              <span class="fid-td-muted">{{ formatFecha(m.created_at) }}</span>
              <span>
                {{ m.description || m.type }}
                <em v-if="m.actor" class="fid-actor">· {{ m.actor }}</em>
              </span>
              <strong :class="m.points < 0 ? 'fid-neg' : ''">{{ m.points > 0 ? '+' : '' }}{{ m.points }}</strong>
            </div>
          </div>
        </template>
      </div>
    </v-dialog>

    <!-- ══════════ INSCRIBIR ══════════ -->
    <v-dialog v-model="dialogAlta" max-width="460">
      <div class="fid-dialog">
        <h3 class="fid-h3" style="margin-top:0;">Inscribir paciente</h3>
        <p class="fid-text">Se emite su tarjeta y se le puede mandar el enlace para instalarla.</p>

        <label class="fid-label">Nombre</label>
        <input v-model="alta.name" class="fid-input" placeholder="Nombre y apellido" />

        <label class="fid-label">DNI</label>
        <input v-model="alta.documentId" class="fid-input" placeholder="Documento de identidad" />

        <label class="fid-label">Correo</label>
        <input v-model="alta.email" class="fid-input" type="email" placeholder="paciente@correo.com" />

        <label class="fid-label">Teléfono</label>
        <input v-model="alta.phone" class="fid-input" type="tel" placeholder="+51 9xx xxx xxx" />

        <p class="fid-nota" style="margin-top:0.5rem;">Hace falta al menos DNI, correo o teléfono.</p>
        <div v-if="altaError" class="fid-alert" style="margin-top:0.75rem;">{{ altaError }}</div>

        <div v-if="altaResultado" class="fid-ok">
          <div style="font-weight:600;margin-bottom:0.4rem;">{{ altaResultado.mensaje }}</div>
          <div v-if="altaResultado.applePassUrl" style="margin-bottom:0.4rem;">
            <a :href="altaResultado.applePassUrl" target="_blank" rel="noopener" class="fid-link">Descargar tarjeta (Apple Wallet)</a>
            <button class="fid-btn-mini" style="margin-left:0.5rem;" @click="copiar(altaResultado.applePassUrl)">Copiar enlace</button>
          </div>
          <div v-if="altaResultado.googleWalletUrl">
            <a :href="altaResultado.googleWalletUrl" target="_blank" rel="noopener" class="fid-link">Agregar a Google Wallet</a>
          </div>
        </div>

        <div class="fid-dialog-acciones">
          <button class="fid-btn-ghost" @click="dialogAlta = false">{{ altaResultado ? 'Cerrar' : 'Cancelar' }}</button>
          <button v-if="!altaResultado" class="fid-btn-primary" :disabled="guardando" @click="enrolar">
            {{ guardando ? 'Emitiendo…' : 'Emitir tarjeta' }}
          </button>
        </div>
      </div>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ empresaNombre?: string }>(), { empresaNombre: 'Healup' })

/** Mismo tope que aplica la plataforma. */
const MAX_PUNTOS = 5000

/** 'socios' = padrón y operación diaria · 'avisos' = campañas · 'config' = ajustes. */
const vista = ref<'socios' | 'avisos' | 'config'>('socios')

const cargando = ref(false)
const guardando = ref(false)
const error = ref('')
const copiado = ref(false)

const stats = ref<any>(null)
const socios = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pages = ref(1)
const urlAlta = ref('')
const busqueda = ref('')
const queryActiva = ref('')

const dialogFicha = ref(false)
const cargandoFicha = ref(false)
const socioSel = ref<any>(null)
const serialSel = ref<string | null>(null)
const movimientos = ref<any[]>([])
const docEdit = ref('')
const docError = ref('')
const docOk = ref(false)
const puntos = ref<{ points: string | number; amount: string | number; description: string; countVisit: boolean }>({
  points: '', amount: '', description: '', countVisit: true,
})
const puntosError = ref('')

const dialogAlta = ref(false)
const alta = ref({ name: '', documentId: '', email: '', phone: '' })
const altaError = ref('')
const altaResultado = ref<any>(null)

function mensajeDeError(e: any): string {
  return e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || 'Error inesperado'
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const res = await $fetch<any>('/api/healup/fidelizacion', {
      query: { page: page.value, limit: 50, q: queryActiva.value || undefined },
    })
    stats.value = res.stats
    socios.value = res.socios || []
    total.value = res.total || 0
    pages.value = res.pages || 1
    page.value = res.page || page.value
    urlAlta.value = res.urlAlta || ''
  } catch (e: any) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

function buscar() {
  queryActiva.value = busqueda.value.trim()
  page.value = 1
  cargar()
}

function limpiarBusqueda() {
  busqueda.value = ''
  queryActiva.value = ''
  page.value = 1
  cargar()
}

function irA(n: number) {
  page.value = n
  cargar()
}

async function abrirFicha(s: any) {
  socioSel.value = { ...s }
  serialSel.value = s.serial_number || null
  docEdit.value = s.document_id || ''
  movimientos.value = []
  docError.value = ''
  docOk.value = false
  puntosError.value = ''
  puntos.value = { points: '', amount: '', description: '', countVisit: true }
  dialogFicha.value = true

  cargandoFicha.value = true
  try {
    const det = await $fetch<any>('/api/healup/fidelizacion-socio', { query: { customerId: s.id } })
    if (det.socio) socioSel.value = { ...socioSel.value, ...det.socio }
    serialSel.value = det.serial || serialSel.value
    movimientos.value = det.movimientos || []
    docEdit.value = det.socio?.document_id || docEdit.value
  } catch (e: any) {
    puntosError.value = mensajeDeError(e)
  } finally {
    cargandoFicha.value = false
  }
}

async function guardarDoc() {
  docError.value = ''
  docOk.value = false
  guardando.value = true
  try {
    const res = await $fetch<any>('/api/healup/fidelizacion-socio', {
      method: 'PATCH',
      body: { customerId: socioSel.value.id, documentId: docEdit.value.trim() },
    })
    if (res.socio) socioSel.value = { ...socioSel.value, ...res.socio }
    docOk.value = true
    await cargar()
  } catch (e: any) {
    docError.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

async function sumarPuntos() {
  puntosError.value = ''
  if (!serialSel.value) {
    puntosError.value = 'Este socio no tiene tarjeta emitida.'
    return
  }
  guardando.value = true
  try {
    await $fetch('/api/healup/fidelizacion-puntos', {
      method: 'POST',
      body: {
        serial: serialSel.value,
        points: puntos.value.points === '' ? undefined : Number(puntos.value.points),
        amount: puntos.value.amount === '' ? undefined : Number(puntos.value.amount),
        description: puntos.value.description || undefined,
        countVisit: puntos.value.countVisit,
      },
    })
    await abrirFicha({ ...socioSel.value, serial_number: serialSel.value })
    await cargar()
  } catch (e: any) {
    puntosError.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

function abrirAlta() {
  alta.value = { name: '', documentId: '', email: '', phone: '' }
  altaError.value = ''
  altaResultado.value = null
  dialogAlta.value = true
}

async function enrolar() {
  altaError.value = ''
  if (!alta.value.email.trim() && !alta.value.phone.trim() && !alta.value.documentId.trim()) {
    altaError.value = 'Hace falta al menos DNI, correo o teléfono.'
    return
  }
  guardando.value = true
  try {
    altaResultado.value = await $fetch<any>('/api/healup/fidelizacion-enrolar', {
      method: 'POST',
      body: alta.value,
    })
    await cargar()
  } catch (e: any) {
    altaError.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    copiado.value = true
    setTimeout(() => (copiado.value = false), 1800)
  } catch { /* el navegador puede bloquearlo; el texto queda visible igual */ }
}

function formatFecha(v: any): string {
  if (!v) return 'nunca'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(cargar)
</script>

<style scoped>
.fid-panel { padding: 1.25rem; }

.fid-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;
}
.fid-title { font-size: 1.25rem; font-weight: 700; color: var(--foreground); margin: 0; }
.fid-subtitle { font-size: 0.82rem; color: var(--muted-foreground); margin: 0.2rem 0 0; }
.fid-h3 { font-size: 0.95rem; font-weight: 600; color: var(--foreground); margin: 0; }

.fid-tabs {
  display: flex; gap: 0.25rem; border-bottom: 1px solid var(--border, #e5e7eb);
  margin-bottom: 1.25rem;
}
.fid-tab {
  background: transparent; border: none; border-bottom: 2px solid transparent;
  padding: 0.55rem 0.9rem; font-size: 0.85rem; font-weight: 600;
  color: var(--muted-foreground); cursor: pointer;
}
.fid-tab.activa { color: var(--foreground); border-bottom-color: var(--primary, #111827); }

.fid-kpis {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem; margin-bottom: 1.25rem;
}
.fid-kpi {
  background: var(--card, #fff); border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius, 10px); padding: 0.9rem 1rem;
}
.fid-kpi-label {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted-foreground); font-weight: 600;
}
.fid-kpi-value { font-size: 1.6rem; font-weight: 700; color: var(--foreground); line-height: 1.2; }
.fid-kpi-hint { font-size: 0.72rem; color: var(--muted-foreground); }

.fid-card {
  background: var(--card, #fff); border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius, 10px); padding: 1rem; margin-bottom: 1.25rem;
}
.fid-card--alta { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.fid-section-label {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted-foreground); font-weight: 600; margin-bottom: 0.35rem;
}
.fid-text { font-size: 0.85rem; color: var(--muted-foreground); }
.fid-code {
  display: inline-block; font-size: 0.78rem; background: var(--muted, #f4f4f5);
  padding: 0.3rem 0.5rem; border-radius: 6px; color: var(--foreground); word-break: break-all;
}

.fid-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.6rem;
}
.fid-nota { font-size: 0.75rem; color: var(--muted-foreground); margin: 0 0 0.6rem; }

.fid-tabla-wrap { overflow-x: auto; border: 1px solid var(--border, #e5e7eb); border-radius: var(--radius, 10px); }
.fid-tabla { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.fid-tabla th {
  text-align: left; padding: 0.6rem 0.75rem; font-size: 0.72rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted-foreground);
  border-bottom: 1px solid var(--border, #e5e7eb); white-space: nowrap;
}
.fid-tabla td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border, #e5e7eb); color: var(--foreground); }
.fid-tabla tr:last-child td { border-bottom: none; }
.fid-tabla .num { text-align: right; }
.fid-fila { cursor: pointer; }
.fid-fila:hover { background: var(--muted, #f7f7f8); }
.fid-td-muted { color: var(--muted-foreground); }
.fid-sin-dni { font-size: 0.72rem; color: var(--muted-foreground); font-style: italic; }
.fid-nivel {
  font-size: 0.72rem; background: var(--muted, #f4f4f5); color: var(--foreground);
  padding: 2px 8px; border-radius: 10px;
}

.fid-paginacion {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem; margin-top: 0.85rem; font-size: 0.8rem; flex-wrap: wrap;
}

.fid-empty {
  text-align: center; padding: 2.5rem 1rem;
  border: 1px dashed var(--border, #e5e7eb); border-radius: var(--radius, 10px);
}

.fid-alert {
  background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
  border-radius: 8px; padding: 0.75rem 0.9rem; font-size: 0.85rem;
}
.fid-ok {
  background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d;
  border-radius: 8px; padding: 0.75rem 0.9rem; font-size: 0.85rem; margin-top: 0.85rem;
}
.fid-link { color: inherit; text-decoration: underline; font-weight: 600; }

.fid-btn-primary {
  background: var(--primary, #111827); color: var(--primary-foreground, #fff);
  border: none; border-radius: 8px; padding: 0.5rem 0.9rem;
  font-size: 0.82rem; font-weight: 600; cursor: pointer;
}
.fid-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.fid-btn-ghost {
  background: transparent; color: var(--foreground); border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px; padding: 0.45rem 0.8rem; font-size: 0.8rem; cursor: pointer;
  display: inline-flex; align-items: center; gap: 0.35rem;
}
.fid-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.fid-btn-mini {
  background: transparent; color: var(--foreground); border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px; padding: 0.25rem 0.55rem; font-size: 0.75rem; cursor: pointer; white-space: nowrap;
}

.fid-label {
  display: block; font-size: 0.75rem; font-weight: 600;
  color: var(--muted-foreground); margin: 0.75rem 0 0.25rem;
}
.fid-input {
  width: 100%; border: 1px solid var(--border, #e5e7eb); border-radius: 8px;
  padding: 0.5rem 0.7rem; font-size: 0.85rem; color: var(--foreground);
  background: var(--background, #fff);
}
.fid-input--search { width: min(340px, 100%); }
.fid-check {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.8rem; color: var(--muted-foreground); margin: 0.75rem 0;
}
.fid-check em { font-style: normal; opacity: 0.8; }

.fid-dialog { background: var(--card, #fff); border-radius: 12px; padding: 1.25rem; }
.fid-dialog-acciones { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; }

.fid-ficha-kpis {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;
  margin: 1rem 0; padding: 0.85rem; background: var(--muted, #f7f7f8);
  border-radius: var(--radius, 10px);
}
.fid-bloque {
  border-top: 1px solid var(--border, #e5e7eb);
  padding-top: 1rem; margin-top: 1rem;
}
.fid-grid-puntos { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.fid-mov {
  display: grid; grid-template-columns: auto 1fr auto; gap: 0.6rem;
  align-items: center; font-size: 0.78rem; padding: 0.4rem 0;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.fid-mov:last-child { border-bottom: none; }
.fid-actor { font-style: normal; color: var(--muted-foreground); font-size: 0.72rem; }
.fid-neg { color: #dc2626; }

@media (max-width: 600px) {
  .fid-grid-puntos, .fid-ficha-kpis { grid-template-columns: 1fr; }
}
</style>
