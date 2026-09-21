<!--
  Trade Cars — Módulo: Tasador IA
  --------------------------------
  Dos cosas en una pantalla:

  1. CHAT SOBRE EL NEGOCIO — el asesor le pregunta por precios de referencia,
     el embudo, el rendimiento del equipo, campañas, stock o ventas. Todo el
     cruce de tablas ocurre en el servidor
     (server/api/tradecars/tasador-chat.post.ts): este componente manda texto y
     recibe texto, sin saber nada de las tools ni de los nombres de tablas.

  2. ENSEÑARLE AL AGENTE TASADOR DE WHATSAPP — los parámetros, reglas y modelos
     de alta rotación que se ven acá son LOS MISMOS que el agente de n8n lee en
     cada tasación. Cambiarlos acá cambia lo que el bot le cotiza a un cliente
     real en la próxima conversación.

  Por eso el chat nunca escribe solo: PROPONE, y la persona confirma con un
  botón. Las propuestas viajan en la respuesta del chat y se aplican por
  /api/tradecars/tasador-config, que valida rangos y deja historial.

  Lo que toca la lógica de cálculo o el flujo de conversación del agente no se
  puede cambiar desde acá — queda como solicitud para el equipo de Alef.
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Tasador IA</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <button v-if="tab === 'chat'" class="btn-primary" :disabled="!mensajes.length" @click="nuevaConversacion">
          <v-icon icon="mdi-broom" size="16" /><span>Nueva conversación</span>
        </button>
        <button class="tasador-btn-plano" :disabled="cargandoConfig" @click="cargarConfig">
          <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
        </button>
      </div>
    </header>

    <div class="content-area">
      <v-tabs v-model="tab" density="compact" class="mb-3">
        <v-tab value="chat">Chat</v-tab>
        <v-tab value="parametros">
          Parámetros
          <v-chip v-if="config?.parametros_detalle?.length" size="x-small" class="ml-2">
            {{ config.parametros_detalle.length }}
          </v-chip>
        </v-tab>
        <v-tab value="reglas">Reglas y rotación</v-tab>
        <v-tab value="datos">
          Datos
          <v-chip v-if="config && !config.salud.operativo" size="x-small" color="error" class="ml-2">!</v-chip>
        </v-tab>
        <v-tab value="historial">
          Historial
          <v-chip v-if="config?.pendientes_alef?.length" size="x-small" color="warning" class="ml-2">
            {{ config.pendientes_alef.length }}
          </v-chip>
        </v-tab>
      </v-tabs>

      <!-- Aviso: el agente de WhatsApp no está en condiciones de cotizar -->
      <v-alert v-if="config && !config.salud.operativo" type="error" variant="tonal" density="compact" class="mb-3">
        <strong>El Agente Tasador de WhatsApp no puede cotizar todavía.</strong>
        <ul class="tasador-bloqueos">
          <li v-for="b in config.salud.bloqueos" :key="b">{{ b }}</li>
        </ul>
      </v-alert>

      <!-- ═══════════════════ CHAT ═══════════════════ -->
      <div v-show="tab === 'chat'" class="tasador-area">
        <div ref="scrollRef" class="tasador-mensajes">
          <div v-if="!mensajes.length" class="tasador-bienvenida">
            <v-icon icon="mdi-car-search-outline" size="46" style="opacity:0.4;" />
            <p class="tasador-bienvenida-texto">
              Pregúntame por precios de referencia, el embudo, el rendimiento del equipo o las campañas.
              También puedes enseñarle al agente que atiende WhatsApp: pídeme que cambie un descuento,
              un margen o una regla de marca, y te lo dejo listo para confirmar.
            </p>
            <div class="tasador-sugerencias">
              <button v-for="s in sugerencias" :key="s" class="tasador-chip" @click="enviarMensaje(s)">
                {{ s }}
              </button>
            </div>
          </div>

          <template v-for="(m, i) in mensajes" :key="i">
            <div :class="['tasador-msg', 'rol-' + m.role]">
              <div class="tasador-avatar">
                <v-icon :icon="m.role === 'user' ? 'mdi-account' : 'mdi-car-wrench'" size="16" />
              </div>
              <div class="tasador-burbuja">{{ m.content }}</div>
            </div>

            <!-- Tarjetas de confirmación: nada se aplica hasta que alguien toca el botón -->
            <div v-if="m.propuestas?.length" class="tasador-propuestas">
              <div v-for="p in m.propuestas" :key="p.id" class="tasador-propuesta" :class="'estado-' + (p.estado || 'pendiente')">
                <div class="tasador-propuesta-cab">
                  <v-icon :icon="iconoPropuesta(p.tipo)" size="16" />
                  <strong>{{ p.titulo }}</strong>
                  <v-chip v-if="p.tipo === 'solicitud_alef'" size="x-small" color="warning" variant="tonal">
                    Lo implementa Alef
                  </v-chip>
                </div>

                <dl class="tasador-propuesta-datos">
                  <template v-for="(v, k) in datosVisibles(p)" :key="k">
                    <dt>{{ etiqueta(String(k)) }}</dt>
                    <dd>{{ v }}</dd>
                  </template>
                </dl>

                <div v-if="p.estado === 'aplicada'" class="tasador-propuesta-ok">
                  <v-icon icon="mdi-check-circle" size="15" /> {{ p.mensaje || 'Aplicado.' }}
                </div>
                <div v-else-if="p.estado === 'descartada'" class="tasador-propuesta-no">
                  <v-icon icon="mdi-close-circle" size="15" /> Descartado.
                </div>
                <div v-else-if="p.error" class="tasador-propuesta-no">
                  <v-icon icon="mdi-alert-circle" size="15" /> {{ p.error }}
                </div>

                <div v-if="!p.estado" class="tasador-propuesta-acciones">
                  <button class="btn-primary" :disabled="p.aplicando || !puedeEditar" @click="confirmarPropuesta(p)">
                    <v-icon icon="mdi-check" size="15" />
                    <span>{{ p.tipo === 'solicitud_alef' ? 'Enviar solicitud' : 'Confirmar cambio' }}</span>
                  </button>
                  <button class="tasador-btn-plano" :disabled="p.aplicando" @click="descartarPropuesta(p)">
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          </template>

          <div v-if="pensando" class="tasador-msg rol-assistant">
            <div class="tasador-avatar"><v-icon icon="mdi-car-wrench" size="16" /></div>
            <div class="tasador-burbuja tasador-pensando">
              <span class="tasador-typing"><span></span><span></span><span></span></span>
              Consultando los datos de Trade Cars…
            </div>
          </div>

          <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable
            @click:close="error = ''">
            {{ error }}
          </v-alert>
        </div>

        <div class="tasador-input">
          <v-textarea v-model="borrador" placeholder="Escribe tu pregunta… (Enter envía, Shift+Enter salto de línea)"
            density="compact" variant="outlined" rows="1" max-rows="5" auto-grow hide-details
            :disabled="pensando" @keydown="onKeydown" />
          <button class="btn-primary tasador-enviar" :disabled="pensando || !borrador.trim()"
            @click="enviarMensaje()">
            <v-icon icon="mdi-send" size="18" />
          </button>
        </div>
      </div>

      <!-- ═══════════════════ PARÁMETROS ═══════════════════ -->
      <div v-show="tab === 'parametros'">
        <p class="tasador-ayuda">
          Estos son los números con los que el agente de WhatsApp cotiza. Se leen en cada tasación:
          lo que cambies aquí aplica desde la siguiente conversación, sin reinstalar nada.
        </p>

        <div v-for="(params, categoria) in parametrosPorCategoria" :key="categoria" class="tasador-grupo">
          <h3 class="tasador-grupo-titulo">{{ nombreCategoria(String(categoria)) }}</h3>
          <div class="tasador-params">
            <div v-for="p in params" :key="p.clave" class="tasador-param">
              <div class="tasador-param-cab">
                <span class="tasador-param-valor">{{ p.valor }}<small v-if="nombreUnidad(p.unidad)"> {{ nombreUnidad(p.unidad) }}</small></span>
                <button v-if="puedeEditar" class="tasador-param-editar" @click="abrirEdicion(p)">
                  <v-icon icon="mdi-pencil" size="14" />
                </button>
              </div>
              <code class="tasador-param-clave">{{ p.clave }}</code>
              <p class="tasador-param-desc">{{ p.descripcion }}</p>
              <p v-if="p.actualizado_por" class="tasador-param-meta">
                Último cambio: {{ p.actualizado_por }} · {{ fechaCorta(p.actualizado_en) }}
              </p>
            </div>
          </div>
        </div>

        <v-alert v-if="!cargandoConfig && !config?.parametros_detalle?.length" type="warning" variant="tonal" density="compact">
          No hay parámetros cargados. Hay que correr <code>sql/tradecars_tasador_config.sql</code> en Supabase.
        </v-alert>
      </div>

      <!-- ═══════════════════ REGLAS Y ROTACIÓN ═══════════════════ -->
      <div v-show="tab === 'reglas'">
        <h3 class="tasador-grupo-titulo">Reglas por marca y modelo</h3>
        <p class="tasador-ayuda">
          Ajustes que se aplican sólo cuando el auto coincide con la marca, el modelo y las condiciones
          de la regla. Si aplican varias, se suman una tras otra.
        </p>
        <v-table density="compact" class="mb-6">
          <thead>
            <tr>
              <th>Marca</th><th>Modelo</th><th>Condición</th><th>Ajuste</th><th>Descripción</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in config?.reglas || []" :key="r.id">
              <td>{{ r.marca }}</td>
              <td>{{ r.modelo }}</td>
              <td class="tasador-td-cond">{{ condicionRegla(r) }}</td>
              <td>
                <v-chip size="x-small" :color="r.tipo_ajuste === 'flag' ? 'info' : 'primary'" variant="tonal">
                  {{ r.tipo_ajuste === 'flag' ? r.flag : `${r.tipo_ajuste.replace('_', ' ')} ${r.valor_ajuste}` }}
                </v-chip>
              </td>
              <td class="tasador-td-desc">{{ r.descripcion }}</td>
              <td>
                <button v-if="puedeEditar" class="tasador-param-editar" title="Desactivar"
                  @click="desactivarRegla(r)">
                  <v-icon icon="mdi-close" size="14" />
                </button>
              </td>
            </tr>
            <tr v-if="!config?.reglas?.length">
              <td colspan="6" class="tasador-vacio">Sin reglas especiales cargadas.</td>
            </tr>
          </tbody>
        </v-table>

        <h3 class="tasador-grupo-titulo">Modelos de alta rotación</h3>
        <p class="tasador-ayuda">
          En estos modelos el Tasador no descuenta preventivamente: cotiza en el extremo alto del rango
          para asegurar la compra, porque sabe que se venden rápido.
        </p>
        <div class="tasador-rotacion">
          <div v-for="m in config?.alta_rotacion || []" :key="m.id" class="tasador-rotacion-item">
            <div>
              <strong>{{ m.marca }} {{ m.modelo }}</strong>
              <p v-if="m.motivo" class="tasador-param-meta">{{ m.motivo }}</p>
            </div>
            <button v-if="puedeEditar" class="tasador-param-editar" title="Quitar" @click="quitarRotacion(m)">
              <v-icon icon="mdi-close" size="14" />
            </button>
          </div>
          <p v-if="!config?.alta_rotacion?.length" class="tasador-vacio">Ningún modelo marcado.</p>
        </div>
      </div>

      <!-- ═══════════════════ DATOS (carga por archivo) ═══════════════════ -->
      <div v-show="tab === 'datos'">
        <p class="tasador-ayuda">
          Con estos datos cotiza el agente de WhatsApp. Se suben desde un Excel, un CSV o un PDF:
          el sistema reconoce las columnas solo, te muestra cómo quedarían los valores y recién
          importa cuando confirmas.
        </p>

        <div class="tasador-carga">
          <label class="tasador-campo">
            <span>¿Qué vas a cargar?</span>
            <select v-model="destinoCarga" class="tasador-select" :disabled="analizando || importando">
              <option value="historico">Comparables históricos (compras y ventas ya cerradas)</option>
              <option value="precios_nuevos">Precios de vehículos 0km</option>
            </select>
          </label>

          <label class="tasador-campo">
            <span>Archivo</span>
            <input ref="fileRef" type="file" accept=".xlsx,.csv,.pdf" class="tasador-select"
              :disabled="analizando || importando" @change="onArchivo" />
          </label>
        </div>

        <p class="tasador-param-meta">
          Los .xls antiguos hay que guardarlos como .xlsx. Si el PDF es una foto escaneada no se
          puede leer: en ese caso conviene pasar los datos a Excel.
        </p>

        <v-alert v-if="errorCarga" type="error" variant="tonal" density="compact" class="mt-3" closable
          @click:close="errorCarga = ''">{{ errorCarga }}</v-alert>

        <div v-if="analizando" class="tasador-cargando">
          <v-progress-circular indeterminate size="20" width="2" />
          <span>Leyendo el archivo y reconociendo las columnas…</span>
        </div>

        <!-- Paso 2: revisar el mapeo y la vista previa -->
        <template v-if="analisis">
          <h3 class="tasador-grupo-titulo mt-4">
            {{ analisis.total_filas }} filas detectadas — revisa cómo quedarían
          </h3>

          <v-table density="compact" class="mb-4">
            <thead>
              <tr><th>Campo del Tasador</th><th>Columna del archivo</th><th>Quedaría como</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in analisis.campos" :key="c.nombre">
                <td>
                  <strong>{{ c.nombre }}</strong>
                  <v-chip v-if="c.requerido" size="x-small" color="error" variant="tonal" class="ml-2">obligatorio</v-chip>
                  <p class="tasador-param-meta">{{ c.desc }}</p>
                </td>
                <td>
                  <select v-model="mapeoEditable[c.nombre]" class="tasador-select">
                    <option :value="null">— sin asignar —</option>
                    <option v-for="h in analisis.headers" :key="h" :value="h">{{ h }}</option>
                  </select>
                </td>
                <td class="tasador-td-cond">{{ ejemploConvertido(c.nombre) }}</td>
              </tr>
            </tbody>
          </v-table>

          <div class="tasador-propuesta-acciones mb-6">
            <button class="btn-primary" :disabled="importando" @click="importar">
              <v-icon icon="mdi-database-import" size="15" />
              <span>{{ importando ? 'Importando…' : `Importar ${analisis.total_filas} filas` }}</span>
            </button>
            <button class="tasador-btn-plano" :disabled="importando" @click="cancelarCarga">Cancelar</button>
          </div>
        </template>

        <v-alert v-if="resultadoCarga" type="success" variant="tonal" density="compact" class="mb-4">
          {{ resultadoCarga.mensaje }}
          <div v-if="resultadoCarga.filas_descartadas" class="mt-2">
            <strong>{{ resultadoCarga.filas_descartadas }} filas quedaron fuera.</strong>
            <ul class="tasador-bloqueos">
              <li v-for="(d, i) in (resultadoCarga.descartes || []).slice(0, 6)" :key="i">
                Fila {{ d.fila }}: {{ d.motivo }}
              </li>
            </ul>
          </div>
        </v-alert>

        <h3 class="tasador-grupo-titulo">Cargas anteriores</h3>
        <v-table density="compact">
          <thead>
            <tr><th>Fecha</th><th>Archivo</th><th>Destino</th><th class="text-right">Filas</th><th>Quién</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="imp in importaciones" :key="imp.id" :class="{ 'tasador-fila-deshecha': imp.estado === 'deshecha' }">
              <td class="tasador-td-cond">{{ fechaCorta(imp.created_at) }}</td>
              <td>{{ imp.archivo_nombre }}</td>
              <td class="tasador-td-cond">{{ imp.destino === 'historico' ? 'Comparables' : 'Precios 0km' }}</td>
              <td class="text-right">{{ imp.filas_importadas }}</td>
              <td class="tasador-td-cond">{{ imp.importado_por }}</td>
              <td>
                <button v-if="puedeEditar && imp.estado !== 'deshecha'" class="tasador-param-editar"
                  title="Deshacer esta carga" @click="deshacer(imp)">
                  <v-icon icon="mdi-undo" size="14" />
                </button>
                <span v-else-if="imp.estado === 'deshecha'" class="tasador-param-meta">deshecha</span>
              </td>
            </tr>
            <tr v-if="!importaciones.length">
              <td colspan="6" class="tasador-vacio">Todavía no se cargó ningún archivo.</td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- ═══════════════════ HISTORIAL ═══════════════════ -->
      <div v-show="tab === 'historial'">
        <template v-if="config?.pendientes_alef?.length">
          <h3 class="tasador-grupo-titulo">Pendientes de Alef</h3>
          <p class="tasador-ayuda">
            Cambios que tocan la lógica o el flujo del agente. No se pueden aplicar desde el dashboard:
            los implementa el equipo técnico en n8n.
          </p>
          <div class="tasador-pendientes">
            <div v-for="s in config.pendientes_alef" :key="s.id" class="tasador-pendiente">
              <v-icon icon="mdi-progress-wrench" size="16" />
              <div>
                <strong>{{ s.resumen }}</strong>
                <p v-if="s.motivo" class="tasador-param-meta">{{ s.motivo }}</p>
                <p class="tasador-param-meta">{{ s.solicitado_por }} · {{ fechaCorta(s.created_at) }}</p>
              </div>
            </div>
          </div>
        </template>

        <h3 class="tasador-grupo-titulo">Todos los cambios</h3>
        <v-table density="compact">
          <thead>
            <tr><th>Fecha</th><th>Cambio</th><th>Motivo</th><th>Quién</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr v-for="h in config?.historial || []" :key="h.id">
              <td class="tasador-td-cond">{{ fechaCorta(h.created_at) }}</td>
              <td>{{ h.resumen }}</td>
              <td class="tasador-td-desc">{{ h.motivo || '—' }}</td>
              <td class="tasador-td-cond">{{ h.solicitado_por || '—' }}</td>
              <td>
                <v-chip size="x-small" variant="tonal" :color="colorEstado(h.estado)">{{ etiquetaEstado(h.estado) }}</v-chip>
              </td>
            </tr>
            <tr v-if="!config?.historial?.length">
              <td colspan="5" class="tasador-vacio">Todavía no se registró ningún cambio.</td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </div>

    <!-- Edición manual de un parámetro desde el panel -->
    <v-dialog v-model="dialogoEdicion" max-width="480">
      <v-card v-if="editando">
        <v-card-title class="text-subtitle-1">{{ editando.clave }}</v-card-title>
        <v-card-text>
          <p class="tasador-param-desc mb-3">{{ editando.descripcion }}</p>
          <v-text-field v-model.number="nuevoValor" type="number" density="compact" variant="outlined"
            :label="editando.unidad || 'Valor'" :hint="rangoTexto(editando)" persistent-hint autofocus />
          <v-text-field v-model="motivoEdicion" density="compact" variant="outlined" class="mt-3"
            label="Motivo del cambio (opcional)" hide-details />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogoEdicion = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardarParametro">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ notificar: [texto: string, color?: string] }>()

