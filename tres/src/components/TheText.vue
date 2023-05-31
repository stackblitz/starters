<script setup lang="ts">
import { useTexture, extend } from '@tresjs/core'
import { TextGeometry } from 'three/addons/geometries/TextGeometry'
import { FontLoader } from 'three/addons/loaders/FontLoader'

extend({ TextGeometry: TextGeometry })

const fontPath = 'https://raw.githubusercontent.com/Tresjs/assets/main/fonts/FiraCodeRegular.json'

const loader = new FontLoader()

const font = await new Promise((resolve, reject) => {
  try {
    loader.load(fontPath, font => {
      resolve(font)
    })
  } catch (error) {
    reject(console.error('cientos', error))
  }
})

const fontOptions = {
  size: 0.5,
  height: 0.2,
  curveSegments: 5,
  bevelEnabled: true,
  bevelThickness: 0.05,
  bevelSize: 0.02,
  bevelOffset: 0,
  bevelSegments: 4,
}

const matcapTexture = await useTexture(['https://raw.githubusercontent.com/Tresjs/assets/main/textures/matcaps/7.png'])
</script>

<template>
  <TresMesh>
    <TresTextGeometry :args="['TresJS', { font, ...fontOptions }]" center />
    <TresMeshNormalMaterial :matcap="matcapTexture" />
  </TresMesh>
</template>
