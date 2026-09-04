<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Clientes</h1>
      <button v-if="puedeCrear" class="btn-primary" @click="abrirNuevo">
        <v-icon icon="mdi-account-plus" size="16" /><span>Nuevo cliente</span>
      </button>
    </header>

    <div class="content-area">
      <!-- KPIs -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Clientes activos</span></div>
          <div class="stat-value">{{ activos.length }}</div>
          <div class="stat-description">{{ inactivos.length }} dado(s) de baja</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Listos para facturar</span></div>
          <div class="stat-value">{{ listosParaFacturar.length }}</div>
          <div class="stat-description">Con razón social y RUC de 11 dígitos</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Con contrato vigente</span></div>
          <div class="stat-value">{{ conContratoVigente.length }}</div>
          <div class="stat-description">El contrato se administra en Facturación</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Compromiso mensual</span></div>
          <div class="stat-value">{{ compromisoTotal }}</div>
          <div class="stat-description">Piezas/contenidos comprometidos al mes</div>
        </div>
      </div>

      <!--
        El aviso no es decorativo: un cliente sin RUC entra igual al desplegable
        de Facturación, pero al emitir una FACTURA el servidor lo rechaza
        (factura.post.ts exige RUC para tipo 1). Mejor verlo acá que con el
        cliente esperando.
      -->
      <v-alert v-if="sinDocumento.length" type="info" variant="tonal" density="compact" class="mb-4">
        {{ sinDocumento.length }} cliente(s) activos todavía no tienen RUC cargado. Se pueden facturar
        con boleta, pero para emitirles una <b>factura</b> hay que completar su ficha.
      </v-alert>

      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">Registro de clientes ({{ clientesFiltrados.length }})</span>
        </v-card-title>

        <div class="filtros-bar">
          <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify"
            placeholder="Nombre, razón social, RUC, contacto…" density="compact" hide-details
            variant="outlined" clearable class="filtro filtro-buscar" />
          <v-select v-model="fEstado" :items="OPCIONES_ESTADO" density="compact" hide-details
            variant="outlined" label="Estado" class="filtro" />
          <v-switch v-model="soloFacturables" color="primary" density="compact" hide-details
            label="Solo listos para facturar" class="filtro" style="flex:0 0 auto;" />
        </div>

        <v-data-table :headers="headers" :items="clientesFiltrados" :loading="cargando"
          class="elevation-0" no-data-text="Todavía no hay clientes registrados" :items-per-page="25"
          @click:row="(_: any, r: any) => abrirFicha(r.item)">
          <template v-slot:item.nombre="{ item }">
            <strong>{{ item.nombre }}</strong>
            <div v-if="item.razon_social && item.razon_social !== item.nombre" class="sub-celda">
              {{ item.razon_social }}
            </div>
          </template>
          <template v-slot:item.documento="{ item }">
            <span v-if="item.ruc || item.dni">
              {{ item.tipo_documento || (item.ruc ? 'RUC' : 'DNI') }}
              {{ item.ruc || item.dni }}
            </span>
            <span v-else style="opacity:.35">—</span>
          </template>
          <template v-slot:item.contacto="{ item }">
            <span v-if="item.contacto">{{ item.contacto }}</span>
            <span v-else style="opacity:.35">—</span>
            <div v-if="item.contacto_cargo" class="sub-celda">{{ item.contacto_cargo }}</div>
          </template>
          <template v-slot:item.email_facturacion="{ item }">
            <span v-if="item.email_facturacion || item.email">{{ item.email_facturacion || item.email }}</span>
            <span v-else style="opacity:.35">—</span>
          </template>
          <template v-slot:item.condicion_pago="{ item }">
            <span v-if="item.condicion_pago">{{ item.condicion_pago }}</span>
            <span v-else style="opacity:.35">—</span>
          </template>
          <template v-slot:item.detraccion_pct="{ item }">
            <span v-if="item.detraccion_pct !== null && item.detraccion_pct !== undefined">
              {{ item.detraccion_pct }} %<span v-if="item.detraccion_codigo" class="sub-celda">
                cód. {{ item.detraccion_codigo }}</span>
            </span>
            <span v-else style="opacity:.35">—</span>
          </template>
          <template v-slot:item.contratos="{ item }">
            <v-chip v-if="contratosDe(item).length" size="x-small" variant="flat"
              :color="colorEstadoContrato(estadoMasUrgente(item))">
              {{ contratosDe(item).length }} · {{ textoEstadoContrato(estadoMasUrgente(item)) }}
            </v-chip>
            <span v-else style="opacity:.35">—</span>
          </template>
          <template v-slot:item.documentos="{ item }">
            <v-icon v-if="item.ficha_ruc_pdf" icon="mdi-card-account-details-outline" size="17"
              color="primary" title="Tiene ficha RUC" />
            <v-chip v-if="adjuntosDe(item.id).length" size="x-small" variant="tonal" class="ml-1">
              {{ adjuntosDe(item.id).length }}
            </v-chip>
            <span v-if="!item.ficha_ruc_pdf && !adjuntosDe(item.id).length" style="opacity:.35">—</span>
          </template>
          <template v-slot:item.activo="{ item }">
            <v-chip size="x-small" variant="flat" :color="item.activo === false ? 'grey' : 'success'">
              {{ item.activo === false ? 'De baja' : 'Activo' }}
            </v-chip>
          </template>
        </v-data-table>
      </v-card>
    </div>

    <!-- ══════════ FICHA DEL CLIENTE ══════════ -->
    <v-dialog :model-value="!!ficha" max-width="960" scrollable @update:model-value="cerrarFicha">
      <v-card v-if="ficha">
        <v-card-title class="pt-4" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-weight:700;">{{ ficha.id ? ficha.nombre || 'Cliente' : 'Nuevo cliente' }}</span>
          <v-chip v-if="ficha.id && ficha.activo === false" size="small" variant="flat" color="grey">
            De baja
          </v-chip>
        </v-card-title>

        <v-card-text>
          <v-form ref="formRef">
            <!-- ── Identificación ── -->
            <div class="form-section-title">Identificación</div>
            <div class="form-grid">
              <v-text-field v-model="ficha.nombre" label="Nombre comercial / marca *"
                density="compact" variant="outlined" :rules="[ruleRequerido]"
                hint="Es lo que se ve en el desplegable de Facturación" persistent-hint />
              <v-text-field v-model="ficha.razon_social" label="Razón social"
                density="compact" variant="outlined" hide-details="auto"
                hint="Lo que se imprime en el comprobante" persistent-hint />
              <v-select v-model="ficha.tipo_documento" :items="TIPOS_DOCUMENTO" label="Tipo de documento"
                density="compact" hide-details variant="outlined" />
              <v-text-field v-model="ficha.ruc" label="RUC" density="compact" variant="outlined"
                maxlength="11" :rules="[ruleRucSegunTipo]" hint="11 dígitos" persistent-hint />
              <v-text-field v-model="ficha.dni" label="DNI / documento de la persona"
                density="compact" variant="outlined" maxlength="12" :rules="[ruleDniOpcional]"
                hint="Para boletas a persona natural" persistent-hint />
              <v-text-field v-model="ficha.telefono" label="Teléfono / WhatsApp"
                density="compact" hide-details variant="outlined" />
            </div>

            <!-- ── Contacto ── -->
            <div class="form-section-title" style="margin-top:18px;">Contacto</div>
            <div class="form-grid">
              <v-text-field v-model="ficha.contacto" label="Persona de contacto"
                density="compact" hide-details variant="outlined" />
              <v-text-field v-model="ficha.contacto_cargo" label="Cargo"
                density="compact" hide-details variant="outlined" />
              <v-text-field v-model="ficha.email" label="Correo general"
                density="compact" hide-details variant="outlined" />
              <v-text-field v-model="ficha.email_facturacion" label="Correo de facturación"
                density="compact" variant="outlined" hide-details="auto"
                hint="Al que se manda el comprobante" persistent-hint />
              <v-text-field v-model="ficha.direccion" label="Dirección"
                density="compact" hide-details variant="outlined" class="col-2" />
              <v-text-field v-model="ficha.direccion_fiscal" label="Dirección fiscal"
                density="compact" variant="outlined" hide-details="auto" class="col-2"
                hint="La que va en la factura. Si se deja vacía, se usa la dirección de arriba"
                persistent-hint />
            </div>

            <!-- ── Condiciones comerciales ── -->
            <div class="form-section-title" style="margin-top:18px;">Condiciones comerciales</div>
            <div class="form-grid">
              <v-combobox v-model="ficha.condicion_pago" :items="CONDICIONES_PAGO"
                label="Condición de pago" density="compact" variant="outlined" clearable
                hide-details="auto" hint="'Crédito 30' fija el vencimiento al facturar"
                persistent-hint />
              <v-text-field v-model.number="ficha.compromiso_mensual" type="number" min="0"
                label="Compromiso mensual (piezas)" density="compact" hide-details variant="outlined" />
              <v-text-field v-model.number="ficha.detraccion_pct" type="number" min="0" max="100"
                label="% de detracción" density="compact" variant="outlined" hide-details="auto"
                hint="Se copia solo a la factura" persistent-hint />
              <v-text-field v-model="ficha.detraccion_codigo" label="Código de bien/servicio SUNAT"
                density="compact" variant="outlined" hide-details="auto"
                hint="Ej: 022 servicios empresariales" persistent-hint />
            </div>
            <v-textarea v-model="ficha.condiciones" label="Condiciones pactadas" rows="2"
              density="compact" hide-details variant="outlined" class="mt-3"
              placeholder="Alcance, entregables, penalidades, vigencia…" />
            <v-textarea v-model="ficha.notas" label="Notas internas" rows="2"
              density="compact" hide-details variant="outlined" class="mt-3" />

            <!-- ── Documentos ── -->
            <div class="form-section-title" style="margin-top:20px;">Documentos</div>
            <PiolaSubirPdf v-model="ficha.ficha_ruc_pdf" carpeta="clientes"
              label="Ficha RUC (PDF)" :disabled="!puedeEditar"
              @error="(m: string) => emit('notify', { text: m, color: 'error' })" />

            <!--
              Contrato, anexos y DNI van a `piola_adjuntos` (entidad='cliente'), no a
              columnas nuevas: un cliente puede tener N anexos. Se registran contra el
              cliente YA guardado porque la fila necesita su `entidad_id`.
            -->
            <div class="adjuntos-bloque">
              <div class="adjuntos-titulo">
                <v-icon icon="mdi-paperclip" size="16" />
                <span>Contrato, anexos y DNI ({{ adjuntosFicha.length }})</span>
              </div>

              <div v-if="!ficha.id" class="adjuntos-vacio">
                Guarda la ficha primero y después se le pueden adjuntar documentos.
              </div>

              <template v-else>
                <div v-for="a in adjuntosFicha" :key="a.id" class="doc-fila">
                  <v-icon icon="mdi-file-pdf-box" color="error" size="20" />
                  <div class="doc-datos">
                    <span class="doc-nombre">{{ a.nombre }}</span>
                    <span class="doc-tipo">{{ etiquetaTipoDoc(a.tipo_doc) }} · {{ fechaCorta(a.created_at) }}</span>
                  </div>
                  <v-spacer />
                  <v-btn size="x-small" variant="text" icon="mdi-eye" title="Ver aquí mismo"
                    @click="verDocumento(a.path, a.nombre)" />
                  <v-btn size="x-small" variant="text" icon="mdi-download" title="Descargar"
                    :href="urlDoc(a.path)" :download="a.nombre" />
                  <v-btn v-if="puedeEliminar" size="x-small" variant="text" icon="mdi-delete"
                    color="error" title="Quitar" @click="eliminarAdjunto(a)" />
                </div>

                <div v-if="!adjuntosFicha.length" class="adjuntos-vacio">
                  Este cliente todavía no tiene documentos adjuntos.
                </div>

                <div v-if="puedeEditar" class="adjunto-nuevo">
                  <v-select v-model="nuevoAdjunto.tipo_doc" :items="TIPOS_ADJUNTO_CLIENTE"
                    label="Tipo de documento" density="compact" hide-details variant="outlined"
                    style="max-width:220px;" />
                  <PiolaSubirPdf v-model="nuevoAdjunto.path" carpeta="clientes"
                    label="Documento (PDF)" style="flex:1 1 260px;"
                    @error="(m: string) => emit('notify', { text: m, color: 'error' })" />
                  <v-btn color="primary" variant="tonal" size="small" :disabled="!nuevoAdjunto.path"
                    :loading="subiendoAdjunto" @click="registrarAdjunto">
                    <v-icon icon="mdi-plus" start /> Adjuntar
                  </v-btn>
                </div>
              </template>
            </div>

            <!--
              Contratos en SOLO LECTURA: el CRUD vive en Facturación → "Contratos y
              adendas" (PiolaContratos.vue) y no se duplica acá. Esta lista es para
              no tener que salir de la ficha para saber cómo está la marca.
            -->
            <template v-if="ficha.id">
              <div class="form-section-title" style="margin-top:20px;">
                Contratos ({{ contratosFicha.length }})
              </div>
              <v-table v-if="contratosFicha.length" density="compact">
                <thead>
                  <tr>
                    <th>Inicio</th><th>Cierre</th><th class="text-right">Cuota mensual</th>
                    <th>Modalidad</th><th>Estado</th><th class="text-right">Documento</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in contratosFicha" :key="c.id">
                    <td>{{ fechaCorta(c.fecha_inicio) }}</td>
                    <td>{{ fechaCorta(c.fecha_cierre) }}</td>
                    <td class="text-right">
                      <span v-if="c.pago_mensual">{{ PEN(c.pago_mensual) }}</span>
                      <span v-else style="opacity:.35">—</span>
                    </td>
                    <td>{{ etiquetaModalidad(c.modalidad_pago) }}</td>
                    <td>
                      <v-chip size="x-small" variant="flat" :color="colorEstadoContrato(estadoContrato(c))">
                        {{ textoEstadoContrato(estadoContrato(c)) }}
                      </v-chip>
                    </td>
                    <td class="text-right">
                      <v-btn v-if="c.contrato_pdf" icon="mdi-file-eye" size="x-small" variant="text"
                        title="Ver el contrato aquí mismo"
                        @click="verDocumento(c.contrato_pdf, `Contrato — ${c.nombre_cliente || ficha.nombre}`)" />
                      <span v-else style="opacity:.35">—</span>
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <div v-else class="adjuntos-vacio">
                Sin contratos registrados. Se dan de alta en Facturación → Contratos y adendas.
              </div>
            </template>
          </v-form>
        </v-card-text>

        <v-card-actions style="padding: 12px 20px 18px; flex-wrap:wrap; gap:8px;">
          <v-btn v-if="ficha.id && puedeEliminar && ficha.activo !== false" color="error"
            variant="text" :loading="eliminando" @click="darDeBaja">
            Dar de baja
          </v-btn>
          <v-btn v-else-if="ficha.id && puedeEditar && ficha.activo === false" color="success"
            variant="text" :loading="guardando" @click="reactivar">
            Reactivar
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="cerrarFicha">Cerrar</v-btn>
          <v-btn v-if="puedeEditar || (!ficha.id && puedeCrear)" color="primary" variant="flat"
            :loading="guardando" @click="guardar">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Registro de clientes — reunión del 31/08/2026.
 *
 * Edson Polo (finanzas): "que haya un módulo donde yo registre a los clientes,
 * registro y en este registro inserta el contrato, las condiciones, anexos,
 * etcétera, DNI, etcétera, ficha RUC […] Y en ese otro módulo donde se emiten
 * las facturas haya un desplegable […] Ya sale en automático."
 *
 * O sea: la ficha se llena UNA vez acá y Facturación la lee. Este archivo es el
 * lado del registro; el autocompletado vive en PiolaFacturacion.vue.
 *
 * TRES COSAS QUE NO SON OBVIAS:
 *
 *  1. NO hay ninguna consulta a SUNAT. Edson descartó la integración
 *     expresamente ("nosotros solo vamos a vaciar información aquí"), así que el
 *     RUC se busca contra `piola_clientes` y nada más.
 *
 *  2. El CRUD de contratos NO está acá: vive en Facturación → "Contratos y
 *     adendas" (PiolaContratos.vue), con sus adendas y su semáforo. La ficha los
 *     muestra en solo lectura para no tener dos pantallas creando lo mismo.
 *
 *  3. La baja es LÓGICA (`activo = false`). El servidor no borra en duro porque
 *     `piola_invoices.cliente_id` es ON DELETE SET NULL: borrar al cliente
 *     dejaría facturas de años anteriores sin a quién atribuirlas.
 *
 * Toda escritura pasa por `apiPiola('clientes', …)`; las lecturas van directas.
 */