interface Propuesta {
  id: string
  tipo: string
  accion: string
  titulo: string
  datos: Record<string, any>
  estado?: 'aplicada' | 'descartada'
  aplicando?: boolean
  mensaje?: string
  error?: string
}
interface TasadorMensaje {
  role: 'user' | 'assistant'
  content: string
  propuestas?: Propuesta[]
}

const tab = ref('chat')
const mensajes = usePersistente<TasadorMensaje[]>('tradecars:tasador:mensajes', [])
const borrador = ref('')
const pensando = ref(false)
const error = ref('')
const scrollRef = ref<HTMLElement | null>(null)

const config = ref<any>(null)
const cargandoConfig = ref(false)
const puedeEditar = computed(() => !!config.value?.puede_editar)

const sugerencias = [
  '¿Cómo viene el embudo este mes?',
  '¿Cuánto se pagó antes por un Toyota Yaris 2018?',
  '¿Cómo va cada asesor?',
  'Sube el descuento por kilometraje a 2%',
]

/* ══════════ Configuración ══════════ */

async function cargarConfig() {
  cargandoConfig.value = true
  try {
    config.value = await $fetch('/api/tradecars/tasador-config')
  } catch (e: any) {
    emit('notificar', e?.data?.statusMessage || 'No se pudo cargar la configuración del Tasador', 'error')
  } finally {
    cargandoConfig.value = false
  }
}
onMounted(cargarConfig)

