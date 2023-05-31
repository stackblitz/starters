<script setup lang="ts">
import { TresCanvas, useRenderLoop } from '@tresjs/core'
import { reactive, shallowRef } from 'vue'
import { BasicShadowMap, SRGBColorSpace, NoToneMapping } from 'three'
import { OrbitControls } from '@tresjs/cientos'

const gl = reactive({
  clearColor: '#82DBC5',
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
})

const { onLoop } = useRenderLoop()

const boxRef = shallowRef(null)

onLoop(({ elapsed}) => {
  if(boxRef) {
    boxRef.value.rotation.y = elapsed
    boxRef.value.rotation.z = elapsed
  }
})
</script>

<template>
  <TresCanvas v-bind="gl">
    <TresPerspectiveCamera :position="[5,5,5]" />
    <OrbitControls />
    <TresAmbientLight :intensity="0.5" :color="'red'" />
    <TresMesh ref="boxRef" :position="[0,2,0]">
      <TresBoxGeometry :args="[1,1,1]" />
      <TresMeshNormalMaterial />
    </TresMesh>
    <TresDirectionalLight :position="[0, 2, 4]" :intensity="1" cast-shadow />
    <TresAxesHelper />
    <TresGridHelper :args="[10, 10, 0x444444, 'teal']" />
  </TresCanvas>
</template>
