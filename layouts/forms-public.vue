<template>
  <div class="forms-public-shell">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Layout limpio para la página pública /forms/[slug].
// NO incluye sidebar, NO requiere login, NO muestra nada del dashboard.
// La persona que entra solo ve el formulario.
</script>

<style>
/* Reseteo / variables locales para que el layout sea independiente del tema del dashboard */
.forms-public-shell {
  --fp-bg:          #0f1117;
  --fp-card:        #181a23;
  --fp-card-soft:   #1f2230;
  --fp-text:        #e8eaed;
  --fp-text-muted:  #9aa0ac;
  --fp-primary:     #daa520;
  --fp-primary-hover:#e6b425;
  --fp-border:      #2a2d3a;
  --fp-error:       #ef4444;
  --fp-success:     #22c55e;
  --fp-radius:      14px;

  min-height: 100vh;
  width: 100%;
  background: linear-gradient(180deg, #0a0b10 0%, #14161e 100%);
  color: var(--fp-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 32px 16px;
  box-sizing: border-box;
}

.forms-public-shell * {
  box-sizing: border-box;
}
</style>