const parametrosPorCategoria = computed(() => {
  const grupos: Record<string, any[]> = {}
  for (const p of config.value?.parametros_detalle || []) {
    const cat = p.categoria || 'Otros'
    ;(grupos[cat] ||= []).push(p)
  }
  return grupos
})

/* ══════════ Chat ══════════ */

function scrollAbajo() {
  nextTick(() => {
    if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    enviarMensaje()
  }
}

async function enviarMensaje(textoSugerido?: string) {
  const texto = (textoSugerido ?? borrador.value).trim()
  if (!texto || pensando.value) return

  error.value = ''
  mensajes.value = [...mensajes.value, { role: 'user', content: texto }]
  borrador.value = ''
  pensando.value = true
  scrollAbajo()

  try {
    // Sólo viajan role y content: las propuestas son estado local de la UI.
    const historial = mensajes.value.map((m) => ({ role: m.role, content: m.content }))
    const resp = await $fetch<{ reply: string; propuestas: Propuesta[] }>('/api/tradecars/tasador-chat', {
      method: 'POST',
      body: { messages: historial },
    })
    mensajes.value = [...mensajes.value, {
      role: 'assistant',
      content: resp.reply,
      propuestas: resp.propuestas?.length ? resp.propuestas : undefined,
    }]
  } catch (e: any) {
    const msg = e?.data?.statusMessage || e?.statusMessage || e?.message || 'No se pudo consultar al Tasador'
    error.value = msg
    emit('notificar', msg, 'error')
  } finally {
    pensando.value = false
    scrollAbajo()
  }
}

function nuevaConversacion() {
  mensajes.value = []
  error.value = ''
}

/* ══════════ Aplicar propuestas ══════════ */

function descartarPropuesta(p: Propuesta) {
  p.estado = 'descartada'
  // El array vive en localStorage: sin reasignar, la mutación anidada no se persiste.
  mensajes.value = [...mensajes.value]
}

async function confirmarPropuesta(p: Propuesta) {
  p.aplicando = true
  p.error = ''
  try {
    const resp = await $fetch<{ mensaje: string }>('/api/tradecars/tasador-config', {
      method: 'POST',
      body: { accion: p.accion, ...p.datos, origen: 'chat_tasador' },
    })
    p.estado = 'aplicada'
    p.mensaje = resp.mensaje
    emit('notificar', resp.mensaje)
    await cargarConfig()
  } catch (e: any) {
    p.error = e?.data?.statusMessage || e?.statusMessage || 'No se pudo aplicar el cambio'
    emit('notificar', p.error!, 'error')
  } finally {
    p.aplicando = false
    // Vue no ve la mutación en el array persistido si no lo reasignamos.
    mensajes.value = [...mensajes.value]
  }
}

/* ══════════ Edición desde el panel ══════════ */

const dialogoEdicion = ref(false)
const editando = ref<any>(null)
const nuevoValor = ref<number | null>(null)
const motivoEdicion = ref('')
const guardando = ref(false)

function abrirEdicion(p: any) {
  editando.value = p
  nuevoValor.value = Number(p.valor)
  motivoEdicion.value = ''
  dialogoEdicion.value = true
}

async function guardarParametro() {
  if (!editando.value) return
  guardando.value = true
  try {
    const resp = await $fetch<{ mensaje: string }>('/api/tradecars/tasador-config', {
      method: 'POST',
      body: {
        accion: 'actualizar_parametro',
        clave: editando.value.clave,
        valor: nuevoValor.value,
        motivo: motivoEdicion.value || null,
        origen: 'panel',
      },
    })
    emit('notificar', resp.mensaje)
    dialogoEdicion.value = false
    await cargarConfig()
  } catch (e: any) {
    emit('notificar', e?.data?.statusMessage || 'No se pudo guardar', 'error')
  } finally {
    guardando.value = false
  }
}

async function desactivarRegla(r: any) {
  try {
    const resp = await $fetch<{ mensaje: string }>('/api/tradecars/tasador-config', {
      method: 'POST',
      body: { accion: 'desactivar_regla', id: r.id, origen: 'panel' },
    })
    emit('notificar', resp.mensaje)
    await cargarConfig()
  } catch (e: any) {
    emit('notificar', e?.data?.statusMessage || 'No se pudo desactivar', 'error')
  }
}

async function quitarRotacion(m: any) {
  try {
    const resp = await $fetch<{ mensaje: string }>('/api/tradecars/tasador-config', {
      method: 'POST',
      body: { accion: 'quitar_alta_rotacion', id: m.id, origen: 'panel' },
    })
    emit('notificar', resp.mensaje)
    await cargarConfig()
  } catch (e: any) {
    emit('notificar', e?.data?.statusMessage || 'No se pudo quitar', 'error')
  }
}

/* ══════════ Carga de datos por archivo ══════════ */

const destinoCarga = ref<'historico' | 'precios_nuevos'>('historico')
const fileRef = ref<HTMLInputElement | null>(null)
const analizando = ref(false)
const importando = ref(false)
const errorCarga = ref('')
const analisis = ref<any>(null)
const mapeoEditable = ref<Record<string, string | null>>({})
const resultadoCarga = ref<any>(null)
const importaciones = ref<any[]>([])

// El base64 se guarda entre "analizar" e "importar" para no volver a pedirle el
// archivo al usuario. No es reactivo a propósito: son varios MB y no hace falta
// que Vue los observe.
let archivoBase64 = ''
let archivoNombre = ''

async function cargarImportaciones() {
  try {
    const r = await $fetch<{ importaciones: any[] }>('/api/tradecars/tasador-datos', {
      method: 'POST', body: { accion: 'listar' },
    })
    importaciones.value = r.importaciones || []
  } catch { /* la lista es informativa: si falla, no bloquea la carga */ }
}
onMounted(cargarImportaciones)

function leerComoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || '').replace(/^data:[^;]+;base64,/, ''))
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'))
    fr.readAsDataURL(file)
  })
}

