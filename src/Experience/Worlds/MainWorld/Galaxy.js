import * as THREE from 'three/webgpu'
import Model from '@experience/Worlds/Abstracts/Model.js'
import Experience from '@experience/Experience.js'

import {
    float, vec3, vec4, color, attribute, instanceIndex, shapeCircle,
    instancedBufferAttribute, Fn
} from 'three/tsl'

export default class Galaxy extends Model {
    experience = Experience.getInstance()
    time = this.experience.time
    renderer = this.experience.renderer.instance

    container = new THREE.Group()

    // 텍스처 캐시
    textureCache = {}

    // 은하 설정
    config = {
        galaxyRadius: 500,
        galaxyArms: 5,
        galaxySpin: 25.0, // 강하게 감긴 나선팔
        galaxyRandomness: 0.3, // 랜덤성 약간 줄임 (구조 유지 위함)
        galaxyRandomnessPower: 3,
        // 별은 소수만 — 배경
        particleCount: 8000,
        colorInside: 0xffaa33,
        colorOutside: 0x1b3984,
    }

    constructor( parameters = {} ) {
        super()
        this.world = parameters.world
        this.scene = this.world.scene

        this.init()
    }

    init() {
        this.createCentralBulge()
        this.createGalaxyParticles()
        this.createNebulaClouds() // 대규모 성운 추가
        this.createDustLanes()    // 대규모 먼지 추가
        this.scene.add( this.container )
    }

    // ─────────────────────────────────────────
    // 텍스처 생성 유틸 (캐싱 적용)
    // ─────────────────────────────────────────

    createNebulaTexture(hexColor, softness = 1.0, isDark = false) {
        // Softness 양자화 (캐시 적중률 향상) - 0.1 단위
        const qSoftness = Math.round(softness * 10) / 10
        const key = `${hexColor}-${qSoftness}-${isDark}`
        
        if (this.textureCache[key]) return this.textureCache[key]

        const canvas = document.createElement('canvas')
        canvas.width = 128
        canvas.height = 128
        const ctx = canvas.getContext('2d')

        const r = (hexColor >> 16) & 255
        const g = (hexColor >> 8) & 255
        const b = hexColor & 255

        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)