import { ref, computed, onMounted } from 'vue'
import { piolaCan, type PiolaModule } from '@/utils/permissions'
import {
  PEN, fechaCorta, hoyISO, urlDocumento, traerTodo, apiPiola, MODALIDADES_PAGO,
} from '@/composables/usePiola'
import { useFormRules } from '@/composables/rules'
import PiolaSubirPdf from './PiolaSubirPdf.vue'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const { ruleRuc } = useFormRules()

/**
 * Mismos módulos que `MODULOS_CLIENTE` en server/api/piola/clientes.post.ts:
 * la ficha del cliente la mantienen tres pantallas (CRM al convertir un lead,
 * Producción al mantener la marca y Facturación al registrar a quién factura),
 * y el endpoint usa `exigirAlguno()`. Si acá se exigiera un módulo concreto, el
 * botón desaparecería para gente que el servidor sí deja pasar.
 */
const MODULOS_CLIENTE: PiolaModule[] = ['crm', 'produccion', 'facturacion']
const puedeAlguno = (accion: 'view' | 'create' | 'edit' | 'delete') =>
  MODULOS_CLIENTE.some(m => piolaCan(props.perfil?.permisos, m, accion))

const puedeCrear = computed(() => puedeAlguno('create'))
const puedeEditar = computed(() => puedeAlguno('edit'))
const puedeEliminar = computed(() => puedeAlguno('delete'))