async function onArchivo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  errorCarga.value = ''
  resultadoCarga.value = null
  analisis.value = null
  analizando.value = true

  try {
    archivoBase64 = await leerComoBase64(file)
    archivoNombre = file.name

    const r = await $fetch<any>('/api/tradecars/tasador-datos', {
      method: 'POST',
      body: {
        accion: 'analizar',
        destino: destinoCarga.value,
        archivo_base64: archivoBase64,
        archivo_nombre: archivoNombre,
      },
    })
    analisis.value = r
    mapeoEditable.value = { ...r.mapeo_sugerido }
  } catch (err: any) {
    errorCarga.value = err?.data?.statusMessage || err?.statusMessage || 'No se pudo leer el archivo'
  } finally {
    analizando.value = false
  }
}

/** Muestra el valor ya convertido de la primera fila, para detectar mapeos malos. */
function ejemploConvertido(campo: string) {
  const col = mapeoEditable.value[campo]
  if (!col) return '—'
  // La previa del servidor se calculó con el mapeo sugerido; si el usuario lo
  // cambió, se cae al valor crudo de la muestra, que igual sirve para comparar.
  const sugerida = analisis.value?.mapeo_sugerido?.[campo]
  if (sugerida === col) {
    const v = analisis.value?.previa?.[0]?.[campo]
    return v === null || v === undefined ? '(vacío)' : String(v)
  }
  const crudo = analisis.value?.muestra?.[0]?.[col]
  return crudo === null || crudo === undefined || crudo === '' ? '(vacío)' : String(crudo)
}

