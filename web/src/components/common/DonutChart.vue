<script setup lang="ts">
import { computed } from "vue";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const props = defineProps<{ slices: DonutSlice[]; totalLabel?: string }>();

const SIZE = 180;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const total = computed(() =>
  props.slices.reduce((sum, slice) => sum + slice.value, 0),
);

/**
 * Satu <circle> per potongan, ditumpuk, dengan stroke-dasharray/dashoffset.
 * Tanpa library chart: hanya aritmetika lingkaran dan atribut SVG.
 * `gap` kecil mencegah dua potongan bersebelahan terbaca menyatu.
 */
const segments = computed(() => {
  const sum = total.value;
  let consumed = 0;

  return props.slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const fraction = sum > 0 ? slice.value / sum : 0;
      const visible = fraction * CIRCUMFERENCE;
      const offset = -consumed;
      consumed += visible;

      return {
        ...slice,
        percent: sum > 0 ? Math.round(fraction * 100) : 0,
        dasharray: `${Math.max(visible - 2, 0)} ${CIRCUMFERENCE - Math.max(visible - 2, 0)}`,
        dashoffset: offset,
      };
    });
});
</script>

<template>
  <div class="donut">
    <div class="donut__figure">
      <svg
        :width="SIZE"
        :height="SIZE"
        :viewBox="`0 0 ${SIZE} ${SIZE}`"
        role="img"
        :aria-label="`Status request: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}`"
      >
        <g :transform="`rotate(-90 ${SIZE / 2} ${SIZE / 2})`">
          <!--
            Cincin latar: tampil saat total 0, sehingga donut kosong tetap
            terbaca sebagai "tidak ada data" alih-alih ruang hampa.
          -->
          <circle
            :cx="SIZE / 2"
            :cy="SIZE / 2"
            :r="RADIUS"
            fill="transparent"
            stroke="var(--color-border)"
            :stroke-width="STROKE"
          />
          <circle
            v-for="segment in segments"
            :key="segment.label"
            :cx="SIZE / 2"
            :cy="SIZE / 2"
            :r="RADIUS"
            fill="transparent"
            :stroke="segment.color"
            :stroke-width="STROKE"
            :stroke-dasharray="segment.dasharray"
            :stroke-dashoffset="segment.dashoffset"
          />
        </g>
      </svg>

      <div class="donut__center" aria-hidden="true">
        <span class="donut__total">{{ total }}</span>
        <span class="donut__total-label">{{ totalLabel ?? "Total" }}</span>
      </div>
    </div>

    <!--
      Legenda memuat angka dan persentase sebagai teks. Informasi tidak
      bergantung pada warna, sehingga tetap terbaca tanpa penglihatan warna.
    -->
    <ul class="donut__legend">
      <li v-for="slice in slices" :key="slice.label" class="donut__legend-item">
        <span
          class="donut__swatch"
          :style="{ background: slice.color }"
          aria-hidden="true"
        />
        <span class="donut__legend-label">{{ slice.label }}</span>
        <span class="donut__legend-value">
          {{ slice.value }}
          <span class="donut__legend-percent">
            ({{ total > 0 ? Math.round((slice.value / total) * 100) : 0 }}%)
          </span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
}

.donut__figure {
  position: relative;
  flex: none;
  width: 180px;
  height: 180px;
}

.donut__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.donut__total {
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
}

.donut__total-label {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.donut__legend {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 200px;
  list-style: none;
}

.donut__legend-item {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-body);
}

.donut__swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.donut__legend-label {
  color: var(--color-text);
}

.donut__legend-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.donut__legend-percent {
  font-weight: 400;
  color: var(--color-text-muted);
}
</style>
