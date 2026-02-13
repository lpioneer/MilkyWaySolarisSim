import * as THREE from 'three/webgpu'
import Model from '@experience/Worlds/Abstracts/Model.js'
import Experience from '@experience/Experience.js'

const KMS_TO_KPC_PER_MYR = 0.001022712165045695
const G_KPC_KMS2_PER_MSUN = 4.30091e-6
const EPS = 1e-9

export default class SolarSystem extends Model {
    experience = Experience.getInstance()
    time = this.experience.time

    planets = []
    trailLength = 300

    // 물리 상수 (원본 config 기반)
    sceneUnitsPerKpc = 60  // 은하 반경 500 기준 스케일링
    simulationMyrPerSecond = 2.0

    // 태양 궤도 모델
    sunOrbitConstants = this._buildSunOrbitConstants()

    constructor( parameters = {} ) {
        super()
        this.world = parameters.world
        this.scene = this.world.scene

        this.init()
    }

    _buildSunOrbitConstants() {
        const m = {
            R0kpc: 8.178,
            oortA_kms_kpc: 16.0,
            oortB_kms_kpc: -12.0,
            localMassDensity_msun_pc3: 0.119,
            peculiarU_kms: 11.1,
            peculiarV_kms: 12.24,
            peculiarW_kms: 7.25,
            zSun_pc: 20.8,
            initialAzimuthDeg: 0
        }

        const A = m.oortA_kms_kpc * KMS_TO_KPC_PER_MYR
        const rawB = m.oortB_kms_kpc * KMS_TO_KPC_PER_MYR
        const B = Math.abs(rawB) < EPS ? -EPS : rawB
        const omega0 = (m.oortA_kms_kpc - m.oortB_kms_kpc) * KMS_TO_KPC_PER_MYR
        const kappa = Math.sqrt(Math.max(EPS, -4 * B * omega0))
        const rhoKpc3 = m.localMassDensity_msun_pc3 * 1e9
        const nu_kms_kpc = Math.sqrt(Math.max(EPS, 4 * Math.PI * G_KPC_KMS2_PER_MSUN * rhoKpc3))
        const nu = nu_kms_kpc * KMS_TO_KPC_PER_MYR

        return {
            R0: m.R0kpc, A, B, omega0, kappa, nu,
            u0: -m.peculiarU_kms * KMS_TO_KPC_PER_MYR,
            v0: m.peculiarV_kms * KMS_TO_KPC_PER_MYR,
            w0: m.peculiarW_kms * KMS_TO_KPC_PER_MYR,
            z0: m.zSun_pc * 1e-3,
            initialAzimuth: THREE.MathUtils.degToRad(m.initialAzimuthDeg)
        }
    }

    _getSunPositionInKpc( simulationTimeMyr ) {
        const c = this.sunOrbitConstants
        const t = simulationTimeMyr
        const kappaT = c.kappa * t
        const sinKappa = Math.sin(kappaT)
        const cosKappa = Math.cos(kappaT)

        const xLocal = (c.u0 / c.kappa) * sinKappa + (c.v0 / (2 * c.B)) * (1 - cosKappa)
        const yLocal = 2 * c.A * (c.v0 / (2 * c.B)) * t
            - (c.omega0 / (c.B * c.kappa)) * c.v0 * sinKappa
            + (2 * c.omega0 / (c.kappa * c.kappa)) * c.u0 * (1 - cosKappa)

        const zLocal = (c.w0 / c.nu) * Math.sin(c.nu * t) + c.z0 * Math.cos(c.nu * t)

        const R = Math.max(0.1, c.R0 + xLocal)
        const phi = c.initialAzimuth - c.omega0 * t - (yLocal / c.R0)

        return {
            x: R * Math.cos(phi),
            y: zLocal,
            z: R * Math.sin(phi)
        }
    }

    init() {
        this.createSun()
        this.createPlanets()
        this.createSunTrail()
        // scene에 직접 추가 (은하 공전은 자체 좌표 계산으로 처리)
    }