function cancelarCarga() {
  analisis.value = null
  archivoBase64 = ''
  archivoNombre = ''
  if (fileRef.value) fileRef.value.value = ''
}

async function importar() {
  if (!analisis.value) return
  importando.value = true
  errorCarga.value = ''
  try {
    const r = await $fetch<any>('/api/tradecars/tasador-datos', {
      method: 'POST',
      body: {
        accion: 'importar',
        destino: destinoCarga.value,
        archivo_base64: archivoBase64,
        archivo_nombre: archivoNombre,
        mapeo: mapeoEditable.value,
      },
    })
    resultadoCarga.value = r
    emit('notificar', r.mensaje)
    cancelarCarga()
    await Promise.all([cargarImportaciones(), cargarConfig()])
  } catch (err: any) {
    errorCarga.value = err?.data?.statusMessage || err?.statusMessage || 'No se pudo importar'
    emit('notificar', errorCarga.value, 'error')
  } finally {
    importando.value = false
  }
}

async function deshacer(imp: any) {
  if (!confirm(`¿Quitar las ${imp.filas_importadas} filas que trajo "${imp.archivo_nombre}"?`)) return
  try {
    const r = await $fetch<{ mensaje: string }>('/api/tradecars/tasador-datos', {
      method: 'POST', body: { accion: 'deshacer', batch_id: imp.id },
    })
    emit('notificar', r.mensaje)
    await Promise.all([cargarImportaciones(), cargarConfig()])
  } catch (err: any) {
    emit('notificar', err?.data?.statusMessage || 'No se pudo deshacer', 'error')
  }
}

