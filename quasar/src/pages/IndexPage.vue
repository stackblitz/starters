<template>
  <q-page class="column flex-center">
    <q-knob
      v-model="count"
      :min="min"
      :max="max"
      size="80px"
      show-value
      :thickness="0.13"
      color="primary"
      track-color="dark"
    >
      <q-avatar size="75px">
        <img alt="Quasar logo" src="~assets/quasar-logo-inner.svg" />
      </q-avatar>
    </q-knob>

    <img
      alt="Quasar logo"
      src="~assets/quasar-logo-vertical.svg"
      style="width: 200px; height: 140px"
    />

    <div class="q-mt-xl">
      <q-btn
        color="primary"
        dense
        round
        label="-"
        :disable="count === min"
        @click="count--"
      />

      <span class="q-mx-md text-bold">{{ count }}</span>

      <q-btn
        color="primary"
        dense
        round
        label="+"
        :disable="count === max"
        @click="count++"
      />
    </div>

    <div class="q-mt-md" style="width: 200px">
      <q-slider v-model="count" :min="min" :max="max" />
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue';

const count = ref(0);

const min = -5;
const max = 5;
</script>