/* Mismo CHECK que `piola_clientes.tipo_documento`. El null es real y significa
   "todavía no tiene documento": una marca puede registrarse antes de que llegue
   su ficha RUC, y el endpoint solo exige el número cuando el tipo es 'RUC'. */
const TIPOS_DOCUMENTO = [
  { value: null, title: 'Sin documento todavía' },
  { value: 'RUC', title: 'RUC' },
  { value: 'DNI', title: 'DNI' },
  { value: 'CE', title: 'Carné de extranjería' },
  { value: 'PAS', title: 'Pasaporte' },
]

/* Sugerencias, no catálogo cerrado: la columna es TEXT libre y Piola pacta lo
   que le sirva con cada marca. Por eso es un combobox y no un select. */
const CONDICIONES_PAGO = [
  'Contado', 'Crédito 7 días', 'Crédito 15 días', 'Crédito 30 días',
  'Crédito 45 días', 'Crédito 60 días', 'Adelanto 50 % + saldo',
]

/* Subconjunto del CHECK de `piola_adjuntos.tipo_doc` que aplica a un cliente. */
const TIPOS_ADJUNTO_CLIENTE = [
  { value: 'contrato', title: 'Contrato' },
  { value: 'anexo', title: 'Anexo' },
  { value: 'dni', title: 'DNI' },
  { value: 'ficha_ruc', title: 'Ficha RUC' },
  { value: 'constancia', title: 'Constancia' },
  { value: 'otro', title: 'Otro' },
]
const etiquetaTipoDoc = (v: any) =>
  TIPOS_ADJUNTO_CLIENTE.find(t => t.value === v)?.title || v || 'Documento'