/* ══════════ Presentación ══════════ */

const ETIQUETAS: Record<string, string> = {
  clave: 'Parámetro', valor: 'Nuevo valor', motivo: 'Motivo',
  marca: 'Marca', modelo: 'Modelo', tipo_ajuste: 'Tipo de ajuste',
  valor_ajuste: 'Valor', descripcion: 'Descripción', gnv_glp: 'GNV/GLP',
  anio_min: 'Año desde', anio_max: 'Año hasta', motivo_rotacion: 'Por qué rota rápido',
  resumen: 'Qué se pide', id: 'Identificador',
}
function etiqueta(k: string) { return ETIQUETAS[k] || k }

/** Oculta campos vacíos y los ids internos, que no le dicen nada al usuario. */
function datosVisibles(p: Propuesta) {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(p.datos || {})) {
    if (v === null || v === undefined || v === '') continue
    if (k === 'id') continue
    out[k] = v
  }
  return out
}

// Las categorías y unidades vienen de quien armó el Tasador y son técnicas
// ("km", "techo_nuevo", "usd_por_anio"). Se traducen sólo para mostrar; el
// valor de la base no se toca, así que si mañana agregan una categoría nueva
// aparece tal cual en vez de desaparecer.
const CATEGORIAS: Record<string, string> = {
  km: 'Kilometraje',
  anio: 'Año',
  transmision: 'Transmisión',
  techo_nuevo: 'Techo del 0km',
  margen: 'Margen',
  rotacion: 'Rotación',
  ancla: 'Comparables',
  confianza: 'Amplitud del rango',
  divergencia: 'Control de divergencia',
}
function nombreCategoria(c: string) {
  return CATEGORIAS[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ') : 'Otros')
}

const UNIDADES: Record<string, string> = {
  pct: '%',
  usd: 'USD',
  km: 'km',
  dias: 'días',
  entero: '',
  usd_por_anio: 'USD por año',
}
function nombreUnidad(u?: string | null) {
  if (!u) return ''
  return u in UNIDADES ? UNIDADES[u] : u
}

function iconoPropuesta(tipo: string) {
  if (tipo === 'parametro') return 'mdi-tune-variant'
  if (tipo === 'regla') return 'mdi-format-list-checks'
  if (tipo === 'alta_rotacion') return 'mdi-rotate-right'
  return 'mdi-progress-wrench'
}

function condicionRegla(r: any) {
  const partes: string[] = []
  if (r.gnv_glp) partes.push(`GNV/GLP: ${r.gnv_glp}`)
  if (r.anio_min) partes.push(`desde ${r.anio_min}`)
  if (r.anio_max) partes.push(`hasta ${r.anio_max}`)
  return partes.join(' · ') || 'Siempre'
}

function rangoTexto(p: any) {
  if (p.minimo == null && p.maximo == null) return ''
  if (p.minimo != null && p.maximo != null) return `Permitido entre ${p.minimo} y ${p.maximo}`
  if (p.minimo != null) return `Mínimo ${p.minimo}`
  return `Máximo ${p.maximo}`
}

function fechaCorta(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })
}