    createSun() {
        const sunGeo = new THREE.SphereGeometry(1.5, 32, 32)
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 })
        this.sun = new THREE.Mesh(sunGeo, sunMat)

        const spriteMat = new THREE.SpriteMaterial({
            map: this._createGlowTexture(),
            color: 0xffcc44,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
        const glow = new THREE.Sprite(spriteMat)
        glow.scale.set(12, 12, 1)
        this.sun.add(glow)

        const sunLight = new THREE.PointLight(0xffaa00, 5, 200)
        this.sun.add(sunLight)

        this.scene.add(this.sun)
    }

    _createGlowTexture() {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
        gradient.addColorStop(0.0, 'rgba(255, 200, 50, 1.0)')
        gradient.addColorStop(0.2, 'rgba(255, 150, 0, 0.6)')
        gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.2)')
        gradient.addColorStop(1.0, 'rgba(255, 50, 0, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 64, 64)
        return new THREE.CanvasTexture(canvas)
    }

    createSunTrail() {
        this.sunTrailPoints = []
        const trailGeo = new THREE.BufferGeometry()
        const positions = new Float32Array(this.trailLength * 3)
        trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const trailMat = new THREE.LineBasicMaterial({
            color: 0xffaa00,
            opacity: 0.3,
            transparent: true,
        })
        this.sunTrailLine = new THREE.Line(trailGeo, trailMat)
        this.sunTrailLine.frustumCulled = false
        this.scene.add(this.sunTrailLine)
    }

    createPlanets() {
        const planetData = [
            { name: "Mercury",  distance: 4,   size: 0.2,  speed: 4.0, color: 0xaaaaaa },
            { name: "Venus",    distance: 6,   size: 0.35, speed: 3.0, color: 0xe3bb76 },
            { name: "Earth",    distance: 8,   size: 0.4,  speed: 2.5, color: 0x22aaff },
            { name: "Mars",     distance: 11,  size: 0.3,  speed: 2.0, color: 0xff4422 },
            { name: "Jupiter",  distance: 18,  size: 1.2,  speed: 1.0, color: 0xd8ca9d },
            { name: "Saturn",   distance: 24,  size: 1.0,  speed: 0.8, color: 0xc6a86f },
            { name: "Uranus",   distance: 30,  size: 0.6,  speed: 0.6, color: 0x99ddff },
            { name: "Neptune",  distance: 36,  size: 0.55, speed: 0.5, color: 0x4466ff },
        ]

        planetData.forEach(data => {
            const geo = new THREE.SphereGeometry(data.size, 16, 16)
            const mat = new THREE.MeshStandardMaterial({
                color: data.color,
                roughness: 0.7,
                metalness: 0.1,
            })
            const mesh = new THREE.Mesh(geo, mat)

            mesh.userData = {
                distance: data.distance,
                initialAngle: Math.random() * Math.PI * 2,
                speed: data.speed,
                name: data.name,
                trailPositions: [],
            }

            // 궤적 라인
            const trailGeo = new THREE.BufferGeometry()
            const trailPositions = new Float32Array(this.trailLength * 3)
            trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
            const trailMat = new THREE.LineBasicMaterial({
                color: data.color,
                opacity: 0.4,
                transparent: true,
            })
            const trail = new THREE.Line(trailGeo, trailMat)
            trail.frustumCulled = false
            this.scene.add(trail)
            mesh.userData.trailMesh = trail

            this.planets.push(mesh)
            this.scene.add(mesh)
        })
    }

    update( deltaTime ) {
        if (!this.sun) return

        // 시뮬레이션 시간 계산
        if (!this._elapsed) this._elapsed = 0
        this._elapsed += deltaTime

        const simulationTimeMyr = this._elapsed * this.simulationMyrPerSecond
        const posKpc = this._getSunPositionInKpc(simulationTimeMyr)

        const scale = this.sceneUnitsPerKpc
        const sx = posKpc.x * scale
        const sy = posKpc.y * scale
        const sz = posKpc.z * scale

        this.sun.position.set(sx, sy, sz)

        // 태양 궤적 업데이트
        this._updateSunTrail()

        // 행성 공전 (원본 로직: 은하면 방향에 맞춘 동적 궤도면)
        this._updatePlanets()
    }

    _updateSunTrail() {
        const tp = this.sunTrailPoints
        tp.unshift(this.sun.position.x, this.sun.position.y, this.sun.position.z)
        if (tp.length > this.trailLength * 3) {
            tp.length = this.trailLength * 3
        }

        const positions = this.sunTrailLine.geometry.attributes.position.array
        for (let i = 0; i < tp.length && i < positions.length; i++) {
            positions[i] = tp[i]
        }
        if (tp.length > 0 && tp.length < positions.length) {
            const lx = tp[tp.length - 3]
            const ly = tp[tp.length - 2]
            const lz = tp[tp.length - 1]
            for (let i = tp.length; i < positions.length; i += 3) {
                positions[i] = lx
                positions[i + 1] = ly
                positions[i + 2] = lz
            }
        }
        this.sunTrailLine.geometry.attributes.position.needsUpdate = true
    }

    _updatePlanets() {
        const sunPos = this.sun.position

        // 은하면 상의 방향 벡터 (radial direction)
        const radial = new THREE.Vector3(sunPos.x, 0, sunPos.z)
        if (radial.lengthSq() < 1e-9) radial.set(1, 0, 0)
        radial.normalize()

        const Rx = radial.x
        const Rz = radial.z

        this.planets.forEach(planet => {
            const u = planet.userData
            const angle = u.initialAngle + this._elapsed * u.speed

            const pRadius = u.distance
            const pCos = Math.cos(angle)
            const pSin = Math.sin(angle)

            // 은하면 방향에 맞춘 궤도면 회전 (원본 로직)
            const relX = (Rx * pCos) * pRadius
            const relY = (pSin) * pRadius
            const relZ = (Rz * pCos) * pRadius

            planet.position.set(
                sunPos.x + relX,
                sunPos.y + relY,
                sunPos.z + relZ
            )

            // 궤적 업데이트 (월드 좌표)
            const tp = u.trailPositions
            tp.unshift(planet.position.x, planet.position.y, planet.position.z)
            if (tp.length > this.trailLength * 3) {
                tp.length = this.trailLength * 3
            }

            const positions = u.trailMesh.geometry.attributes.position.array
            for (let i = 0; i < tp.length && i < positions.length; i++) {
                positions[i] = tp[i]
            }
            if (tp.length > 0 && tp.length < positions.length) {
                const lx = tp[tp.length - 3]
                const ly = tp[tp.length - 2]
                const lz = tp[tp.length - 1]
                for (let i = tp.length; i < positions.length; i += 3) {
                    positions[i] = lx
                    positions[i + 1] = ly
                    positions[i + 2] = lz
                }
            }
            u.trailMesh.geometry.attributes.position.needsUpdate = true
        })
    }
}