const OPCIONES_ESTADO = [
  { value: 'activos', title: 'Activos' },
  { value: 'inactivos', title: 'De baja' },
  { value: 'todos', title: 'Todos' },
]

/* ══════════ Carga ══════════ */
const cargando = ref(false)
const clientes = ref<any[]>([])
const contratos = ref<any[]>([])
const adjuntos = ref<any[]>([])

const fBuscar = ref('')
const fEstado = ref('activos')
const soloFacturables = ref(false)

async function cargar() {
  cargando.value = true
  // `traerTodo` + un .order() determinista: PostgREST corta en 1000 filas sin
  // avisar y ordenar solo por nombre no es un orden total (dos marcas pueden
  // llamarse igual), con lo que el paginado repetiría filas.
  const [c, ct, ad] = await Promise.all([
    traerTodo(() => client.from('piola_clientes').select('*').order('nombre').order('id')),
    traerTodo(() => client.from('piola_contratos').select('*')
      .order('fecha_inicio', { ascending: false }).order('id')),
    traerTodo(() => client.from('piola_adjuntos').select('*')
      .eq('entidad', 'cliente').order('created_at', { ascending: false }).order('id')),
  ])
  if (c.error) emit('notify', { text: `Error cargando clientes: ${c.error.message}`, color: 'error' })
  clientes.value = (c.data as any[]) || []
  contratos.value = (ct.data as any[]) || []
  // Si la migración del 31/08 todavía no se corrió, `piola_adjuntos` no existe:
  // la ficha sigue siendo usable sin la sección de adjuntos, así que el error
  // no se convierte en un aviso rojo cada vez que se abre el módulo.
  adjuntos.value = (ad.data as any[]) || []
  cargando.value = false
}