function colorEstado(e: string) {
  if (e === 'pendiente_alef') return 'warning'
  if (e === 'resuelto_alef') return 'success'
  if (e === 'rechazado') return 'error'
  return 'primary'
}
function etiquetaEstado(e: string) {
  if (e === 'pendiente_alef') return 'Pendiente Alef'
  if (e === 'resuelto_alef') return 'Resuelto'
  if (e === 'rechazado') return 'Rechazado'
  return 'Aplicado'
}
</script>

<style scoped>
.tasador-area {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  min-height: 420px;
}

.tasador-mensajes {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 4px 12px;
}

.tasador-bienvenida {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 16px;
  margin: auto 0;
}
.tasador-bienvenida-texto {
  max-width: 470px;
  margin-top: 10px;
  font-size: 0.85rem;
  color: var(--muted-foreground);
  line-height: 1.5;
}
.tasador-sugerencias {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 18px;
  max-width: 560px;
}
.tasador-chip {
  font-size: 0.78rem;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--foreground);
  cursor: pointer;
  transition: background 0.15s ease;
}
.tasador-chip:hover { background: rgba(218, 165, 32, 0.14); border-color: #daa520; }

.tasador-msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 78%;
}
.tasador-msg.rol-user {
  flex-direction: row-reverse;
  align-self: flex-end;
}
.tasador-avatar {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--muted);
  color: var(--muted-foreground);
}
.rol-user .tasador-avatar { background: rgba(218, 165, 32, 0.18); color: #daa520; }

.tasador-burbuja {
  background: var(--muted);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 0.86rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.rol-user .tasador-burbuja { background: rgba(218, 165, 32, 0.14); }

.tasador-pensando { display: flex; align-items: center; gap: 8px; opacity: 0.75; }
.tasador-typing { display: inline-flex; gap: 3px; }
.tasador-typing span {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--muted-foreground);
  animation: tasador-blink 1.2s infinite ease-in-out;
}
.tasador-typing span:nth-child(2) { animation-delay: 0.2s; }
.tasador-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes tasador-blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }

/* ── Propuestas de cambio ── */
.tasador-propuestas { display: flex; flex-direction: column; gap: 10px; max-width: 78%; margin-left: 34px; }
.tasador-propuesta {
  border: 1px solid var(--border);
  border-left: 3px solid #daa520;
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--card, var(--muted));
  font-size: 0.83rem;
}
.tasador-propuesta.estado-aplicada { border-left-color: #4caf50; opacity: 0.85; }
.tasador-propuesta.estado-descartada { border-left-color: var(--border); opacity: 0.5; }
.tasador-propuesta-cab { display: flex; align-items: center; gap: 7px; margin-bottom: 9px; }
.tasador-propuesta-datos {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 12px;
  margin: 0 0 10px;
}
.tasador-propuesta-datos dt { color: var(--muted-foreground); font-size: 0.78rem; }
.tasador-propuesta-datos dd { margin: 0; word-break: break-word; }
.tasador-propuesta-acciones { display: flex; gap: 8px; }

/* El proyecto sólo define .btn-primary y .btn-warning a nivel global. */
.tasador-btn-plano {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  font-size: 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--foreground);
  cursor: pointer;
  transition: background 0.15s ease;
}
.tasador-btn-plano:hover:not(:disabled) { background: var(--muted); }
.tasador-btn-plano:disabled { opacity: 0.45; cursor: not-allowed; }
.tasador-propuesta-ok { display: flex; align-items: center; gap: 6px; color: #4caf50; }
.tasador-propuesta-no { display: flex; align-items: center; gap: 6px; color: var(--muted-foreground); }

.tasador-input {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.tasador-input :deep(textarea) { font-size: 0.86rem; }
.tasador-enviar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tasador-enviar:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Paneles ── */
.tasador-ayuda { font-size: 0.82rem; color: var(--muted-foreground); margin: 0 0 14px; max-width: 720px; line-height: 1.5; }
.tasador-bloqueos { margin: 6px 0 0; padding-left: 18px; font-size: 0.82rem; }
.tasador-grupo { margin-bottom: 22px; }
.tasador-grupo-titulo {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
  margin: 0 0 10px;
}
.tasador-params { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.tasador-param { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
.tasador-param-cab { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.tasador-param-valor { font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.tasador-param-valor small { font-size: 0.72rem; font-weight: 400; color: var(--muted-foreground); margin-left: 4px; }
.tasador-param-editar {
  border: none; background: transparent; color: var(--muted-foreground);
  cursor: pointer; padding: 3px; border-radius: 5px;
}
.tasador-param-editar:hover { background: var(--muted); color: #daa520; }
.tasador-param-clave { font-size: 0.72rem; color: var(--muted-foreground); }
.tasador-param-desc { font-size: 0.79rem; line-height: 1.45; margin: 7px 0 0; }
.tasador-param-meta { font-size: 0.72rem; color: var(--muted-foreground); margin: 5px 0 0; }

.tasador-td-cond, .tasador-td-desc { font-size: 0.79rem; color: var(--muted-foreground); }
.tasador-td-desc { max-width: 320px; }
.tasador-vacio { text-align: center; color: var(--muted-foreground); font-size: 0.82rem; padding: 16px 0; }

.tasador-rotacion { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.tasador-rotacion-item {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
  border: 1px solid var(--border); border-radius: 10px; padding: 11px 13px;
}

/* ── Carga de datos ── */
.tasador-carga { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 8px; }
.tasador-campo { display: flex; flex-direction: column; gap: 5px; min-width: 260px; flex: 1; }
.tasador-campo > span { font-size: 0.78rem; color: var(--muted-foreground); }
.tasador-select {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--background, transparent);
  color: var(--foreground);
  font-size: 0.83rem;
  width: 100%;
}
.tasador-cargando {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.84rem; color: var(--muted-foreground); padding: 16px 0;
}
.tasador-fila-deshecha { opacity: 0.45; text-decoration: line-through; }
.text-right { text-align: right; }

.tasador-pendientes { display: flex; flex-direction: column; gap: 9px; margin-bottom: 24px; }
.tasador-pendiente {
  display: flex; gap: 10px; align-items: flex-start;
  border: 1px solid var(--border); border-left: 3px solid #ff9800;
  border-radius: 9px; padding: 11px 13px; font-size: 0.84rem;
}

@media (max-width: 700px) {
  .tasador-msg { max-width: 92%; }
  .tasador-propuestas { max-width: 100%; margin-left: 0; }
}
</style>
