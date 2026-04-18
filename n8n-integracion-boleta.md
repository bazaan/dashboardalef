# Integrar Boleta Automática en n8n — Healup

## Resumen

Cuando el agente de WhatsApp confirma una cita y el paciente paga, n8n llama al endpoint del dashboard para:
1. Generar boleta B001 de consulta S/50 en PSE.PE/SUNAT
2. Enviar la boleta al paciente por WhatsApp

## Workflows a modificar

Hay **3 workflows de agendamiento** donde agregar el nodo:

| Workflow | ID | Canal |
|---|---|---|
| ACTIVO agendar heal up whatsapp | `HCE58VpPkAIKk6FE` | WhatsApp |
| ACTIVO agendar heal up fb ig | `JSSrNxJJvC80AMKU` | Facebook/Instagram |
| HEALUP \| WHATSAPP \| tool cita multiple | `R26taWI8hhnr4dqJ` | WhatsApp (múltiples citas) |

## Nodo 1: "Generar Boleta Consulta" (HTTP Request)

Agregar este nodo **en paralelo con "mensaje a DOCTORA"**, es decir, conectado al mismo output que indica que la cita se agendó exitosamente.

### Configuración del nodo

- **Tipo:** HTTP Request
- **Método:** POST
- **URL:** `https://dashboard.alef.company/api/healup/boleta-auto`
- **Headers:**
  - `Content-Type: application/json`
- **Body (JSON):**

```json
{
  "api_key": "healup-auto-2026",
  "client_name": "{{ $('When Executed by Another Workflow').item.json['nombre_completo'].split(' ')[0] }}",
  "client_surname": "{{ $('When Executed by Another Workflow').item.json['nombre_completo'].split(' ').slice(1).join(' ') }}",
  "client_dni": "{{ $('When Executed by Another Workflow').item.json.DNI }}",
  "client_phone": "{{ $('When Executed by Another Workflow').item.json.numerotelefono }}"
}
```

### Para el workflow de cita múltiple (R26taWI8hhnr4dqJ)

Usar las variables del paciente 1:

```json
{
  "api_key": "healup-auto-2026",
  "client_name": "{{ $('When Executed by Another Workflow').item.json.paciente_uno_nombre_completo.split(' ')[0] }}",
  "client_surname": "{{ $('When Executed by Another Workflow').item.json.paciente_uno_nombre_completo.split(' ').slice(1).join(' ') }}",
  "client_dni": "{{ $('When Executed by Another Workflow').item.json.paciente_uno_DNI }}",
  "client_phone": "{{ $('When Executed by Another Workflow').item.json.numerotelefono }}"
}
```

### Respuesta del endpoint

```json
{
  "success": true,
  "serie": "B001",
  "numero": 123,
  "numero_formateado": "B001-00000123",
  "total": 50.00,
  "enlace_pdf": "https://api.pse.pe/...",
  "enlace": "https://...",
  "aceptada_por_sunat": true,
  "mensaje_wpp": "*Boleta de Consulta — Heal Up Lab*\n📄 B001-00000123\n👤 Paola Arias\n💰 Total: S/ 50.00\n\n📎 *Ver PDF:* https://...\n🔍 *Consulta SUNAT:* https://...\n\n_Emitido electrónicamente. Este comprobante es válido ante SUNAT._"
}
```

## Nodo 2: "Enviar Boleta WhatsApp" (HTTP Request)

Conectar **después** de "Generar Boleta Consulta".

- **Método:** POST
- **URL:** `https://web.wazend.net/api/v1/accounts/53/conversations/{{ conversation_id }}/messages`
- **Headers:**
  - `api_access_token: {{ token de chatwoot }}`
  - `Content-Type: application/json`
- **Body:**

```json
{
  "content": "{{ $('Generar Boleta Consulta').item.json.mensaje_wpp }}",
  "message_type": "outgoing",
  "content_type": "text"
}
```

> **Nota:** Si no tenés el `conversation_id` disponible en el sub-workflow, podés enviar la boleta usando el endpoint del dashboard `POST /api/healup/enviar-whatsapp` en lugar de llamar a Wazend directo. Para eso necesitás configurar `N8N_WEBHOOK_HEALUP_BOLETA` en el .env de producción.

## Diagrama del flujo

```
AI Agent ejecuta tool "agendar"
    ↓
Google Calendar crea evento
    ↓
Extraer1 (lee el evento creado)
    ↓
If (¿se creó exitosamente?)
    ├── SÍ ──┬── mensaje a DOCTORA (ya existe)
    │        ├── pacienteswpp (ya existe)
    │        ├── Append row in sheet (ya existe)
    │        └── 🆕 Generar Boleta Consulta → Enviar Boleta WhatsApp
    │
    └── NO ── Edit Fields (horario ocupado)
```

## Pre-requisitos

1. **Deploy del dashboard a producción** con las env vars:
   - `HEALUP_BOLETA_AUTO_KEY=healup-auto-2026`
   - `SUPABASE_URL` y `SUPABASE_KEY` (ya deberían estar)

2. **Verificar la URL de producción:**
   - `https://dashboard.alef.company/api/healup/boleta-auto` debe estar accesible

## Archivo JSON importable

El archivo `n8n-nodo-boleta-auto.json` contiene los 2 nodos listos para copiar/pegar en n8n. Importarlo y conectar "Generar Boleta Consulta" al output exitoso del If.