/* ══════════ Derivados ══════════ */
const soloDigitos = (v: any) => String(v ?? '').replace(/\D/g, '')
const esFacturable = (c: any) =>
  !!(c.razon_social || c.nombre) && /^\d{11}$/.test(soloDigitos(c.ruc))

const activos = computed(() => clientes.value.filter(c => c.activo !== false))
const inactivos = computed(() => clientes.value.filter(c => c.activo === false))
const listosParaFacturar = computed(() => activos.value.filter(esFacturable))
const sinDocumento = computed(() => activos.value.filter(c => !soloDigitos(c.ruc)))
const compromisoTotal = computed(() =>
  activos.value.reduce((s, c) => s + Number(c.compromiso_mensual || 0), 0))

/**
 * Contratos de un cliente.
 *
 * El match por `cliente_id` es el bueno, pero `piola_contratos` guarda además
 * `nombre_cliente`/`ruc` sueltos y hay contratos antiguos cargados sin enlazar.
 * Se rescatan por RUC cuando el contrato no tiene `cliente_id`; sin eso la
 * ficha diría "sin contratos" de una marca que sí lo tiene firmado.
 */
function contratosDe(c: any): any[] {
  if (!c?.id) return []
  const ruc = soloDigitos(c.ruc)
  return contratos.value.filter(ct =>
    ct.cliente_id === c.id || (!ct.cliente_id && ruc && soloDigitos(ct.ruc) === ruc))
}
const adjuntosDe = (clienteId: any) =>
  adjuntos.value.filter(a => String(a.entidad_id) === String(clienteId))