        if (isDark) {
            // 먼지용 진한 그라디언트
            gradient.addColorStop(0, `rgba(${r},${g},${b},0.6)`)
            gradient.addColorStop(0.3, `rgba(${r},${g},${b},0.35)`)
            gradient.addColorStop(0.6, `rgba(${r},${g},${b},0.1)`)
            gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
        } else {
            // 성운용 부드러운 그라디언트
            const s = qSoftness
            gradient.addColorStop(0, `rgba(${r},${g},${b},${0.4 * s})`)
            gradient.addColorStop(0.2, `rgba(${r},${g},${b},${0.25 * s})`)
            gradient.addColorStop(0.5, `rgba(${r},${g},${b},${0.1 * s})`)
            gradient.addColorStop(0.8, `rgba(${r},${g},${b},${0.03 * s})`)
            gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
        }
        
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 128, 128)
        
        const texture = new THREE.CanvasTexture(canvas)
        this.textureCache[key] = texture
        return texture
    }

    // ─────────────────────────────────────────
    // 1. 중심부 벌지 (따뜻한 금빛 광원)
    // ─────────────────────────────────────────

    createCentralBulge() {
        this.bulgeGroup = new THREE.Group()

        // 중심 밝은 코어 (개수 약간 증가)
        const coreColors = [0xfff4d6, 0xffe8b0, 0xffd080, 0xffcc66, 0xeebb55]

        for (let i = 0; i < 40; i++) {
            const hexColor = coreColors[Math.floor(Math.random() * coreColors.length)]
            const texture = this.createNebulaTexture(hexColor, 1.2)

            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                opacity: 0.3 + Math.random() * 0.3,
                color: hexColor,
            })

            const sprite = new THREE.Sprite(spriteMat)

            const angle = Math.random() * Math.PI * 2
            const radius = Math.random() * 50 // 약간 더 퍼지게
            sprite.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 12,
                Math.sin(angle) * radius
            )

            const size = 50 + Math.random() * 100
            sprite.scale.set(size, size * 0.6, 1)

            this.bulgeGroup.add(sprite)
        }

        // 바깥쪽 확산 벌지
        for (let i = 0; i < 30; i++) {
            const hexColor = 0xeedd99
            const texture = this.createNebulaTexture(hexColor, 0.6)

            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                opacity: 0.1 + Math.random() * 0.15,
                color: hexColor,
            })

            const sprite = new THREE.Sprite(spriteMat)

            const angle = Math.random() * Math.PI * 2
            const radius = 30 + Math.random() * 80
            sprite.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 8,
                Math.sin(angle) * radius
            )

            const size = 100 + Math.random() * 150
            sprite.scale.set(size, size * 0.5, 1)

            this.bulgeGroup.add(sprite)
        }

        this.container.add(this.bulgeGroup)
    }

    // ─────────────────────────────────────────
    // 2. 별 파티클 (배경)
    // ─────────────────────────────────────────

    createGalaxyParticles() {
        const { particleCount, galaxyRadius, galaxyArms, galaxySpin,
                galaxyRandomness, galaxyRandomnessPower, colorInside, colorOutside } = this.config

        const positions = new Float32Array(particleCount * 3)
        const colors = new Float32Array(particleCount * 3)

        const colIn = new THREE.Color(colorInside)
        const colOut = new THREE.Color(colorOutside)

        for (let i = 0; i < particleCount; i++) {
            const radius = Math.random() * galaxyRadius + 20
            const spinAngle = radius * galaxySpin * 0.0005
            const branchAngle = ((i % galaxyArms) / galaxyArms) * Math.PI * 2

            const randomX = Math.pow(Math.random(), galaxyRandomnessPower) * (Math.random() < 0.5 ? 1 : -1) * galaxyRandomness * radius
            const randomY = Math.pow(Math.random(), galaxyRandomnessPower) * (Math.random() < 0.5 ? 1 : -1) * galaxyRandomness * 30
            const randomZ = Math.pow(Math.random(), galaxyRandomnessPower) * (Math.random() < 0.5 ? 1 : -1) * galaxyRandomness * radius

            positions[i * 3]     = Math.cos(spinAngle + branchAngle) * radius + randomX
            positions[i * 3 + 1] = randomY
            positions[i * 3 + 2] = Math.sin(spinAngle + branchAngle) * radius + randomZ

            const mixedColor = colIn.clone()
            mixedColor.lerp(colOut, radius / galaxyRadius)
            colors[i * 3]     = mixedColor.r
            colors[i * 3 + 1] = mixedColor.g
            colors[i * 3 + 2] = mixedColor.b
        }

        const posAttr = new THREE.InstancedBufferAttribute(positions, 3)
        const colAttr = new THREE.InstancedBufferAttribute(colors, 3)

        const posNode = instancedBufferAttribute(posAttr)
        const colNode = instancedBufferAttribute(colAttr)

        const material = new THREE.PointsNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            positionNode: posNode,
            colorNode: colNode,
            sizeNode: float(1.5),
            opacityNode: shapeCircle(),
        })

        const points = new THREE.Sprite(material)
        points.count = particleCount
        points.frustumCulled = false

        this.galaxyPoints = points
        this.container.add(this.galaxyPoints)
    }

    // ─────────────────────────────────────────
    // 3. 성운 구름 (나선팔 - 대규모 밀집)
    // ─────────────────────────────────────────

    createNebulaClouds() {
        this.nebulaGroup = new THREE.Group()
        const { galaxyRadius, galaxySpin, galaxyArms, galaxyRandomness } = this.config

        const innerColors = [0xffeedd, 0xffddbb, 0xeedd99, 0xddccaa]
        const midColors   = [0xddeeff, 0xccddff, 0xbbccee, 0xaabbdd, 0xffffff]
        const outerColors = [0x99bbdd, 0x7799cc, 0x6688bb, 0x5577aa]

        // 350 -> 2500 대폭 증가
        const nebulaCount = 2500

        for (let i = 0; i < nebulaCount; i++) {
            // 거리에 따른 분포: 중심에 더 많이, 외곽으로 갈수록 적게 (하지만 전체적으로 고르게)
            // 랜덤 분포 함수를 사용하여 자연스러운 감쇠 효과
            const rBase = Math.random() 
            const rPow = Math.pow(rBase, 0.8) // 분포 조절
            const radius = 30 + rPow * (galaxyRadius - 30)

            const spinAngle = radius * galaxySpin * 0.0005
            const branchAngle = (Math.floor(Math.random() * galaxyArms) / galaxyArms) * Math.PI * 2

            // spread를 radius에 비례하게 하되, 안쪽도 너무 좁지 않게
            const spread = radius * 0.15 + 10 
            
            // Sphere 랜덤 분포 (구형 클러스터 느낌)
            const randomAngle = Math.random() * Math.PI * 2
            const randomDist = Math.pow(Math.random(), 2) * spread // 중심에 더 모이게
            
            const offsetX = Math.cos(randomAngle) * randomDist
            const offsetZ = Math.sin(randomAngle) * randomDist
            const offsetY = (Math.random() - 0.5) * (spread * 0.5 + 10)

            const x = Math.cos(spinAngle + branchAngle) * radius + offsetX
            const y = offsetY
            const z = Math.sin(spinAngle + branchAngle) * radius + offsetZ

            const t = radius / galaxyRadius

            // 거리에 따른 색상 선택
            let colorPool
            if (t < 0.25) colorPool = innerColors
            else if (t < 0.6) colorPool = midColors
            else colorPool = outerColors

            const hexColor = colorPool[Math.floor(Math.random() * colorPool.length)]
            // 안쪽은 더 부드럽게(1.0), 바깥쪽은 약간 거칠게
            const softness = t < 0.3 ? 1.0 : 0.6 + Math.random() * 0.4
            
            const texture = this.createNebulaTexture(hexColor, softness)

            // 투명도 조절: 개수가 많으므로 투명도를 낮춰서 누적되게 함
            const baseOpacity = t < 0.3
                ? 0.08 + Math.random() * 0.08 
                : 0.04 + Math.random() * 0.06

            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                opacity: baseOpacity,
                color: hexColor,
            })

            const sprite = new THREE.Sprite(spriteMat)
            sprite.position.set(x, y, z)

            // 크기 대폭 확대: 60~150 단위 (겹침 효과 극대화)
            const cloudSize = 60 + Math.random() * 80 + t * 50
            sprite.scale.set(cloudSize, cloudSize * 0.4, 1) // 납작한 타원형

            // 회전: Sprite는 항상 카메라를 보지만, 2D 회전은 가능 (material.rotation)
            // 텍스처가 원형이라 회전 의미 없지만, 텍스처에 노이즈 있으면 의미 있음. 
            // 현재는 원형 Gradient라 회전 불필요.

            this.nebulaGroup.add(sprite)
        }

        // 전체적인 Haze (나선팔 사이 채움) - 개수 증가
        for (let i = 0; i < 300; i++) {
            const angle = Math.random() * Math.PI * 2
            const radius = 60 + Math.random() * (galaxyRadius * 0.8)

            const x = Math.cos(angle) * radius
            const y = (Math.random() - 0.5) * 15
            const z = Math.sin(angle) * radius

            const hexColor = 0x99aacc
            const texture = this.createNebulaTexture(hexColor, 0.4) // 아주 부드러운

            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                opacity: 0.02 + Math.random() * 0.03, // 매우 희미하게
                color: hexColor,
            })

            const sprite = new THREE.Sprite(spriteMat)
            sprite.position.set(x, y, z)

            const size = 100 + Math.random() * 150
            sprite.scale.set(size, size * 0.3, 1)

            this.nebulaGroup.add(sprite)
        }

        this.container.add(this.nebulaGroup)
    }

    // ─────────────────────────────────────────
    // 4. 먼지 레인 (어두운 갈색 줄무늬 - 대규모)
    // ─────────────────────────────────────────

    createDustLanes() {
        this.dustGroup = new THREE.Group()
        const { galaxyRadius, galaxySpin, galaxyArms } = this.config

        const dustColors = [0x332211, 0x442211, 0x2a1508, 0x1a0d05]
        
        // 먼지 개수 300개로 증가
        const dustCount = 300

        for (let i = 0; i < dustCount; i++) {
            const radius = 50 + Math.random() * (galaxyRadius * 0.7)
            const spinAngle = radius * galaxySpin * 0.0005
            const armIdx = Math.floor(Math.random() * galaxyArms)
            const branchAngle = (armIdx / galaxyArms) * Math.PI * 2
            
            // 나선팔의 '안쪽 가장자리'에 배치 (Lagging edge)
            // 회전 방향에 따라 먼지가 쌓이는 위치 시뮬레이션
            const armOffset = -0.2 - (Math.random() * 0.2) 

            const angle = spinAngle + branchAngle + armOffset
            const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 20
            const y = (Math.random() - 0.5) * 5
            const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 20

            const hexColor = dustColors[Math.floor(Math.random() * dustColors.length)]
            
            // 최적화된 텍스처 생성 사용 (isDark = true)
            const texture = this.createNebulaTexture(hexColor, 1.0, true)

            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                blending: THREE.NormalBlending,
                depthWrite: false,
                opacity: 0.2 + Math.random() * 0.3, // 진하게
                color: hexColor,
            })

            const sprite = new THREE.Sprite(spriteMat)
            sprite.position.set(x, y, z)

            const size = 30 + Math.random() * 50
            sprite.scale.set(size, size * 0.3, 1)

            this.dustGroup.add(sprite)
        }

        this.container.add(this.dustGroup)
    }

    update( deltaTime ) {
        // 은하 전체 회전
        this.container.rotation.y += deltaTime * 0.05
    }
}
