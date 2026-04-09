import json

file_path = "pages/pruebas/SKIP.vue"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# Make basic variable substitutions related to the stock system (outside of the CRUD block)
text = text.replace("stockItems", "serviciosItems")
text = text.replace("stockSearch", "serviciosSearch")
text = text.replace("loadingStock", "loadingServicios")
text = text.replace("fetchStock", "fetchServicios")

# Update left nav if anything was labeled 'Stock'
text = text.replace("StockMenuOpen", "serviciosMenuOpen")
text = text.replace("stockMenuOpen", "serviciosMenuOpen")

# Replace the giant Stock CRUD section
start_marker = "/* ---------------- Stock CRUD Logic Corregido ---------------- */"
end_marker = "/* ---------------- NOTIFICATIONS LOGIC ---------------- */"

if start_marker in text and end_marker in text:
    start_idx = text.find(start_marker)
    end_idx = text.find(end_marker)
    
    new_crud_logic = """/* ---------------- Servicios CRUD Logic ---------------- */
const serviciosItems = ref<any[]>([])
const loadingServicios = ref(false)
const serviciosSearch = ref('')
const showServicioDialog = ref(false)
const editingServicioId = ref<string | null>(null)
const servicioFormData = ref<any>({})

const filteredServicios = computed(() => {
  if (!serviciosSearch.value) return serviciosItems.value
  const query = serviciosSearch.value.toLowerCase()
  return serviciosItems.value.filter(s => 
    s.servicio?.toLowerCase().includes(query) || 
    s.descripcion?.toLowerCase().includes(query)
  )
})

async function fetchServicios() {
  loadingServicios.value = true
  try {
    const { data, error } = await client
      .from('skip_servicios')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    serviciosItems.value = data || []
  } catch (error) {
    console.error('Error fetching servicios:', error)
  } finally {
    loadingServicios.value = false
  }
}

function openServicioDialog(item?: any) {
  editingServicioId.value = item ? item.id : null
  if (item) {
    servicioFormData.value = JSON.parse(JSON.stringify(item))
  } else {
    servicioFormData.value = {
      servicio: '',
      descripcion: '',
      precio: 0,
      color: '#3b82f6',
      icono: 'mdi-parachute'
    }
  }
  showServicioDialog.value = true
}

async function saveServicio() {
  loadingServicios.value = true
  try {
    const payload = {
      servicio: servicioFormData.value.servicio,
      descripcion: servicioFormData.value.descripcion,
      precio: Number(servicioFormData.value.precio),
      color: servicioFormData.value.color,
      icono: servicioFormData.value.icono
    }
    
    if (editingServicioId.value) {
      const { error } = await client
        .from('skip_servicios')
        .update(payload)
        .eq('id', editingServicioId.value)
      if (error) throw error
    } else {
      const { error } = await client
        .from('skip_servicios')
        .insert(payload)
      if (error) throw error
    }
    
    showServicioDialog.value = false
    await fetchServicios()
  } catch (error: any) {
    console.error('Error saving servicio:', error)
    alert('Error al guardar: ' + error.message)
  } finally {
    loadingServicios.value = false
  }
}

async function deleteServicio(id: string) {
  if (!confirm('¿Seguro de eliminar este servicio?')) return
  try {
    const { error } = await client.from('skip_servicios').delete().eq('id', id)
    if (error) throw error
    await fetchServicios()
  } catch (error: any) {
    console.error('Error deleting servicio:', error)
    alert('Error al eliminar: ' + error.message)
  }
}

watch(activeView, (newVal) => {
  if (newVal === 'stock' && serviciosItems.value.length === 0) fetchServicios()
  else if (newVal === 'leads' && leads.value.length === 0) fetchLeads()
})

"""
    text = text[:start_idx] + new_crud_logic + text[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Servicios CRUD logic fully updated.")