/**
 * Semáforo de renovación — los MISMOS 4 tramos que PiolaContratos.vue:
 * VIGENTE (+60 días) / PRÓXIMA RENOVACIÓN (31-60) / RENOVAR AHORA (0-30) /
 * VENCIDO, y los tramos intermedios solo aplican a una cuota recurrente.
 *
 * ⚠️ Está duplicado a propósito: PiolaContratos.vue no exporta la función y es
 * de otro módulo. Si allá cambian los tramos, hay que cambiarlos acá también.
 */
function estadoContrato(c: any): string {
  if (!c?.fecha_cierre) return 'sin_fecha'
  const cierre = String(c.fecha_cierre).slice(0, 10)
  const dias = Math.round(
    (Date.parse(`${cierre}T12:00:00`) - Date.parse(`${hoyISO()}T12:00:00`)) / 86400000)
  if (dias < 0) return 'vencido'
  if (!c.pago_mensual) return 'vigente'
  if (dias <= 30) return 'renovar_ahora'
  if (dias <= 60) return 'proxima_renovacion'
  return 'vigente'
}
const textoEstadoContrato = (e: string) => ({
  vigente: 'Vigente', proxima_renovacion: 'Próxima renovación', renovar_ahora: 'Renovar ahora',
  vencido: 'Vencido', sin_fecha: 'Sin fecha',
}[e] || e)
const colorEstadoContrato = (e: string) => ({
  vigente: 'success', proxima_renovacion: 'info', renovar_ahora: 'warning',
  vencido: 'error', sin_fecha: 'grey',
}[e] || 'grey')

/** Para el chip de la tabla: el estado más urgente de todos sus contratos. */
const ORDEN_URGENCIA = ['renovar_ahora', 'proxima_renovacion', 'vigente', 'sin_fecha', 'vencido']
function estadoMasUrgente(c: any): string {
  const estados = contratosDe(c).map(estadoContrato)
  for (const e of ORDEN_URGENCIA) if (estados.includes(e)) return e
  return 'sin_fecha'
}
const conContratoVigente = computed(() => activos.value.filter(c =>
  contratosDe(c).some(ct => !['vencido'].includes(estadoContrato(ct)))))

const etiquetaModalidad = (v: any) => MODALIDADES_PAGO.find(m => m.value === v)?.title || v || '—'

