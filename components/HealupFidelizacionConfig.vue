<template>
  <div class="cfg">

    <div v-if="error" class="fid-alert">{{ error }}</div>

    <div v-else-if="cargando" class="cfg-cargando">
      <v-progress-circular indeterminate size="26" width="3" />
      <span>Cargando la configuración…</span>
    </div>

    <div v-else class="cfg-layout">

      <!-- ─────────── COLUMNA DE AJUSTES ─────────── -->
      <div class="cfg-col">

        <!-- PUNTOS -->
        <section class="cfg-bloque">
          <h4 class="cfg-h4">Cómo se ganan los puntos</h4>
          <p class="cfg-ayuda">
            Esto define cuánto suma cada atención. El equipo puede escribir otra cantidad
            en el momento; esto es lo que se aplica cuando no dicen nada.
          </p>
          <div class="cfg-fila">
            <div>
              <label class="cfg-label">Puntos por visita</label>
              <input v-model.number="form.puntos.porVisita" class="cfg-input" type="number" min="0" max="5000" />
            </div>
            <div>
              <label class="cfg-label">Puntos por cada S/ 1</label>
              <input v-model.number="form.puntos.porSol" class="cfg-input" type="number" min="0" max="1000" step="0.1" />
              <p class="cfg-nota">0 = no se usa el monto</p>
            </div>
          </div>
        </section>

        <!-- NIVELES -->
        <section class="cfg-bloque">
          <h4 class="cfg-h4">Niveles</h4>
          <p class="cfg-ayuda">
            El socio sube de nivel al llegar al puntaje. El primero siempre arranca en 0:
            es el nivel con el que entra alguien recién inscrito.
          </p>

          <div v-for="(n, i) in form.niveles" :key="i" class="cfg-nivel">
            <input v-model="n.name" class="cfg-input" placeholder="Nombre del nivel" maxlength="40" />
            <input
              v-model.number="n.threshold" class="cfg-input cfg-input--num" type="number" min="0"
              :disabled="i === 0" :title="i === 0 ? 'El nivel de entrada siempre es 0' : ''"
            />
            <span class="cfg-pts">pts</span>
            <button class="cfg-btn-icono" :disabled="form.niveles.length <= 1"
              title="Quitar nivel" @click="quitarNivel(i)">✕</button>
          </div>

          <button class="fid-btn-ghost" :disabled="form.niveles.length >= 8" @click="agregarNivel">
            + Agregar nivel
          </button>
          <p v-if="form.niveles.length >= 8" class="cfg-nota">Máximo 8 niveles.</p>
        </section>

        <!-- TARJETA -->
        <section class="cfg-bloque">
          <h4 class="cfg-h4">La tarjeta</h4>

          <label class="cfg-label">Descripción</label>
          <input v-model="form.tarjeta.descripcion" class="cfg-input" maxlength="200"
            placeholder="Ej. Tarjeta de beneficios de Healup" />
          <p class="cfg-nota">
            Es lo que Apple muestra como descripción del pase y lo que lee VoiceOver.
            {{ 200 - (form.tarjeta.descripcion || '').length }} caracteres disponibles.
          </p>

          <div class="cfg-fila cfg-fila--3">
            <div>
              <label class="cfg-label">Fondo</label>
              <input v-model="form.tarjeta.colorFondo" class="cfg-color" type="color" />
            </div>
            <div>
              <label class="cfg-label">Texto</label>
              <input v-model="form.tarjeta.colorTexto" class="cfg-color" type="color" />
            </div>
            <div>
              <label class="cfg-label">Etiquetas</label>
              <input v-model="form.tarjeta.colorEtiqueta" class="cfg-color" type="color" />
            </div>
          </div>
          <p v-if="contrasteBajo" class="cfg-aviso">
            El texto casi no se distingue del fondo. En el teléfono se va a leer peor que acá.
          </p>

          <label class="cfg-label">Logo</label>
          <div class="cfg-logo-fila">
            <input ref="inputLogo" type="file" accept="image/png,image/jpeg,image/webp"
              class="cfg-file" @change="subirLogo" />
            <button v-if="form.tarjeta.logo" class="fid-btn-ghost" @click="quitarLogo">Quitar</button>
          </div>
          <p class="cfg-nota">PNG, JPG o WEBP, hasta 2 MB. Se ve mejor un logo horizontal con fondo transparente.</p>
          <div v-if="logoError" class="fid-alert" style="margin-top:0.5rem;">{{ logoError }}</div>
          <div v-if="subiendoLogo" class="cfg-nota">Subiendo…</div>
        </section>

        <div class="cfg-acciones">
          <button class="fid-btn-primary" :disabled="guardando" @click="guardar">
            {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
          </button>
          <button class="fid-btn-ghost" :disabled="guardando" @click="cargar">Descartar</button>
          <span v-if="guardadoOk" class="cfg-ok">Guardado.</span>
        </div>
        <div v-if="guardarError" class="fid-alert" style="margin-top:0.75rem;">{{ guardarError }}</div>
      </div>

      <!-- ─────────── PREVISUALIZACIÓN ─────────── -->
      <div class="cfg-col cfg-col--preview">
        <h4 class="cfg-h4">Así se va a ver</h4>
        <p class="cfg-ayuda">Aproximación del pase en Apple Wallet. Los datos son de ejemplo.</p>

        <div class="cfg-telefono">
          <div class="cfg-tarjeta" :style="{ background: form.tarjeta.colorFondo, color: form.tarjeta.colorTexto }">
            <div class="cfg-tarjeta-top">
              <img v-if="logoPreview" :src="logoPreview" alt="Logo" class="cfg-tarjeta-logo" />
              <span v-else class="cfg-tarjeta-wordmark">Healup</span>
              <div class="cfg-tarjeta-puntos">
                <div class="cfg-tarjeta-label" :style="{ color: form.tarjeta.colorEtiqueta }">PUNTOS</div>
                <div class="cfg-tarjeta-valor">{{ puntosEjemplo }}</div>
              </div>
            </div>

            <div class="cfg-tarjeta-medio">
              <div>
                <div class="cfg-tarjeta-label" :style="{ color: form.tarjeta.colorEtiqueta }">SOCIO</div>
                <div class="cfg-tarjeta-dato">María Fernández</div>
              </div>
              <div style="text-align:right;">
                <div class="cfg-tarjeta-label" :style="{ color: form.tarjeta.colorEtiqueta }">NIVEL</div>
                <div class="cfg-tarjeta-dato">{{ nivelEjemplo }}</div>
              </div>
            </div>

            <div class="cfg-tarjeta-qr"><div class="cfg-qr"></div></div>

            <div class="cfg-tarjeta-desc" :style="{ color: form.tarjeta.colorEtiqueta }">
              {{ form.tarjeta.descripcion || 'Tarjeta de Lealtad - Healup' }}
            </div>
          </div>
        </div>

        <!-- ESCALERA -->
        <div class="cfg-escalera">
          <div class="fid-section-label">Escalera de niveles</div>
          <div v-for="(n, i) in nivelesOrdenados" :key="i" class="cfg-escalon">
            <span class="cfg-escalon-nombre">{{ n.name || '(sin nombre)' }}</span>
            <span class="cfg-escalon-pts">
              {{ n.threshold === 0 ? 'desde el inicio' : `desde ${n.threshold} pts` }}
            </span>
          </div>
          <p v-if="hayUmbralRepetido" class="cfg-aviso">
            Hay dos niveles con el mismo puntaje: uno nunca se alcanzaría.
          </p>
        </div>

        <div class="cfg-ejemplo">
          <div class="fid-section-label">Cuánto suma una atención</div>
          <p class="cfg-ayuda" style="margin:0;">
            Una visita de <strong>S/ {{ montoEjemplo }}</strong> otorga
            <strong>{{ puntosDeEjemplo }} puntos</strong>
            <span v-if="form.puntos.porSol > 0">
              ({{ form.puntos.porVisita }} por la visita + {{ Math.round(montoEjemplo * form.puntos.porSol) }} por el monto)
            </span>
            <span v-else>(solo por la visita; el monto no suma)</span>.
          </p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
const cargando = ref(true)
const guardando = ref(false)
const subiendoLogo = ref(false)
const error = ref('')
const guardarError = ref('')
const logoError = ref('')
const guardadoOk = ref(false)
const inputLogo = ref<HTMLInputElement | null>(null)

const montoEjemplo = 250

const form = ref({
  puntos: { porVisita: 50, porSol: 0 },
  niveles: [] as Array<{ name: string; threshold: number }>,
  tarjeta: {
    descripcion: '',
    colorFondo: '#1a1a2e',
    colorTexto: '#ffffff',
    colorEtiqueta: '#aaaaaa',
    logo: '',
  },
})
const logoPreview = ref('')

function mensajeDeError(e: any): string {
  return e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || 'Error inesperado'
}

const nivelesOrdenados = computed(() =>
  [...form.value.niveles].sort((a, b) => (a.threshold || 0) - (b.threshold || 0)),
)

const hayUmbralRepetido = computed(() => {
  const u = form.value.niveles.map((n) => n.threshold)
  return new Set(u).size !== u.length
})

const puntosDeEjemplo = computed(() =>
  Math.round((form.value.puntos.porVisita || 0) + montoEjemplo * (form.value.puntos.porSol || 0)),
)

const puntosEjemplo = computed(() => 640)

const nivelEjemplo = computed(() => {
  let actual = nivelesOrdenados.value[0]?.name || '—'
  for (const n of nivelesOrdenados.value) {
    if (puntosEjemplo.value >= (n.threshold || 0)) actual = n.name || '—'
    else break
  }
  return actual
})

/** Luminancia relativa, para avisar cuando el texto no se va a leer. */
function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrasteBajo = computed(() => {
  const a = luminancia(form.value.tarjeta.colorFondo)
  const b = luminancia(form.value.tarjeta.colorTexto)
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  return ratio < 3
})

async function cargar() {
  cargando.value = true
  error.value = ''
  guardadoOk.value = false
  try {
    const res = await $fetch<any>('/api/healup/fidelizacion-programa')
    form.value = {
      puntos: { porVisita: res.puntos.porVisita, porSol: res.puntos.porSol },
      niveles: (res.niveles || []).map((n: any) => ({ name: n.name, threshold: n.threshold })),
      tarjeta: { ...res.tarjeta },
    }
    logoPreview.value = res.tarjeta.logoUrl || ''
  } catch (e: any) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

function agregarNivel() {
  const mayor = Math.max(0, ...form.value.niveles.map((n) => n.threshold || 0))
  form.value.niveles.push({ name: '', threshold: mayor + 500 })
}

function quitarNivel(i: number) {
  form.value.niveles.splice(i, 1)
  // El primero siempre arranca en 0: si se borró el de entrada, el que queda lo reemplaza.
  const ord = [...form.value.niveles].sort((a, b) => a.threshold - b.threshold)
  if (ord.length && ord[0].threshold !== 0) ord[0].threshold = 0
}

async function subirLogo(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  logoError.value = ''
  subiendoLogo.value = true
  try {
    const fd = new FormData()
    fd.append('archivo', file)
    const res = await $fetch<any>('/api/healup/fidelizacion-logo', { method: 'POST', body: fd })
    form.value.tarjeta.logo = res.logo
    logoPreview.value = res.logoUrl
  } catch (err: any) {
    logoError.value = mensajeDeError(err)
  } finally {
    subiendoLogo.value = false
    if (input) input.value = ''
  }
}

function quitarLogo() {
  form.value.tarjeta.logo = ''
  logoPreview.value = ''
}

async function guardar() {
  guardarError.value = ''
  guardadoOk.value = false

  if (form.value.niveles.some((n) => !n.name.trim())) {
    guardarError.value = 'Todos los niveles necesitan un nombre.'
    return
  }
  if (hayUmbralRepetido.value) {
    guardarError.value = 'Hay dos niveles con el mismo puntaje.'
    return
  }

  guardando.value = true
  try {
    await $fetch('/api/healup/fidelizacion-programa', { method: 'PUT', body: form.value })
    guardadoOk.value = true
    await cargar()
    setTimeout(() => (guardadoOk.value = false), 3000)
  } catch (e: any) {
    guardarError.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

onMounted(cargar)
</script>

<style scoped>
.cfg { padding: 0.5rem 0; }
.cfg-cargando { display: flex; align-items: center; gap: 0.6rem; padding: 2rem; color: var(--muted-foreground); }

.cfg-layout { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
.cfg-col { min-width: 0; }

.cfg-bloque {
  border: 1px solid var(--border, #e5e7eb); border-radius: var(--radius, 10px);
  padding: 1rem; margin-bottom: 1rem; background: var(--card, #fff);
}
.cfg-h4 { font-size: 0.9rem; font-weight: 600; color: var(--foreground); margin: 0 0 0.35rem; }
.cfg-ayuda { font-size: 0.78rem; color: var(--muted-foreground); margin: 0 0 0.85rem; line-height: 1.45; }
.cfg-nota { font-size: 0.72rem; color: var(--muted-foreground); margin: 0.3rem 0 0; }
.cfg-aviso {
  font-size: 0.75rem; color: #b45309; background: #fffbeb;
  border: 1px solid #fde68a; border-radius: 6px; padding: 0.45rem 0.6rem; margin: 0.5rem 0 0;
}
.cfg-ok { font-size: 0.8rem; color: #15803d; font-weight: 600; }

.cfg-label {
  display: block; font-size: 0.73rem; font-weight: 600;
  color: var(--muted-foreground); margin: 0.6rem 0 0.25rem;
}
.cfg-input {
  width: 100%; border: 1px solid var(--border, #e5e7eb); border-radius: 8px;
  padding: 0.45rem 0.65rem; font-size: 0.85rem;
  color: var(--foreground); background: var(--background, #fff);
}
.cfg-input:disabled { opacity: 0.6; }
.cfg-input--num { max-width: 110px; }
.cfg-color {
  width: 100%; height: 38px; padding: 2px; border-radius: 8px;
  border: 1px solid var(--border, #e5e7eb); background: var(--background, #fff); cursor: pointer;
}
.cfg-file { font-size: 0.8rem; color: var(--muted-foreground); }

.cfg-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.cfg-fila--3 { grid-template-columns: repeat(3, 1fr); }

.cfg-nivel {
  display: grid; grid-template-columns: 1fr auto auto auto;
  gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;
}
.cfg-pts { font-size: 0.75rem; color: var(--muted-foreground); }
.cfg-btn-icono {
  background: transparent; border: 1px solid var(--border, #e5e7eb); border-radius: 6px;
  width: 28px; height: 28px; cursor: pointer; color: var(--muted-foreground); line-height: 1;
}
.cfg-btn-icono:disabled { opacity: 0.35; cursor: not-allowed; }

.cfg-logo-fila { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.cfg-acciones { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

/* ── Previsualización ── */
.cfg-telefono {
  background: linear-gradient(160deg, #d8d8dd, #ececed);
  border-radius: 20px; padding: 1.1rem; margin-bottom: 1.1rem;
}
.cfg-tarjeta {
  border-radius: 12px; padding: 0.9rem;
  box-shadow: 0 6px 18px rgba(0,0,0,0.22); font-size: 0.8rem;
}
.cfg-tarjeta-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
.cfg-tarjeta-logo { max-height: 30px; max-width: 130px; object-fit: contain; }
.cfg-tarjeta-wordmark { font-weight: 700; font-size: 0.95rem; }
.cfg-tarjeta-puntos { text-align: right; }
.cfg-tarjeta-label { font-size: 0.56rem; letter-spacing: 0.09em; text-transform: uppercase; }
.cfg-tarjeta-valor { font-size: 1.45rem; font-weight: 700; line-height: 1.1; }
.cfg-tarjeta-medio { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.1rem; }
.cfg-tarjeta-dato { font-size: 0.85rem; font-weight: 600; }
.cfg-tarjeta-qr { display: flex; justify-content: center; margin: 1.1rem 0 0.5rem; }
.cfg-qr {
  width: 74px; height: 74px; background: #fff; border-radius: 6px;
  background-image:
    repeating-linear-gradient(0deg, #111 0 5px, transparent 5px 10px),
    repeating-linear-gradient(90deg, #111 0 5px, transparent 5px 10px);
  background-size: 100% 100%;
  opacity: 0.85;
}
.cfg-tarjeta-desc { font-size: 0.62rem; text-align: center; margin-top: 0.2rem; }

.cfg-escalera, .cfg-ejemplo {
  border: 1px solid var(--border, #e5e7eb); border-radius: var(--radius, 10px);
  padding: 0.85rem; margin-bottom: 1rem; background: var(--card, #fff);
}
.cfg-escalon {
  display: flex; justify-content: space-between; gap: 1rem;
  font-size: 0.8rem; padding: 0.3rem 0; border-bottom: 1px solid var(--border, #e5e7eb);
}
.cfg-escalon:last-of-type { border-bottom: none; }
.cfg-escalon-nombre { font-weight: 600; color: var(--foreground); }
.cfg-escalon-pts { color: var(--muted-foreground); }

@media (max-width: 900px) {
  .cfg-layout { grid-template-columns: 1fr; }
  .cfg-fila, .cfg-fila--3 { grid-template-columns: 1fr; }
}
</style>
