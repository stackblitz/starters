<script setup lang="ts">
import { useTweakPane, useGLTF } from '@tresjs/cientos'
import { ref, watch } from 'vue'

useTweakPane()

const { scene: model } = await useGLTF(
  'https://raw.githubusercontent.com/Tresjs/assets/main/models/gltf/aku-aku/AkuAku.gltf',
  {
    draco: true,
  },
)

const akuAkuRef = ref(null)

watch(akuAkuRef, model => {
  console.log('akuAkuRef', model)
  model.position.set(0, 8, 0)
})
</script>

<template>
  <TresGroup :position="[0, 2, 0]">
    <primitive ref="akuAkuRef" :object="model"> </primitive>
  </TresGroup>
</template>