const clientesFiltrados = computed(() => {
  let lista = clientes.value
  if (fEstado.value === 'activos') lista = lista.filter(c => c.activo !== false)
  else if (fEstado.value === 'inactivos') lista = lista.filter(c => c.activo === false)
  if (soloFacturables.value) lista = lista.filter(esFacturable)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(c => [
      c.nombre, c.razon_social, c.ruc, c.dni, c.contacto, c.email, c.email_facturacion, c.telefono,
    ].some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

const headers = [
  { title: 'Cliente', key: 'nombre' },
  { title: 'Documento', key: 'documento', sortable: false },
  { title: 'Contacto', key: 'contacto' },
  { title: 'Correo de facturación', key: 'email_facturacion' },
  { title: 'Condición de pago', key: 'condicion_pago' },
  { title: 'Detracción', key: 'detraccion_pct' },
  { title: 'Contratos', key: 'contratos', sortable: false },
  { title: 'Docs', key: 'documentos', sortable: false },
  { title: 'Estado', key: 'activo' },
]

/* ══════════ Visor embebido ══════════ */
const visor = ref<{ abierto: boolean; src: string; titulo: string }>({
  abierto: false, src: '', titulo: '',
})
const urlDoc = (path: any) => urlDocumento(client, path)
function verDocumento(path: string, titulo: string) {
  visor.value = { abierto: true, src: urlDoc(path), titulo }
}

/* ══════════ Validación ══════════ */
const formRef = ref<any>(null)
const ruleRequerido = (v: any) => !!String(v ?? '').trim() || 'Obligatorio'
/** El RUC solo es obligatorio si la ficha dice que el documento ES un RUC. */
const ruleRucSegunTipo = (v: any) => {
  const val = String(v ?? '').trim()
  if (ficha.value?.tipo_documento === 'RUC') return ruleRuc(val)
  return !val || ruleRuc(val)
}
const ruleDniOpcional = (v: any) => {
  const val = String(v ?? '').trim()
  if (!val) return true
  if (ficha.value?.tipo_documento === 'DNI') return /^\d{8}$/.test(val) || 'El DNI debe tener 8 dígitos'
  return true
}

/* ══════════ Ficha (alta / edición) ══════════ */
const ficha = ref<any>(null)
const guardando = ref(false)
const eliminando = ref(false)
const nuevoAdjunto = ref<{ tipo_doc: string; path: string | null }>({ tipo_doc: 'contrato', path: null })
const subiendoAdjunto = ref(false)

const adjuntosFicha = computed(() => ficha.value?.id ? adjuntosDe(ficha.value.id) : [])
const contratosFicha = computed(() => ficha.value?.id ? contratosDe(ficha.value) : [])

function abrirNuevo() {
  ficha.value = {
    id: null, nombre: '', razon_social: '', tipo_documento: 'RUC', ruc: '', dni: '',
    contacto: '', contacto_cargo: '', telefono: '', email: '', email_facturacion: '',
    direccion: '', direccion_fiscal: '', condicion_pago: null, condiciones: '', notas: '',
    detraccion_pct: null, detraccion_codigo: '', compromiso_mensual: 0,
    ficha_ruc_pdf: null, activo: true,
  }
  nuevoAdjunto.value = { tipo_doc: 'contrato', path: null }
}

function abrirFicha(c: any) {
  ficha.value = { ...c }
  nuevoAdjunto.value = { tipo_doc: 'contrato', path: null }
}

function cerrarFicha() {
  ficha.value = null
  nuevoAdjunto.value = { tipo_doc: 'contrato', path: null }
}

async function guardar() {
  const f = ficha.value
  const validacion = await formRef.value?.validate()
  if (validacion && validacion.valid === false) {
    return emit('notify', { text: 'Revisa los campos marcados', color: 'error' })
  }

  guardando.value = true
  // Se manda la ficha COMPLETA: el endpoint solo escribe las claves que llegan,
  // así que omitir una la dejaría con el valor viejo aunque se haya borrado en
  // el formulario. `lead_id` y `activo` no viajan: el primero lo escribe el CRM
  // al convertir un lead (es la única trazabilidad de su origen) y el segundo se
  // cambia con las acciones de baja/reactivación.
  const { error } = await apiPiola('clientes', {
    accion: 'guardar',
    id: f.id || null,
    nombre: f.nombre,
    razon_social: f.razon_social,
    tipo_documento: f.tipo_documento || null,
    ruc: f.ruc,
    dni: f.dni,
    contacto: f.contacto,
    contacto_cargo: f.contacto_cargo,
    telefono: f.telefono,
    email: f.email,
    email_facturacion: f.email_facturacion,
    direccion: f.direccion,
    direccion_fiscal: f.direccion_fiscal,
    condiciones: f.condiciones,
    // El combobox devuelve el objeto de la lista si se elige con el mouse.
    condicion_pago: typeof f.condicion_pago === 'object'
      ? (f.condicion_pago?.title ?? null) : f.condicion_pago,
    ficha_ruc_pdf: f.ficha_ruc_pdf,
    detraccion_pct: f.detraccion_pct === '' ? null : f.detraccion_pct,
    detraccion_codigo: f.detraccion_codigo,
    compromiso_mensual: f.compromiso_mensual,
    notas: f.notas,
  })
  guardando.value = false

  if (error) return emit('notify', { text: `Error guardando: ${error.message}`, color: 'error' })
  emit('notify', f.id ? 'Ficha del cliente actualizada' : 'Cliente registrado')
  cerrarFicha()
  await cargar()
}

async function reactivar() {
  guardando.value = true
  const { error } = await apiPiola('clientes', {
    accion: 'guardar', id: ficha.value.id, activo: true,
  })
  guardando.value = false
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Cliente reactivado')
  cerrarFicha()
  await cargar()
}

/**
 * Baja LÓGICA. El servidor devuelve cuántas facturas y movimientos quedan
 * atados al cliente para poder explicar por qué sigue apareciendo en los
 * reportes históricos: no es un borrado.
 */
async function darDeBaja() {
  const f = ficha.value
  if (!confirm(
    `¿Dar de baja a "${f.nombre}"?\n\n`
    + 'Deja de aparecer en el desplegable de Facturación, pero sus facturas y '
    + 'movimientos históricos se conservan. Se puede reactivar después.'
  )) return

  eliminando.value = true
  const { data, error } = await apiPiola<any>('clientes', { accion: 'eliminar', id: f.id })
  eliminando.value = false
  if (error) return emit('notify', { text: `Error dando de baja: ${error.message}`, color: 'error' })

  const conserva = data?.conserva
  const detalle = conserva && (conserva.facturas || conserva.movimientos)
    ? ` Se conservan ${conserva.facturas} factura(s) y ${conserva.movimientos} movimiento(s).`
    : ''
  emit('notify', `Cliente dado de baja.${detalle}`)
  cerrarFicha()
  await cargar()
}

/* ══════════ Adjuntos del cliente ══════════ */

/** El endpoint de adjuntos es de otro módulo; si todavía no está desplegado se
 *  dice con todas las letras en vez de mostrar un 404 crudo. */
function avisarAdjuntos(mensaje: string) {
  const faltaEndpoint = /404|not found|no route|cannot find|page not found/i.test(mensaje)
  emit('notify', {
    text: faltaEndpoint
      ? 'Los adjuntos múltiples todavía no están habilitados en el servidor '
        + '(falta /api/piola/adjuntos). La ficha RUC sí se guarda con el cliente.'
      : `Error con el adjunto: ${mensaje}`,
    color: 'error',
  })
}

async function registrarAdjunto() {
  const a = nuevoAdjunto.value
  if (!a.path) return
  subiendoAdjunto.value = true
  // El PDF ya está en el bucket (lo subió PiolaSubirPdf); acá solo se registra
  // la fila, que va por endpoint porque `piola_adjuntos` no acepta escrituras
  // de `anon`.
  const { error } = await apiPiola('adjuntos', {
    accion: 'guardar',
    entidad: 'cliente',
    entidad_id: ficha.value.id,
    tipo_doc: a.tipo_doc,
    nombre: decodeURIComponent(String(a.path).split('/').pop() || 'documento.pdf'),
    path: a.path,
  })
  subiendoAdjunto.value = false
  if (error) return avisarAdjuntos(error.message)

  emit('notify', 'Documento adjuntado')
  nuevoAdjunto.value = { tipo_doc: 'contrato', path: null }
  await cargar()
}

async function eliminarAdjunto(a: any) {
  if (!confirm(`¿Quitar "${a.nombre}" de la ficha?`)) return
  const { error } = await apiPiola('adjuntos', { accion: 'eliminar', id: a.id })
  if (error) return avisarAdjuntos(error.message)
  emit('notify', 'Documento quitado')
  await cargar()
}

onMounted(cargar)
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 2px 16px 14px; }
.filtros-bar .filtro { flex: 1 1 160px; max-width: 240px; }
.filtros-bar .filtro-buscar { flex: 2 1 260px; max-width: 360px; }

.sub-celda { font-size: 11px; opacity: .55; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}

.adjuntos-bloque {
  margin-top: 16px; border: 1px dashed rgba(128, 128, 128, .35);
  border-radius: 10px; padding: 12px 14px;
}
.adjuntos-titulo {
  display: flex; align-items: center; gap: 7px; font-size: 12.5px;
  font-weight: 600; opacity: .8; margin-bottom: 10px;
}
.adjuntos-vacio { font-size: 12.5px; opacity: .5; padding: 4px 0; }

.doc-fila {
  /* surface/on-surface del tema Vuetify: sigue al modo claro/oscuro.
     var(--bg, #fff) NO existe en el proyecto y deja un recuadro blanco
     ilegible en oscuro. */
  display: flex; align-items: center; gap: 9px; margin-bottom: 8px;
  background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(128, 128, 128, .25); border-radius: 9px; padding: 7px 8px 7px 12px;
}
.doc-datos { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.doc-nombre {
  font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;
}
.doc-tipo { font-size: 10.5px; opacity: .55; }

.adjunto-nuevo {
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px;
  margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(128, 128, 128, .25);
}

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
  .doc-nombre { max-width: 160px; }
}
</style>
