# Gatwick · MVP Sistema de Inventario

Documentación del MVP de inventario implementado en `pages/pruebas/Gatwick.vue`.
Estado: **UI + SQL implementados**. Automatizaciones n8n: **documentadas (pendientes de armar en n8n)**.

---

## 1. Base de datos

Migración única: `sql/gatwick_inventario.sql` (correr una vez en Supabase → SQL Editor).

Tablas: `componentes`, `recetas`, `recetas_detalle`, `movimientos_inventario`,
`materias_primas`, `informe_materiales`.
Vistas: `recetas_valorizadas`, `componentes_en_alerta`, `movimientos_recientes_30_dias`.

> `informe_materiales.numero_informe` referencia el `id` de la tabla existente
> `gatwick_intervenciones` (que cumple el rol de "informe técnico").

---

## 2. Módulos UI (dashboard Gatwick → sección INVENTARIO)

| `activeView` | Pantalla | Qué hace |
|---|---|---|
| `inventario` | Resumen ejecutivo | KPIs, top-5 alertas, donut valor/categoría, barras movimientos 7 días, accesos rápidos |
| `componentes` | Gestión de componentes | CRUD + filtros + paginación 20 + import CSV + soft delete |
| `recetas` | Recetas valorizadas | CRUD + detalle con componentes + cálculo costo/margen/precio venta + duplicar + recetario CSV |
| `movimientos` | Movimientos de inventario | Registro (entrada/salida/ajuste/devolución) con recálculo de stock + deshacer + export |
| `costos-intervenciones` | Costo por intervención | Cruza `gatwick_intervenciones` × `informe_materiales` → materiales + mano obra + margen |
| `reportes` | Reportes y analytics | Consumo por componente/categoría, rotación, proyección de compras, costo prom. por intervención |

**Lógica de stock (cliente):**
- entrada / devolución → `stock_nuevo = stock_actual + cantidad`
- salida → `stock_nuevo = stock_actual − cantidad` (valida ≥ 0; captura precio del momento)
- ajuste → `stock_nuevo = cantidad` (stock absoluto corregido)
- Cada movimiento guarda `stock_anterior`/`stock_nuevo` y actualiza `componentes.stock_actual`.
- Precios históricos: `recetas_detalle.precio_unitario_en_receta` e `informe_materiales.precio_unitario`
  se capturan al momento (snapshot), no cambian si luego se edita el precio del componente.

---

## 3. Automatizaciones n8n (pendientes — armar en n8n)

Las alertas en este MVP **se VEN en rojo** en el dashboard (badge en el menú + nivel CRÍTICO/BAJO).
Los workflows siguientes son la fase posterior. Todos consultan Supabase con la `service_role` key.

### WORKFLOW 1 · Alerta de stock bajo (Cron diario 08:00)
1. `GET` Supabase `componentes_en_alerta`.
2. Si hay filas → WhatsApp a Ángel (Twilio/Chatwoot) + email a Ana María (tabla HTML).
3. Si no hay → nada.

### WORKFLOW 2 · Descuento de stock al cerrar informe (Webhook)
Disparado cuando una intervención se marca completada. Recomendado exponerlo como endpoint
Nuxt `POST /api/gatwick/informe-materiales` (api_key) para centralizar la lógica:

```jsonc
// body
{
  "numero_informe": "<id de gatwick_intervenciones>",
  "materiales": [ { "componente_id": "<uuid>", "cantidad": 25 } ],
  "usuario": "tecnico@gatwick.pe"
}
```
Lógica por material:
1. Validar componente y stock suficiente.
2. Insert en `informe_materiales` (con `precio_unitario` = precio actual del componente).
3. Insert en `movimientos_inventario` (`tipo='salida'`, `numero_informe` set).
4. `UPDATE componentes SET stock_actual = stock_actual − cantidad`.
5. Respuesta: `{ success, costo_total, alertas_stock[] }`.

> Hoy esto se hace manualmente desde el módulo **Movimientos** (poniendo el N° de informe)
> y se refleja automáticamente en **Costos por intervención**.

### WORKFLOW 3 · Proyección de compras (Cron viernes 17:00)
Calcula consumo promedio 30 días → proyecta quiebre de stock → PDF a Ángel.
El módulo **Reportes → Proyección de compras** ya entrega exactamente estos datos (exportable a CSV).

### WORKFLOW 4 · Reporte mensual de costos (Cron día 1, 09:00)
Suma `costo_total` por intervención del mes anterior + margen promedio → PDF a gerencia.
El módulo **Reportes → Costo promedio por intervención** ya calcula la base.

---

## 4. Notas

- El frontend usa la `SUPABASE_KEY` service_role → no requiere políticas RLS.
- Import CSV de componentes espera cabecera:
  `codigo,nombre,categoria,unidad,precio_unitario,stock_actual,stock_minimo,stock_maximo`
  (upsert por `codigo`).
- "Descargar histórico (Excel)" y "Exportar reporte" generan CSV (abren en Excel).
  El "recetario PDF" del spec se entrega como CSV estructurado por receta.
